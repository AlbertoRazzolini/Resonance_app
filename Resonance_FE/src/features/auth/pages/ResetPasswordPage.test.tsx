import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeStore } from '@/app/store'
import { ROUTES } from '@/app/routes'
import { RedirectIfAuthenticated } from '@/components/guards/RedirectIfAuthenticated'
import { sessionEnded } from '@/features/auth/authSlice'
import { forgotRejected, forgotSucceeds, resetRejected, resetSucceeds } from '@/test/handlers/auth'
import { server } from '@/test/server'
import { Component as ResetPasswordPage } from './ResetPasswordPage'

// Reset della password: email, codice a 6 cifre e nuova password (progettazione, sezione 4.10). Ogni codice non valido
// è CODE_INVALID (decisione 51). A successo la sessione si chiude e si va all'accesso con l'avviso verde.
const CODE = '482019'
const GOOD = { email: 'mario@example.com', password: 'nuova-password-1' }
const RESEND = 'Invia di nuovo il codice'

function renderReset(state?: unknown) {
  const store = makeStore()
  store.dispatch(sessionEnded())
  const router = createMemoryRouter(
    [
      { path: ROUTES.home, element: <p>Home</p> },
      { path: ROUTES.login, element: <p>Pagina di accesso</p> },
      {
        path: ROUTES.resetPassword,
        element: (
          <RedirectIfAuthenticated>
            <ResetPasswordPage />
          </RedirectIfAuthenticated>
        ),
      },
    ],
    { initialEntries: [{ pathname: ROUTES.resetPassword, state }] },
  )
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
  return { router, store, user: userEvent.setup({ delay: null }) }
}

type User = ReturnType<typeof userEvent.setup>

async function fillCode(user: User, code = CODE) {
  await user.click(screen.getByLabelText('Cifra 1 di 6'))
  await user.keyboard(code)
}

async function fillPassword(user: User, password = GOOD.password) {
  await user.type(screen.getByLabelText('Nuova password'), password)
}

const submit = (user: User) => user.click(screen.getByRole('button', { name: 'Cambia password' }))

// Il conto alla rovescia si prova con il tempo finto, solo per Date e setInterval
function useFakeClock() {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
}

afterEach(() => {
  vi.useRealTimers()
})

describe('ResetPasswordPage', () => {
  it('mostra titolo, testo, email già scritta, sei caselle, nuova password con il contatore e pulsante', () => {
    renderReset({ email: GOOD.email })

    expect(screen.getByRole('heading', { name: 'Scegli una nuova password' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'Scrivi il codice a 6 cifre che ti abbiamo inviato e scegli una nuova password.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveValue(GOOD.email)
    expect(screen.getAllByLabelText(/Cifra \d di 6/)).toHaveLength(6)
    expect(screen.getByLabelText('Nuova password')).toBeInTheDocument()
    expect(screen.getByText('0 / 72 byte')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cambia password' })).toBeInTheDocument()
  })

  it('arrivando da "password dimenticata" mostra l’avviso neutro, che non dice se l’email esiste', () => {
    renderReset({ email: GOOD.email, codeSent: true })

    expect(
      screen.getByText("Se l'indirizzo è registrato e verificato, ti abbiamo inviato un codice."),
    ).toBeInTheDocument()
  })

  it('senza il segno del codice appena inviato (pagina ricaricata) non mostra l’avviso neutro', () => {
    renderReset()

    expect(screen.queryByText(/ti abbiamo inviato un codice/)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveValue('')
  })

  it('con i campi vuoti mostra i messaggi e non chiama il server', async () => {
    const calls: Request[] = []
    server.use(resetSucceeds(calls))
    const { user } = renderReset()

    await submit(user)

    expect(screen.getByText('Scrivi la tua email.')).toBeInTheDocument()
    expect(screen.getByText('Scrivi le 6 cifre del codice.')).toBeInTheDocument()
    expect(screen.getByText('Scrivi la password.')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('la nuova password con emoji è bloccata dal client, senza chiamare il server', async () => {
    const calls: Request[] = []
    server.use(resetSucceeds(calls))
    const { user } = renderReset({ email: GOOD.email })

    await fillCode(user)
    await fillPassword(user, 'nuova-🎸-password')
    await submit(user)

    expect(screen.getByText('Le emoji non sono ammesse nella password.')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('la nuova password sopra i 72 byte (40 lettere accentate) è bloccata dal client', async () => {
    const calls: Request[] = []
    server.use(resetSucceeds(calls))
    const { user } = renderReset({ email: GOOD.email })

    await fillCode(user)
    await fillPassword(user, 'è'.repeat(40))
    await submit(user)

    expect(
      screen.getByText(
        'La password è troppo lunga: al massimo 72 byte (le lettere accentate ne occupano di più).',
      ),
    ).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('con dati giusti invia email senza spazi ai lati, codice e nuova password, e va all’accesso con l’avviso verde', async () => {
    const calls: Request[] = []
    server.use(resetSucceeds(calls))
    const { user, router, store } = renderReset({ email: `  ${GOOD.email}  ` })

    await fillCode(user)
    await fillPassword(user)
    await submit(user)

    expect(await screen.findByText('Pagina di accesso')).toBeInTheDocument()
    expect(await calls[0].json()).toEqual({
      email: GOOD.email,
      code: CODE,
      newPassword: GOOD.password,
    })
    // L'avviso verde lo legge la pagina di accesso dallo stato; il reset non apre alcuna sessione
    expect(router.state.location.state).toEqual({ passwordChanged: true })
    expect(store.getState().auth.status).toBe('anonymous')
  })

  it('durante l’invio il pulsante è disattivato', async () => {
    server.use(
      http.post('*/api/auth/password/reset', async () => {
        await delay(100)
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = renderReset({ email: GOOD.email })

    await fillCode(user)
    await fillPassword(user)
    await submit(user)

    expect(screen.getByRole('button', { name: 'Cambia password' })).toBeDisabled()
    await screen.findByText('Pagina di accesso')
  })
})

describe('ResetPasswordPage · errori del backend', () => {
  async function failWith(status: number, code: string, details = {}, fields = {}) {
    server.use(resetRejected(status, code, [], details, fields))
    const rendered = renderReset({ email: GOOD.email })
    await fillCode(rendered.user)
    await fillPassword(rendered.user)
    await submit(rendered.user)
    return rendered
  }

  it('CODE_INVALID: messaggio sotto le caselle, che restano riempite e diventano rosse', async () => {
    await failWith(400, 'CODE_INVALID')

    expect(
      await screen.findByText("Il codice non è corretto. Controlla l'email e riprova."),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Cifra 1 di 6')).toHaveValue('4')
    expect(screen.getByLabelText('Cifra 6 di 6')).toHaveAttribute('aria-invalid', 'true')
  })

  it('ACCOUNT_SUSPENDED: mostra l’avviso con motivo e scadenza', async () => {
    await failWith(403, 'ACCOUNT_SUSPENDED', {
      suspensionReason: 'Violazione delle linee guida',
      suspendedUntil: null,
    })

    expect(await screen.findByRole('heading', { name: 'Account sospeso' })).toBeInTheDocument()
    expect(screen.getByText(/Violazione delle linee guida/)).toBeInTheDocument()
  })

  it('TOO_MANY_REQUESTS: avviso di attesa', async () => {
    await failWith(429, 'TOO_MANY_REQUESTS')

    expect(
      await screen.findByText('Troppi tentativi: attendi un momento e riprova.'),
    ).toBeInTheDocument()
  })

  it('VALIDATION_ERROR del server: il messaggio del campo va sotto la nuova password', async () => {
    await failWith(400, 'VALIDATION_ERROR', {}, { newPassword: 'non può contenere emoji' })

    expect(
      await screen.findByText('Dati non validi: controlla i campi evidenziati e riprova.'),
    ).toBeInTheDocument()
    expect(screen.getByText('non può contenere emoji')).toBeInTheDocument()
  })
})

describe('ResetPasswordPage · reinvio del codice', () => {
  it('arrivando da "password dimenticata" il pulsante aspetta 60 secondi e poi si attiva', () => {
    useFakeClock()
    renderReset({ email: GOOD.email, codeSent: true })

    expect(screen.getByRole('button', { name: `${RESEND} (60 s)` })).toBeDisabled()

    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(screen.getByRole('button', { name: RESEND })).toBeEnabled()
  })

  it('il reinvio chiama di nuovo "password dimenticata" e mostra il messaggio del reset', async () => {
    const calls: Request[] = []
    server.use(forgotSucceeds(calls))
    const { user } = renderReset({ email: `  ${GOOD.email}  ` })

    await user.click(screen.getByRole('button', { name: RESEND }))

    expect(
      await screen.findByText(
        "Se l'indirizzo è registrato e verificato, il codice sta arrivando. Non puoi chiederne un altro subito: controlla se ti è arrivato, anche nella cartella spam.",
      ),
    ).toBeInTheDocument()
    expect(await calls[0].json()).toEqual({ email: GOOD.email })
    expect(screen.getByRole('button', { name: `${RESEND} (60 s)` })).toBeDisabled()
  })

  it('con TOO_MANY_REQUESTS mostra l’avviso e riparte l’attesa', async () => {
    server.use(forgotRejected(429, 'TOO_MANY_REQUESTS'))
    const { user } = renderReset({ email: GOOD.email })

    await user.click(screen.getByRole('button', { name: RESEND }))

    expect(
      await screen.findByText('Troppi tentativi: attendi un momento e riprova.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `${RESEND} (60 s)` })).toBeDisabled()
  })
})
