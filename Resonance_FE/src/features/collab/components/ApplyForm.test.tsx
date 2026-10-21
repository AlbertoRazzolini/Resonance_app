import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/app/routes'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeCollabPost } from '@/test/fixtures/collab'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import { applicationRejected, applicationSent } from '@/test/handlers/collab'
import { server } from '@/test/server'
import { ApplyForm } from './ApplyForm'

// Modulo di candidatura: messaggio 1–1800 con contatore, controlli del client prima di chiamare il server, esito con il
// collegamento alla chat, errori COLLAB_CLOSED, CANNOT_APPLY_OWN_POST e TOO_MANY_REQUESTS con i testi dei loro codici,
// e per un anonimo il passaggio dall'accesso con ritorno alla stessa pagina (progettazione, sezione 6.7).
function LocationProbe() {
  const location = useLocation()
  return <p data-testid="location">{location.pathname + '|' + JSON.stringify(location.state)}</p>
}

function renderForm({ loggedIn = true }: { loggedIn?: boolean } = {}) {
  const store = makeStore()
  if (loggedIn) store.dispatch(sessionStarted(makeLoginResponse({ user: makeMe({ id: 'me-id' }) })))
  const router = createMemoryRouter(
    [
      {
        path: '/collab/:id',
        element: (
          <>
            <ApplyForm post={makeCollabPost({ id: 'a1' })} />
            <LocationProbe />
          </>
        ),
      },
      { path: ROUTES.login, element: <LocationProbe /> },
    ],
    { initialEntries: ['/collab/a1'] },
  )
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
  return userEvent.setup()
}

describe('ApplyForm', () => {
  it('mostra il campo del messaggio con il contatore e «Invia candidatura»', () => {
    renderForm()

    expect(screen.getByLabelText("Messaggio per l'autore")).toBeInTheDocument()
    expect(screen.getByText('0 / 1800')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Invia candidatura' })).toBeInTheDocument()
  })

  it('il contatore segue quello che si scrive', async () => {
    const user = renderForm()

    await user.type(screen.getByLabelText("Messaggio per l'autore"), 'Ciao')

    expect(screen.getByText('4 / 1800')).toBeInTheDocument()
  })

  it('un messaggio vuoto o di soli spazi non chiama il server', async () => {
    const calls: Request[] = []
    server.use(applicationSent({ conversationId: 'c1', messageId: 'm1' }, calls))
    const user = renderForm()

    await user.type(screen.getByLabelText("Messaggio per l'autore"), '   ')
    await user.click(screen.getByRole('button', { name: 'Invia candidatura' }))

    expect(screen.getByText('Scrivi il messaggio.')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('oltre 1800 caratteri è rifiutato nel client, a 1800 passa', async () => {
    const calls: Request[] = []
    server.use(applicationSent({ conversationId: 'c1', messageId: 'm1' }, calls))
    const user = renderForm()
    const field = screen.getByLabelText("Messaggio per l'autore")

    // `paste` evita di digitare 1800 caratteri uno per uno
    await user.click(field)
    await user.paste('a'.repeat(1801))
    await user.click(screen.getByRole('button', { name: 'Invia candidatura' }))
    expect(screen.getByText('Il messaggio può avere al massimo 1800 caratteri.')).toBeInTheDocument()
    expect(calls).toHaveLength(0)

    await user.clear(field)
    await user.click(field)
    await user.paste('a'.repeat(1800))
    await user.click(screen.getByRole('button', { name: 'Invia candidatura' }))
    expect(await screen.findByText(/Candidatura inviata/)).toBeInTheDocument()
    expect(calls).toHaveLength(1)
  })

  it('a candidatura riuscita manda il messaggio senza spazi ai bordi e offre «Apri la chat» verso la conversazione', async () => {
    const calls: Request[] = []
    server.use(applicationSent({ conversationId: 'conv-9', messageId: 'm1' }, calls))
    const user = renderForm()

    await user.type(screen.getByLabelText("Messaggio per l'autore"), '  Suono il basso da dieci anni  ')
    await user.click(screen.getByRole('button', { name: 'Invia candidatura' }))

    expect(await screen.findByText('Candidatura inviata. Puoi continuare la conversazione in chat.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Apri la chat' })).toHaveAttribute('href', '/chat/conv-9')
    expect(screen.queryByRole('button', { name: 'Invia candidatura' })).not.toBeInTheDocument()
    expect(new URL(calls[0].url).pathname).toBe('/api/collab-posts/a1/applications')
    expect(await calls[0].json()).toEqual({ message: 'Suono il basso da dieci anni' })
  })

  it.each([
    [409, 'COLLAB_CLOSED', "L'annuncio è chiuso e non accetta più candidature."],
    [400, 'CANNOT_APPLY_OWN_POST', 'Non puoi candidarti al tuo stesso annuncio.'],
    [429, 'TOO_MANY_REQUESTS', 'Troppi tentativi: attendi un momento e riprova.'],
  ])('%i %s mostra il testo del codice e lascia il messaggio scritto, senza «Apri la chat»', async (status, code, text) => {
    server.use(applicationRejected(status, code))
    const user = renderForm()

    await user.type(screen.getByLabelText("Messaggio per l'autore"), 'Ciao, ci sono')
    await user.click(screen.getByRole('button', { name: 'Invia candidatura' }))

    expect(await screen.findByText(text)).toBeInTheDocument()
    expect(screen.getByLabelText("Messaggio per l'autore")).toHaveValue('Ciao, ci sono')
    expect(screen.queryByRole('link', { name: 'Apri la chat' })).not.toBeInTheDocument()
  })

  it("durante l'invio il pulsante è spento, così la candidatura non parte due volte", async () => {
    server.use(
      http.post('*/api/collab-posts/:id/applications', async () => {
        await delay(100)
        return HttpResponse.json({ conversationId: 'c1', messageId: 'm1' }, { status: 201 })
      }),
    )
    const user = renderForm()

    await user.type(screen.getByLabelText("Messaggio per l'autore"), 'Ciao')
    await user.click(screen.getByRole('button', { name: 'Invia candidatura' }))

    expect(screen.getByRole('button', { name: 'Invia candidatura' })).toBeDisabled()
    await screen.findByText(/Candidatura inviata/)
  })

  it("un anonimo che invia va all'accesso e la pagina d'origine è ricordata; il server non è chiamato", async () => {
    const calls: Request[] = []
    server.use(applicationSent({ conversationId: 'c1', messageId: 'm1' }, calls))
    const user = renderForm({ loggedIn: false })

    await user.type(screen.getByLabelText("Messaggio per l'autore"), 'Ciao')
    await user.click(screen.getByRole('button', { name: 'Invia candidatura' }))

    const location = await screen.findByTestId('location')
    expect(location.textContent).toBe(`${ROUTES.login}|{"from":"/collab/a1","loginRequired":true}`)
    expect(calls).toHaveLength(0)
  })
})
