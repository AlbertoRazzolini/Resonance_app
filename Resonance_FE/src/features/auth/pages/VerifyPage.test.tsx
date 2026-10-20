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
import { makeLoginResponse } from '@/test/fixtures/users'
import {
  resendRejected,
  resendSucceeds,
  verifyRejected,
  verifySucceeds,
} from '@/test/handlers/auth'
import { server } from '@/test/server'
import { Component as VerifyPage } from './VerifyPage'

// Pagina di verifica: codice a 6 cifre e password, un messaggio per ogni errore del backend (progettazione, sezione
// 4.5) e reinvio del codice con l'attesa di 60 secondi fra due richieste (sezione 4.6).
const CODE = '482019'
const GOOD = { email: 'mario@example.com', password: 'password-lunga' }
const RESEND = 'Invia di nuovo il codice'

function renderVerify(state?: unknown) {
  const store = makeStore()
  store.dispatch(sessionEnded())
  const router = createMemoryRouter(
    [
      { path: ROUTES.home, element: <p>Home</p> },
      { path: '/riservata', element: <p>Pagina riservata</p> },
      { path: ROUTES.login, element: <p>Pagina di accesso</p> },
      {
        path: ROUTES.verify,
        element: (
          <RedirectIfAuthenticated>
            <VerifyPage />
          </RedirectIfAuthenticated>
        ),
      },
    ],
    { initialEntries: [{ pathname: ROUTES.verify, state }] },
  )
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
  return { router, store, user: userEvent.setup({ delay: null }) }
}

type User = ReturnType<typeof userEvent.setup>

/** Scrive il codice nelle caselle e la password; l'email è già nel campo se arriva dallo stato. */
async function fillCode(user: User, code = CODE) {
  await user.click(screen.getByLabelText('Cifra 1 di 6'))
  await user.keyboard(code)
}

async function fillPassword(user: User, password = GOOD.password) {
  await user.type(screen.getByLabelText('Password'), password)
}

const submit = (user: User) => user.click(screen.getByRole('button', { name: 'Verifica' }))

// Il conto alla rovescia si prova con il tempo finto, solo per Date e setInterval: il resto (rete finta, user-event)
// usa i timer veri
function useFakeClock() {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
}

afterEach(() => {
  vi.useRealTimers()
})

describe('VerifyPage', () => {
  it('mostra titolo, testo, email già scritta, sei caselle, password e pulsante', () => {
    renderVerify({ email: GOOD.email })

    expect(screen.getByRole('heading', { name: 'Verifica la tua email' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'Abbiamo inviato un codice a 6 cifre alla tua email. Inseriscilo per confermare la tua identità da palco.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveValue(GOOD.email)
    expect(screen.getAllByLabelText(/Cifra \d di 6/)).toHaveLength(6)
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Verifica' })).toBeInTheDocument()
  })

  it('senza stato (pagina ricaricata) il campo email è vuoto e modificabile', async () => {
    const { user } = renderVerify()

    expect(screen.getByLabelText('Email')).toHaveValue('')
    await user.type(screen.getByLabelText('Email'), 'altra@example.com')
    expect(screen.getByLabelText('Email')).toHaveValue('altra@example.com')
  })

  it('con i campi vuoti mostra i messaggi e non chiama il server', async () => {
    const calls: Request[] = []
    server.use(verifySucceeds(undefined, calls))
    const { user } = renderVerify()

    await submit(user)

    expect(screen.getByText('Scrivi la tua email.')).toBeInTheDocument()
    expect(screen.getByText('Scrivi le 6 cifre del codice.')).toBeInTheDocument()
    expect(screen.getByText('Scrivi la password.')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('con 5 cifre chiede le 6 cifre del codice, senza chiamare il server', async () => {
    const calls: Request[] = []
    server.use(verifySucceeds(undefined, calls))
    const { user } = renderVerify({ email: GOOD.email })

    await fillCode(user, '48201')
    await fillPassword(user)
    await submit(user)

    expect(screen.getByText('Scrivi le 6 cifre del codice.')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('il codice accetta solo cifre: le lettere non entrano nelle caselle', async () => {
    const { user } = renderVerify({ email: GOOD.email })

    await fillCode(user, '4a8b2c')

    expect(screen.getByLabelText('Cifra 1 di 6')).toHaveValue('4')
    expect(screen.getByLabelText('Cifra 2 di 6')).toHaveValue('8')
    expect(screen.getByLabelText('Cifra 3 di 6')).toHaveValue('2')
    expect(screen.getByLabelText('Cifra 4 di 6')).toHaveValue('')
  })

  it('con dati giusti apre la sessione e va alla pagina richiesta', async () => {
    const calls: Request[] = []
    server.use(verifySucceeds(makeLoginResponse(), calls))
    const { user, store } = renderVerify({ email: `  ${GOOD.email}  `, from: '/riservata' })

    await fillCode(user)
    await fillPassword(user)
    await submit(user)

    expect(await screen.findByText('Pagina riservata')).toBeInTheDocument()
    expect(await calls[0].json()).toEqual({
      email: GOOD.email,
      code: CODE,
      password: GOOD.password,
    })
    expect(store.getState().auth.status).toBe('authenticated')
  })

  it('senza pagina richiesta va alla home', async () => {
    server.use(verifySucceeds())
    const { user } = renderVerify({ email: GOOD.email })

    await fillCode(user)
    await fillPassword(user)
    await submit(user)

    expect(await screen.findByText('Home')).toBeInTheDocument()
  })

  it("durante l'invio il pulsante è disattivato", async () => {
    server.use(
      http.post('*/api/auth/verify', async () => {
        await delay(100)
        return HttpResponse.json(makeLoginResponse())
      }),
    )
    const { user } = renderVerify({ email: GOOD.email })

    await fillCode(user)
    await fillPassword(user)
    await submit(user)

    expect(screen.getByRole('button', { name: 'Verifica' })).toBeDisabled()
    await screen.findByText('Home')
  })
})

describe('VerifyPage · errori del backend', () => {
  async function failWith(status: number, code: string, details = {}) {
    server.use(verifyRejected(status, code, [], details))
    const rendered = renderVerify({ email: GOOD.email })
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

  it('CODE_EXPIRED: messaggio sotto le caselle che invita a chiederne uno nuovo', async () => {
    await failWith(400, 'CODE_EXPIRED')

    expect(
      await screen.findByText(
        'Il codice è scaduto o hai esaurito i tentativi. Richiedine uno nuovo.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Cifra 1 di 6')).toHaveAttribute('aria-invalid', 'true')
  })

  it('WRONG_PASSWORD: avviso generico in alto, senza segnare le caselle', async () => {
    await failWith(400, 'WRONG_PASSWORD')

    expect(
      await screen.findByText(
        'I dati inseriti non sono corretti: controlla il codice e la password. Se non ricordi la password, registrati di nuovo con la stessa email.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Cifra 1 di 6')).not.toHaveAttribute('aria-invalid', 'true')
  })

  it("ALREADY_VERIFIED: avviso e collegamento all'accesso", async () => {
    await failWith(409, 'ALREADY_VERIFIED')

    expect(
      await screen.findByText('Questo account è già verificato: puoi accedere.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: "Vai all'accesso" })).toHaveAttribute(
      'href',
      ROUTES.login,
    )
  })

  it("ACCOUNT_SUSPENDED: mostra l'avviso con motivo e scadenza, senza aprire la sessione", async () => {
    const { store } = await failWith(403, 'ACCOUNT_SUSPENDED', {
      suspensionReason: 'Violazione delle linee guida',
      suspendedUntil: null,
    })

    expect(await screen.findByRole('heading', { name: 'Account sospeso' })).toBeInTheDocument()
    expect(screen.getByText(/Violazione delle linee guida/)).toBeInTheDocument()
    expect(store.getState().auth.status).toBe('anonymous')
  })

  it('TOO_MANY_REQUESTS: avviso di attesa', async () => {
    await failWith(429, 'TOO_MANY_REQUESTS')

    expect(
      await screen.findByText('Troppi tentativi: attendi un momento e riprova.'),
    ).toBeInTheDocument()
  })
})

describe('VerifyPage · reinvio del codice', () => {
  it('se il codice è appena partito (arrivo dalla registrazione) il pulsante aspetta 60 secondi', () => {
    useFakeClock()
    renderVerify({ email: GOOD.email, codeSent: true })

    expect(screen.getByRole('button', { name: `${RESEND} (60 s)` })).toBeDisabled()

    act(() => {
      vi.advanceTimersByTime(15_000)
    })
    expect(screen.getByRole('button', { name: `${RESEND} (45 s)` })).toBeDisabled()

    act(() => {
      vi.advanceTimersByTime(45_000)
    })
    expect(screen.getByRole('button', { name: RESEND })).toBeEnabled()
  })

  it("arrivando dall'accesso (email non verificata) o dopo un ricaricamento è subito attivo, se c'è l'email", () => {
    renderVerify({ email: GOOD.email })

    expect(screen.getByRole('button', { name: RESEND })).toBeEnabled()
  })

  it("senza un'email valida il pulsante di reinvio è disattivato", async () => {
    const { user } = renderVerify()
    expect(screen.getByRole('button', { name: RESEND })).toBeDisabled()

    await user.type(screen.getByLabelText('Email'), 'mario@example')
    expect(screen.getByRole('button', { name: RESEND })).toBeDisabled()

    await user.type(screen.getByLabelText('Email'), '.com')
    expect(screen.getByRole('button', { name: RESEND })).toBeEnabled()
  })

  it("il reinvio manda solo l'email senza spazi ai lati, mostra il messaggio e riavvia l'attesa di 60 secondi", async () => {
    const calls: Request[] = []
    server.use(resendSucceeds(calls))
    const { user } = renderVerify({ email: `  ${GOOD.email}  ` })
    await fillCode(user)
    await fillPassword(user)

    await user.click(screen.getByRole('button', { name: RESEND }))

    expect(
      await screen.findByText(
        "Se l'indirizzo è in attesa di verifica, il codice sta arrivando. Non puoi chiederne un altro subito: controlla se ti è arrivato, anche nella cartella spam.",
      ),
    ).toBeInTheDocument()
    expect(await calls[0].json()).toEqual({ email: GOOD.email })
    expect(screen.getByRole('button', { name: `${RESEND} (60 s)` })).toBeDisabled()
  })

  it("al termine dell'attesa il messaggio sparisce e il pulsante torna attivo", async () => {
    server.use(resendSucceeds())
    useFakeClock()
    const { user } = renderVerify({ email: GOOD.email })
    await user.click(screen.getByRole('button', { name: RESEND }))
    await screen.findByText(/il codice sta arrivando/)

    act(() => {
      vi.advanceTimersByTime(61_000)
    })

    expect(screen.getByRole('button', { name: RESEND })).toBeEnabled()
    expect(screen.queryByText(/il codice sta arrivando/)).not.toBeInTheDocument()
  })

  it("con TOO_MANY_REQUESTS mostra l'avviso e riparte l'attesa di 60 secondi", async () => {
    server.use(resendRejected(429, 'TOO_MANY_REQUESTS'))
    const { user } = renderVerify({ email: GOOD.email })

    await user.click(screen.getByRole('button', { name: RESEND }))

    expect(
      await screen.findByText('Troppi tentativi: attendi un momento e riprova.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `${RESEND} (60 s)` })).toBeDisabled()
  })

  it("con la rete assente mostra l'errore e lascia il pulsante attivo (nessuna attesa inutile)", async () => {
    server.use(http.post('*/api/auth/resend-code', () => HttpResponse.error()))
    const { user } = renderVerify({ email: GOOD.email })

    await user.click(screen.getByRole('button', { name: RESEND }))

    expect(
      await screen.findByText('Server non raggiungibile: controlla la connessione e riprova.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: RESEND })).toBeEnabled()
  })
})
