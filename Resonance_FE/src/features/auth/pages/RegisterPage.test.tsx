import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { ROUTES } from '@/app/routes'
import { RedirectIfAuthenticated } from '@/components/guards/RedirectIfAuthenticated'
import { sessionEnded } from '@/features/auth/authSlice'
import { registerRejected, registerSucceeds } from '@/test/handlers/auth'
import { server } from '@/test/server'
import { Component as RegisterPage } from './RegisterPage'

// Pagina di registrazione: validazioni come il backend (decisione 84), errori del server sotto i campi e passaggio alla
// verifica con l'email già pronta (progettazione, sezione 4.4).
function renderRegister(state?: unknown) {
  const store = makeStore()
  store.dispatch(sessionEnded())
  const router = createMemoryRouter(
    [
      { path: ROUTES.home, element: <p>Home</p> },
      { path: ROUTES.login, element: <p>Pagina di accesso</p> },
      { path: ROUTES.verify, element: <p>Pagina di verifica</p> },
      {
        path: ROUTES.register,
        element: (
          <RedirectIfAuthenticated>
            <RegisterPage />
          </RedirectIfAuthenticated>
        ),
      },
    ],
    { initialEntries: [{ pathname: ROUTES.register, state }] },
  )
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
  return { router, store, user: userEvent.setup() }
}

type User = ReturnType<typeof userEvent.setup>

async function fill(user: User, values: { name?: string; email?: string; password?: string }) {
  if (values.name) await user.type(screen.getByLabelText('Nome utente'), values.name)
  if (values.email) await user.type(screen.getByLabelText('Email'), values.email)
  if (values.password) await user.type(screen.getByLabelText('Password'), values.password)
}

const submit = (user: User) => user.click(screen.getByRole('button', { name: 'Registrati' }))

const GOOD = { name: 'Mario Rossi', email: 'mario@example.com', password: 'password-lunga' }

describe('RegisterPage', () => {
  it("mostra titolo, campi con i segnaposto, contatore dei byte e il collegamento all'accesso", () => {
    renderRegister()

    expect(screen.getByRole('heading', { name: 'Crea il tuo account' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nome utente')).toHaveAttribute(
      'placeholder',
      'Come ti vedranno gli altri',
    )
    expect(screen.getByLabelText('Email')).toHaveAttribute('placeholder', 'tuonome@dominio.it')
    expect(screen.getByLabelText('Password')).not.toHaveAttribute('placeholder')
    expect(screen.getByText('0 / 72 byte')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Accedi' })).toHaveAttribute('href', ROUTES.login)
  })

  it('il contatore conta i byte, non i caratteri', async () => {
    const { user } = renderRegister()

    await user.type(screen.getByLabelText('Password'), 'abè')

    expect(screen.getByText('4 / 72 byte')).toBeInTheDocument()
  })

  it('con i campi vuoti mostra i tre messaggi e non chiama il server', async () => {
    const calls: Request[] = []
    server.use(registerSucceeds(calls))
    const { user } = renderRegister()

    await submit(user)

    expect(screen.getByText('Scrivi il nome utente.')).toBeInTheDocument()
    expect(screen.getByText('Scrivi la tua email.')).toBeInTheDocument()
    expect(screen.getByText('Scrivi la password.')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('i messaggi seguono quello che si scrive dopo il primo invio', async () => {
    const { user } = renderRegister()
    await submit(user)

    await user.type(screen.getByLabelText('Nome utente'), 'Mario')
    expect(screen.queryByText('Scrivi il nome utente.')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Email'), 'mario')
    expect(screen.getByText('Scrivi un indirizzo email valido.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Email'), '@example.com')
    expect(screen.queryByText('Scrivi un indirizzo email valido.')).not.toBeInTheDocument()
  })

  it('30 emoji nella password sono bloccate dal client: messaggio e nessuna richiesta (Review Focus 4)', async () => {
    const calls: Request[] = []
    server.use(registerSucceeds(calls))
    const { user } = renderRegister()

    await fill(user, { name: GOOD.name, email: GOOD.email, password: '😀'.repeat(30) })
    await submit(user)

    expect(screen.getByText('Le emoji non sono ammesse nella password.')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it("un'emoji nel nome è bloccata: messaggio sotto il campo e nessuna richiesta", async () => {
    const calls: Request[] = []
    server.use(registerSucceeds(calls))
    const { user } = renderRegister()

    await fill(user, { name: 'Mario 🎸', email: GOOD.email, password: GOOD.password })
    await submit(user)

    expect(screen.getByText('Le emoji non sono ammesse nel nome.')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('una password sopra i 72 byte (40 lettere accentate) è bloccata dal client', async () => {
    const calls: Request[] = []
    server.use(registerSucceeds(calls))
    const { user } = renderRegister()

    await fill(user, { ...GOOD, password: 'è'.repeat(40) })
    await submit(user)

    expect(
      screen.getByText(
        'La password è troppo lunga: al massimo 72 byte (le lettere accentate ne occupano di più).',
      ),
    ).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it("con dati giusti invia nome ed email senza spazi ai lati e la password così com'è, poi va alla verifica", async () => {
    const calls: Request[] = []
    server.use(registerSucceeds(calls))
    const { user, router, store } = renderRegister({ from: '/riservata' })

    await fill(user, {
      name: '  Mario Rossi  ',
      email: '  mario@example.com  ',
      password: ' password-lunga ',
    })
    await submit(user)

    expect(await screen.findByText('Pagina di verifica')).toBeInTheDocument()
    expect(await calls[0].json()).toEqual({
      email: 'mario@example.com',
      password: ' password-lunga ',
      displayName: 'Mario Rossi',
    })
    // L'email, la pagina richiesta e il segno "codice appena inviato" passano nello stato del router; la sessione
    // non si apre (serve la verifica)
    expect(router.state.location.state).toEqual({
      email: 'mario@example.com',
      from: '/riservata',
      codeSent: true,
    })
    expect(store.getState().auth.status).toBe('anonymous')
  })

  it("durante l'invio il pulsante è disattivato", async () => {
    server.use(
      http.post('*/api/auth/register', async () => {
        await delay(100)
        return HttpResponse.json({ email: GOOD.email }, { status: 201 })
      }),
    )
    const { user } = renderRegister()

    await fill(user, GOOD)
    await submit(user)

    expect(screen.getByRole('button', { name: 'Registrati' })).toBeDisabled()
    await screen.findByText('Pagina di verifica')
  })

  it('EMAIL_ALREADY_REGISTERED: avviso senza "prova ad accedere" e collegamento "Vai all\'accesso"', async () => {
    server.use(registerRejected(409, 'EMAIL_ALREADY_REGISTERED'))
    const { user } = renderRegister()

    await fill(user, GOOD)
    await submit(user)

    expect(await screen.findByText('Esiste già un account con questa email.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: "Vai all'accesso" })).toHaveAttribute(
      'href',
      ROUTES.login,
    )
  })

  it('DISPLAY_NAME_TAKEN: «Nome già utilizzato.» solo sotto il campo, senza avviso in alto, e resta nella pagina', async () => {
    server.use(registerRejected(409, 'DISPLAY_NAME_TAKEN'))
    const { user, router } = renderRegister()

    await fill(user, GOOD)
    await submit(user)

    expect(await screen.findByText('Nome già utilizzato.')).toBeInTheDocument()
    expect(screen.getAllByText('Nome già utilizzato.')).toHaveLength(1)
    // Un solo role=alert: quello del campo, non anche l'avviso rosso in alto
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByLabelText('Nome utente')).toBeInvalid()
    expect(router.state.location.pathname).toBe(ROUTES.register)
  })

  it('nome riservato: il VALIDATION_ERROR del server compare sotto il nome, senza elenco nel frontend', async () => {
    server.use(
      registerRejected(400, 'VALIDATION_ERROR', {
        displayName: 'Questo nome utente non è disponibile',
      }),
    )
    const { user } = renderRegister()

    await fill(user, { ...GOOD, name: 'Admin' })
    await submit(user)

    expect(await screen.findByText('Questo nome utente non è disponibile')).toBeInTheDocument()
  })

  it("VALIDATION_ERROR del server: i messaggi vanno sotto i campi giusti, più l'avviso generico", async () => {
    server.use(
      registerRejected(400, 'VALIDATION_ERROR', {
        displayName: 'non può contenere caratteri invisibili',
        email: 'deve essere un indirizzo email ben formato',
        password: 'non può contenere emoji',
      }),
    )
    const { user } = renderRegister()

    await fill(user, GOOD)
    await submit(user)

    expect(
      await screen.findByText('Dati non validi: controlla i campi evidenziati e riprova.'),
    ).toBeInTheDocument()
    expect(screen.getByText('non può contenere caratteri invisibili')).toBeInTheDocument()
    expect(screen.getByText('deve essere un indirizzo email ben formato')).toBeInTheDocument()
    expect(screen.getByText('non può contenere emoji')).toBeInTheDocument()
  })

  it("VALIDATION_ERROR con un campo sconosciuto: solo l'avviso generico, senza mostrare quel testo", async () => {
    server.use(registerRejected(400, 'VALIDATION_ERROR', { campoNuovo: 'testo del server' }))
    const { user } = renderRegister()

    await fill(user, GOOD)
    await submit(user)

    expect(
      await screen.findByText('Dati non validi: controlla i campi evidenziati e riprova.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('testo del server')).not.toBeInTheDocument()
  })

  it('TOO_MANY_REQUESTS mostra il messaggio di attesa e resta nella pagina', async () => {
    server.use(registerRejected(429, 'TOO_MANY_REQUESTS'))
    const { user } = renderRegister()

    await fill(user, GOOD)
    await submit(user)

    expect(
      await screen.findByText('Troppi tentativi: attendi un momento e riprova.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Crea il tuo account' })).toBeInTheDocument()
  })

  it("il collegamento all'accesso porta con sé la pagina richiesta", async () => {
    const { user, router } = renderRegister({ from: '/riservata' })

    await user.click(screen.getByRole('link', { name: 'Accedi' }))

    expect(await screen.findByText('Pagina di accesso')).toBeInTheDocument()
    expect(router.state.location.state).toEqual({ from: '/riservata' })
  })
})
