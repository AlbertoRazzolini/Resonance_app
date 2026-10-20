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
import { forgotRejected, forgotSucceeds } from '@/test/handlers/auth'
import { server } from '@/test/server'
import { Component as ForgotPasswordPage } from './ForgotPasswordPage'

// Password dimenticata: la risposta è sempre la stessa, che l'email esista o no (progettazione, sezione 4.10; decisione
// 51); si passa al reset con l'email già scritta e il segno che il codice è appena partito.
function renderForgot() {
  const store = makeStore()
  store.dispatch(sessionEnded())
  const router = createMemoryRouter(
    [
      { path: ROUTES.home, element: <p>Home</p> },
      { path: ROUTES.resetPassword, element: <p>Pagina del reset</p> },
      {
        path: ROUTES.forgotPassword,
        element: (
          <RedirectIfAuthenticated>
            <ForgotPasswordPage />
          </RedirectIfAuthenticated>
        ),
      },
    ],
    { initialEntries: [ROUTES.forgotPassword] },
  )
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
  return { router, user: userEvent.setup() }
}

type User = ReturnType<typeof userEvent.setup>

const submit = (user: User) => user.click(screen.getByRole('button', { name: 'Invia il codice' }))

describe('ForgotPasswordPage', () => {
  it('mostra titolo, testo impersonale, campo email, pulsante e il collegamento a chi ha già un codice', () => {
    renderForgot()

    expect(screen.getByRole('heading', { name: 'Password dimenticata' })).toBeInTheDocument()
    expect(
      screen.getByText('Ti verrà mandato un codice a 6 cifre per il ripristino password.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('placeholder', 'tuonome@dominio.it')
    expect(screen.getByRole('button', { name: 'Invia il codice' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Inseriscilo' })).toHaveAttribute(
      'href',
      ROUTES.resetPassword,
    )
  })

  it('con l’email vuota o scritta male mostra il messaggio e non chiama il server', async () => {
    const calls: Request[] = []
    server.use(forgotSucceeds(calls))
    const { user } = renderForgot()

    await submit(user)
    expect(screen.getByText('Scrivi la tua email.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Email'), 'mario@')
    expect(screen.getByText('Scrivi un indirizzo email valido.')).toBeInTheDocument()
    await submit(user)
    expect(calls).toHaveLength(0)
  })

  it('invia l’email senza spazi ai lati e passa al reset con l’email e il segno del codice appena inviato', async () => {
    const calls: Request[] = []
    server.use(forgotSucceeds(calls))
    const { user, router } = renderForgot()

    await user.type(screen.getByLabelText('Email'), '  mario@example.com  ')
    await submit(user)

    expect(await screen.findByText('Pagina del reset')).toBeInTheDocument()
    expect(await calls[0].json()).toEqual({ email: 'mario@example.com' })
    expect(router.state.location.state).toEqual({ email: 'mario@example.com', codeSent: true })
  })

  it('durante l’invio il pulsante è disattivato', async () => {
    server.use(
      http.post('*/api/auth/password/forgot', async () => {
        await delay(100)
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = renderForgot()

    await user.type(screen.getByLabelText('Email'), 'mario@example.com')
    await submit(user)

    expect(screen.getByRole('button', { name: 'Invia il codice' })).toBeDisabled()
    await screen.findByText('Pagina del reset')
  })

  it('TOO_MANY_REQUESTS mostra l’avviso di attesa e resta nella pagina', async () => {
    server.use(forgotRejected(429, 'TOO_MANY_REQUESTS'))
    const { user } = renderForgot()

    await user.type(screen.getByLabelText('Email'), 'mario@example.com')
    await submit(user)

    expect(
      await screen.findByText('Troppi tentativi: attendi un momento e riprova.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Password dimenticata' })).toBeInTheDocument()
  })

  it('con la rete assente mostra l’errore e resta nella pagina', async () => {
    server.use(http.post('*/api/auth/password/forgot', () => HttpResponse.error()))
    const { user } = renderForgot()

    await user.type(screen.getByLabelText('Email'), 'mario@example.com')
    await submit(user)

    expect(
      await screen.findByText('Server non raggiungibile: controlla la connessione e riprova.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Pagina del reset')).not.toBeInTheDocument()
  })
})
