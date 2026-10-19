import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { ROUTES } from '@/app/routes'
import { RedirectIfAuthenticated } from '@/components/guards/RedirectIfAuthenticated'
import { APPEAL_CONTACT } from '@/config'
import { sessionEnded, sessionStarted } from '@/features/auth/authSlice'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import { loginRejected, loginSucceeds, refreshSucceeds } from '@/test/handlers/auth'
import { server } from '@/test/server'
import { Component as LoginPage } from './LoginPage'

// Pagina di accesso: validazione dei campi vuoti, ritorno alla pagina richiesta, un messaggio per ogni errore del backend
// e l'avviso di sospensione con motivo, scadenza e contatto.
function renderLogin(state?: unknown, prepare?: (store: ReturnType<typeof makeStore>) => void) {
  const store = makeStore()
  store.dispatch(sessionEnded())
  prepare?.(store)
  const router = createMemoryRouter(
    [
      { path: ROUTES.home, element: <p>Home</p> },
      { path: '/riservata', element: <p>Pagina riservata</p> },
      { path: ROUTES.verify, element: <p>Pagina di verifica</p> },
      { path: ROUTES.forgotPassword, element: <p>Password dimenticata</p> },
      { path: ROUTES.register, element: <p>Registrazione</p> },
      {
        path: ROUTES.login,
        element: (
          <RedirectIfAuthenticated>
            <LoginPage />
          </RedirectIfAuthenticated>
        ),
      },
    ],
    { initialEntries: [{ pathname: ROUTES.login, state }] },
  )
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
  return { router, store, user: userEvent.setup() }
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>, email: string, password: string) {
  if (email) await user.type(screen.getByLabelText('Email'), email)
  if (password) await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: /entra/i }))
}

describe('LoginPage', () => {
  it('mostra il titolo, i campi e i collegamenti a registrazione e password dimenticata', () => {
    renderLogin()

    expect(screen.getByRole('heading', { name: 'Accedi' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Registrati qui' })).toHaveAttribute('href', ROUTES.register)
    expect(screen.getByRole('link', { name: 'Password dimenticata?' })).toHaveAttribute('href', ROUTES.forgotPassword)
  })

  it('con i campi vuoti mostra i nostri messaggi sotto i campi e non chiama il server', async () => {
    const calls: Request[] = []
    server.use(loginSucceeds(undefined, calls))
    const { user } = renderLogin()

    await fillAndSubmit(user, '', '')

    expect(screen.getByText('Scrivi la tua email.')).toBeInTheDocument()
    expect(screen.getByText('Scrivi la password.')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('il messaggio di un campo sparisce appena si scrive nel campo', async () => {
    const { user } = renderLogin()
    await fillAndSubmit(user, '', '')
    expect(screen.getByText('Scrivi la tua email.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Email'), 'a')

    expect(screen.queryByText('Scrivi la tua email.')).not.toBeInTheDocument()
    expect(screen.getByText('Scrivi la password.')).toBeInTheDocument()
  })

  it('con le credenziali giuste apre la sessione e va alla home, inviando l\'email senza spazi ai lati', async () => {
    const calls: Request[] = []
    server.use(loginSucceeds(makeLoginResponse(), calls))
    const { user, store } = renderLogin()

    await fillAndSubmit(user, '  fan@example.com  ', 'password-lunga')

    expect(await screen.findByText('Home')).toBeInTheDocument()
    expect(await calls[0].json()).toEqual({ email: 'fan@example.com', password: 'password-lunga' })
    expect(store.getState().auth.status).toBe('authenticated')
  })

  it('dopo il login torna alla pagina richiesta (stato `from`)', async () => {
    server.use(loginSucceeds())
    const { user } = renderLogin({ from: '/riservata' })

    await fillAndSubmit(user, 'fan@example.com', 'password-lunga')

    expect(await screen.findByText('Pagina riservata')).toBeInTheDocument()
  })

  it('durante l\'invio il pulsante è disattivato (niente doppio invio)', async () => {
    server.use(
      http.post('*/api/auth/login', async () => {
        await delay(100)
        return HttpResponse.json(makeLoginResponse())
      }),
    )
    const { user } = renderLogin()

    await fillAndSubmit(user, 'fan@example.com', 'password-lunga')

    expect(screen.getByRole('button', { name: /entra/i })).toBeDisabled()
    await screen.findByText('Home')
  })

  it('INVALID_CREDENTIALS mostra il messaggio generico, non tenta il refresh e resta nella pagina', async () => {
    // Review Focus 1: il 401 del login non è un token scaduto
    const refreshCalls: Request[] = []
    server.use(loginRejected(401, 'INVALID_CREDENTIALS'), refreshSucceeds(undefined, refreshCalls))
    const { user, store } = renderLogin()

    await fillAndSubmit(user, 'fan@example.com', 'sbagliata-1')

    expect(await screen.findByText('Email o password non corrette.')).toBeInTheDocument()
    expect(refreshCalls).toHaveLength(0)
    expect(store.getState().auth.status).toBe('anonymous')
    expect(screen.getByRole('heading', { name: 'Accedi' })).toBeInTheDocument()
  })

  it('TOO_MANY_REQUESTS mostra il messaggio di attesa', async () => {
    server.use(loginRejected(429, 'TOO_MANY_REQUESTS'))
    const { user } = renderLogin()

    await fillAndSubmit(user, 'fan@example.com', 'password-lunga')

    expect(await screen.findByText('Troppi tentativi: attendi un momento e riprova.')).toBeInTheDocument()
  })

  it('EMAIL_NOT_VERIFIED mostra il collegamento alla verifica, con l\'email già pronta', async () => {
    server.use(loginRejected(403, 'EMAIL_NOT_VERIFIED'))
    const { user, router } = renderLogin({ from: '/riservata' })

    await fillAndSubmit(user, 'nuovo@example.com', 'password-lunga')
    await user.click(await screen.findByRole('link', { name: 'Inserisci il codice' }))

    expect(await screen.findByText('Pagina di verifica')).toBeInTheDocument()
    // L'email e la pagina richiesta passano nello stato del router (decisione 82)
    expect(router.state.location.state).toEqual({ email: 'nuovo@example.com', from: '/riservata' })
  })

  it('ACCOUNT_SUSPENDED mostra l\'avviso con motivo, scadenza e contatto, senza aprire la sessione', async () => {
    server.use(
      loginRejected(403, 'ACCOUNT_SUSPENDED', [], {
        suspensionReason: 'Violazione delle linee guida',
        suspendedUntil: '2026-10-30T12:00:00Z',
      }),
    )
    const { user, store } = renderLogin()

    await fillAndSubmit(user, 'fan@example.com', 'password-lunga')

    expect(await screen.findByRole('heading', { name: 'Account sospeso' })).toBeInTheDocument()
    expect(screen.getByText(/Violazione delle linee guida/)).toBeInTheDocument()
    expect(screen.getByText(/Sospeso fino al/)).toHaveTextContent('30 ott 2026')
    expect(screen.getByRole('link', { name: APPEAL_CONTACT })).toBeInTheDocument()
    expect(store.getState().auth.status).toBe('anonymous')
  })

  it('mostra l\'avviso di sospensione anche quando la sessione è stata chiusa dal refresh (stato dello store)', () => {
    renderLogin(undefined, (store) =>
      store.dispatch(sessionEnded({ suspension: { suspensionReason: 'Spam', suspendedUntil: null } })),
    )

    expect(screen.getByRole('heading', { name: 'Account sospeso' })).toBeInTheDocument()
    expect(screen.getByText('A tempo indeterminato')).toBeInTheDocument()
  })

  it('dopo il reset della password mostra l\'avviso verde, solo se arriva da lì', () => {
    renderLogin({ passwordChanged: true })

    expect(screen.getByText('Password cambiata. Accedi con la nuova password.')).toBeInTheDocument()
  })

  it('senza lo stato del reset non mostra l\'avviso verde', () => {
    renderLogin()

    expect(screen.queryByText('Password cambiata. Accedi con la nuova password.')).not.toBeInTheDocument()
  })

  it('chi ha già la sessione non vede il form e va alla home', async () => {
    renderLogin(undefined, (store) =>
      store.dispatch(sessionStarted(makeLoginResponse({ user: makeMe() }))),
    )

    await waitFor(() => expect(screen.getByText('Home')).toBeInTheDocument())
  })

  it('una password con le emoji viene inviata così com\'è (il controllo dei 72 byte spetta alla registrazione)', async () => {
    const calls: Request[] = []
    server.use(loginSucceeds(makeLoginResponse(), calls))
    const { user } = renderLogin()
    const password = '🎸'.repeat(30)

    await user.type(screen.getByLabelText('Email'), 'fan@example.com')
    await user.type(screen.getByLabelText('Password'), password)
    await user.click(screen.getByRole('button', { name: /entra/i }))

    await screen.findByText('Home')
    expect((await calls[0].json()).password).toBe(password)
  })
})
