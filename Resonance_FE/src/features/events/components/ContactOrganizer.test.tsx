import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/app/routes'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeConcert, makeIndieEvent } from '@/test/fixtures/events'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import { contactRejected, contactSent, type ContactKind } from '@/test/handlers/events'
import { server } from '@/test/server'
import type { IndieEventResponse, OfficialConcertResponse } from '@/types/events'
import { ContactOrganizer } from './ContactOrganizer'

// Modulo «Contatta l'organizzatore» nel dettaglio di concerti e indie event (progettazione, sezione 6.6, decisione 69):
// messaggio 1–1800 con contatore, controlli del client prima del server, esito con «Apri la chat», errori EVENT_CLOSED,
// CANNOT_CONTACT_OWN_EVENT e TOO_MANY_REQUESTS con i testi dei loro codici; un anonimo passa dall'accesso. Il modulo
// non c'è per il proprio evento né per un evento già iniziato.
function LocationProbe() {
  const location = useLocation()
  return <p data-testid="location">{location.pathname + '|' + JSON.stringify(location.state)}</p>
}

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString()

const concert = (overrides: Partial<OfficialConcertResponse> = {}) =>
  makeConcert({ id: 'c1', eventDate: inDays(30), ...overrides })
const indie = (overrides: Partial<IndieEventResponse> = {}) =>
  makeIndieEvent({ id: 'e1', eventDate: inDays(30), ...overrides })

type Props = { kind: 'official'; event: OfficialConcertResponse } | { kind: 'indie'; event: IndieEventResponse }

function renderForm(props: Props, { loggedIn = true }: { loggedIn?: boolean } = {}) {
  const store = makeStore()
  if (loggedIn) store.dispatch(sessionStarted(makeLoginResponse({ user: makeMe({ id: 'me-id' }) })))
  const router = createMemoryRouter(
    [
      {
        path: '/eventi/:id',
        element: (
          <>
            <ContactOrganizer {...props} />
            <LocationProbe />
          </>
        ),
      },
      { path: ROUTES.login, element: <LocationProbe /> },
    ],
    { initialEntries: ['/eventi/c1'] },
  )
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
  return userEvent.setup()
}

const officialProps = (overrides: Partial<OfficialConcertResponse> = {}): Props => ({
  kind: 'official',
  event: concert(overrides),
})

const field = () => screen.getByLabelText("Messaggio per l'organizzatore")
const submit = () => screen.getByRole('button', { name: 'Invia messaggio' })

describe('ContactOrganizer · modulo', () => {
  it("mostra il titolo, il campo con il contatore e «Invia messaggio»", () => {
    renderForm(officialProps())

    expect(screen.getByRole('heading', { name: "Contatta l'organizzatore" })).toBeInTheDocument()
    expect(field()).toBeInTheDocument()
    expect(screen.getByText('0 / 1800')).toBeInTheDocument()
    expect(submit()).toBeInTheDocument()
  })

  it('il contatore segue quello che si scrive', async () => {
    const user = renderForm(officialProps())

    await user.type(field(), 'Ciao')

    expect(screen.getByText('4 / 1800')).toBeInTheDocument()
  })

  it('un messaggio vuoto o di soli spazi non chiama il server', async () => {
    const calls: Request[] = []
    server.use(contactSent('official', { conversationId: 'c1', messageId: 'm1' }, calls))
    const user = renderForm(officialProps())

    await user.type(field(), '   ')
    await user.click(submit())

    expect(screen.getByText('Scrivi il messaggio.')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('oltre 1800 caratteri è rifiutato nel client, a 1800 passa', async () => {
    const calls: Request[] = []
    server.use(contactSent('official', { conversationId: 'c1', messageId: 'm1' }, calls))
    const user = renderForm(officialProps())

    await user.click(field())
    await user.paste('a'.repeat(1801))
    await user.click(submit())
    expect(screen.getByText('Il messaggio può avere al massimo 1800 caratteri.')).toBeInTheDocument()
    expect(calls).toHaveLength(0)

    await user.clear(field())
    await user.click(field())
    await user.paste('a'.repeat(1800))
    await user.click(submit())
    expect(await screen.findByText(/Messaggio inviato/)).toBeInTheDocument()
    expect(calls).toHaveLength(1)
  })
})

describe('ContactOrganizer · invio', () => {
  it.each<[ContactKind, Props, string]>([
    ['official', officialProps(), '/api/official-concerts/c1/contact'],
    ['indie', { kind: 'indie', event: indie() }, '/api/indie-events/e1/contact'],
  ])('%s: manda il messaggio senza spazi ai bordi e offre «Apri la chat»', async (kind, props, path) => {
    const calls: Request[] = []
    server.use(contactSent(kind, { conversationId: 'conv-5', messageId: 'm1' }, calls))
    const user = renderForm(props)

    await user.type(field(), '  Posso suonare prima di voi?  ')
    await user.click(submit())

    expect(await screen.findByText('Messaggio inviato. Puoi continuare la conversazione in chat.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Apri la chat' })).toHaveAttribute('href', '/chat/conv-5')
    expect(screen.queryByRole('button', { name: 'Invia messaggio' })).not.toBeInTheDocument()
    expect(new URL(calls[0].url).pathname).toBe(path)
    expect(await calls[0].json()).toEqual({ message: 'Posso suonare prima di voi?' })
  })

  it.each([
    [409, 'EVENT_CLOSED', "L'evento è già iniziato: non si può più contattare l'organizzatore."],
    [400, 'CANNOT_CONTACT_OWN_EVENT', "Non puoi contattare l'organizzatore del tuo stesso evento."],
    [429, 'TOO_MANY_REQUESTS', 'Troppi tentativi: attendi un momento e riprova.'],
  ])('%i %s mostra il testo del codice e lascia il messaggio scritto, senza «Apri la chat»', async (status, code, text) => {
    server.use(contactRejected('official', status, code))
    const user = renderForm(officialProps())

    await user.type(field(), 'Ciao, ci sono')
    await user.click(submit())

    expect(await screen.findByText(text)).toBeInTheDocument()
    expect(field()).toHaveValue('Ciao, ci sono')
    expect(screen.queryByRole('link', { name: 'Apri la chat' })).not.toBeInTheDocument()
  })

  it("durante l'invio il pulsante è spento, così il messaggio non parte due volte", async () => {
    server.use(
      http.post('*/api/official-concerts/:id/contact', async () => {
        await delay(100)
        return HttpResponse.json({ conversationId: 'c1', messageId: 'm1' }, { status: 201 })
      }),
    )
    const user = renderForm(officialProps())

    await user.type(field(), 'Ciao')
    await user.click(submit())

    expect(submit()).toBeDisabled()
    await screen.findByText(/Messaggio inviato/)
  })

  it("un anonimo che invia va all'accesso e la pagina d'origine è ricordata; il server non è chiamato", async () => {
    const calls: Request[] = []
    server.use(contactSent('official', { conversationId: 'c1', messageId: 'm1' }, calls))
    const user = renderForm(officialProps(), { loggedIn: false })

    await user.type(field(), 'Ciao')
    await user.click(submit())

    const location = await screen.findByTestId('location')
    expect(location.textContent).toBe(`${ROUTES.login}|{"from":"/eventi/c1","loginRequired":true}`)
    expect(calls).toHaveLength(0)
  })
})

describe('ContactOrganizer · quando non compare', () => {
  it('per il proprio concerto non compare', () => {
    renderForm(officialProps({ host: { id: 'me-id', displayName: 'Io', avatarUrl: null } }))
    expect(screen.queryByRole('heading', { name: "Contatta l'organizzatore" })).not.toBeInTheDocument()
  })

  it('per il proprio indie event non compare', () => {
    renderForm({ kind: 'indie', event: indie({ musician: { id: 'me-id', displayName: 'Io', avatarUrl: null } }) })
    expect(screen.queryByRole('heading', { name: "Contatta l'organizzatore" })).not.toBeInTheDocument()
  })

  it('per un evento già iniziato non compare', () => {
    renderForm(officialProps({ eventDate: inDays(-1) }))
    expect(screen.queryByRole('heading', { name: "Contatta l'organizzatore" })).not.toBeInTheDocument()
  })

  it('per un evento di un altro ancora da venire compare anche a un anonimo', () => {
    renderForm(officialProps(), { loggedIn: false })
    expect(screen.getByRole('heading', { name: "Contatta l'organizzatore" })).toBeInTheDocument()
  })
})
