import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/app/routes'
import { makeStore } from '@/app/store'
import type { EventKind } from '@/components/map'
import { makeConcert, makeIndieEvent, makePage } from '@/test/fixtures/events'
import {
  concertDeleted,
  concertDeleteRejected,
  indieDeleted,
  indiePublishRejected,
  myConcertsFound,
  myConcertsRejected,
  myIndieFound,
} from '@/test/handlers/events'
import { server } from '@/test/server'
import { MyEventsTab } from './MyEventsTab'

// Schede «Concerti» e «Indie event» dell'area personale: elenco dei propri eventi (`/mine`) con etichette «Bozza» e
// «Concluso», «Pubblica» per le bozze, «Cancella» con conferma e motivo facoltativo, avvisi di esito, messaggi dei
// codici d'errore, stato vuoto, «Carica altri» e «Riprova». Le date sono nel 2099 o nel 2001 per non dipendere dall'oggi.
const FUTURE = '2099-05-01T20:00:00Z'
const PAST = '2001-05-01T20:00:00Z'

function renderTab(kind: EventKind) {
  const router = createMemoryRouter([{ path: '*', element: <MyEventsTab kind={kind} /> }], { initialEntries: ['/'] })
  render(
    <Provider store={makeStore()}>
      <RouterProvider router={router} />
    </Provider>,
  )
  return userEvent.setup()
}

const rowOf = (title: string) => screen.getByRole('article', { name: title })

describe('MyEventsTab · concerti', () => {
  it('elenca i concerti con titolo che porta al dettaglio e locale, senza «Pubblica»', async () => {
    server.use(myConcertsFound([makePage([makeConcert({ id: 'c1', title: 'Serata rock', eventDate: FUTURE })])]))
    renderTab('official')

    const row = await screen.findByRole('article', { name: 'Serata rock' })

    expect(within(row).getByRole('link', { name: 'Serata rock' })).toHaveAttribute('href', '/concerti/c1')
    expect(within(row).getByText('Viper Theatre')).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Cancella: Serata rock' })).toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: /^Pubblica/ })).not.toBeInTheDocument()
    expect(within(row).queryByText('Concluso')).not.toBeInTheDocument()
  })

  it("un concerto già passato ha l'etichetta «Concluso»", async () => {
    server.use(myConcertsFound([makePage([makeConcert({ title: 'Vecchio', eventDate: PAST })])]))
    renderTab('official')

    expect(within(await screen.findByRole('article', { name: 'Vecchio' })).getByText('Concluso')).toBeInTheDocument()
  })

  it('senza concerti mostra lo stato vuoto con il collegamento a «Pubblica evento»', async () => {
    server.use(myConcertsFound([makePage([])]))
    renderTab('official')

    expect(await screen.findByText('Non sono ancora presenti eventi pubblicati.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pubblica evento' })).toHaveAttribute('href', ROUTES.newConcert)
  })

  it('«Cancella» apre la conferma; «Annulla» la chiude senza chiamare il server', async () => {
    const calls: Request[] = []
    server.use(
      myConcertsFound([makePage([makeConcert({ title: 'Serata rock', eventDate: FUTURE })])]),
      concertDeleted(calls),
    )
    const user = renderTab('official')

    await user.click(await screen.findByRole('button', { name: 'Cancella: Serata rock' }))
    expect(screen.getByRole('dialog', { name: "Cancellare l'evento?" })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Annulla' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(calls).toHaveLength(0)
  })

  it('conferma senza motivo: DELETE senza body, avviso «Evento cancellato.» e la riga sparisce', async () => {
    const calls: Request[] = []
    let deleted = false
    server.use(
      http.get('*/api/official-concerts/mine', () =>
        HttpResponse.json(makePage(deleted ? [] : [makeConcert({ id: 'c1', title: 'Serata rock', eventDate: FUTURE })])),
      ),
      http.delete('*/api/official-concerts/:id', ({ request }) => {
        deleted = true
        calls.push(request.clone())
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = renderTab('official')

    await user.click(await screen.findByRole('button', { name: 'Cancella: Serata rock' }))
    await user.click(screen.getByRole('button', { name: 'Cancella evento' }))

    expect(await screen.findByText('Evento cancellato.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Serata rock' })).not.toBeInTheDocument())
    expect(new URL(calls[0].url).pathname).toBe('/api/official-concerts/c1')
    expect(await calls[0].text()).toBe('')
  })

  it('conferma con un motivo: lo manda nel body', async () => {
    const calls: Request[] = []
    server.use(
      myConcertsFound([makePage([makeConcert({ title: 'Serata rock', eventDate: FUTURE })])]),
      concertDeleted(calls),
    )
    const user = renderTab('official')

    await user.click(await screen.findByRole('button', { name: 'Cancella: Serata rock' }))
    await user.type(screen.getByLabelText('Motivo (facoltativo)'), 'Data sbagliata')
    await user.click(screen.getByRole('button', { name: 'Cancella evento' }))

    await screen.findByText('Evento cancellato.')
    expect(await calls[0].json()).toEqual({ reason: 'Data sbagliata' })
  })

  it('un errore del server nella cancellazione si mostra con il messaggio del codice', async () => {
    server.use(
      myConcertsFound([makePage([makeConcert({ title: 'Serata rock', eventDate: FUTURE })])]),
      concertDeleteRejected(403, 'NOT_OWNER'),
    )
    const user = renderTab('official')

    await user.click(await screen.findByRole('button', { name: 'Cancella: Serata rock' }))
    await user.click(screen.getByRole('button', { name: 'Cancella evento' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Solo chi l'ha creato può farlo.")
    expect(screen.queryByText('Evento cancellato.')).not.toBeInTheDocument()
  })

  it('«Carica altri» accoda la pagina successiva', async () => {
    const first = makeConcert({ id: 'c1', title: 'Primo', eventDate: FUTURE })
    const second = makeConcert({ id: 'c2', title: 'Secondo', eventDate: FUTURE })
    server.use(myConcertsFound([makePage([first], { totalPages: 2 }), makePage([second], { page: 1, totalPages: 2 })]))
    const user = renderTab('official')
    await screen.findByRole('article', { name: 'Primo' })

    await user.click(screen.getByRole('button', { name: 'Carica altri' }))

    expect(await screen.findByRole('article', { name: 'Secondo' })).toBeInTheDocument()
    expect(rowOf('Primo')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Carica altri' })).not.toBeInTheDocument()
  })

  it("un errore di caricamento mostra l'avviso e «Riprova»", async () => {
    server.use(myConcertsRejected(500, 'INTERNAL_ERROR'))
    const user = renderTab('official')

    expect(await screen.findByRole('alert')).toHaveTextContent('Si è verificato un problema imprevisto')
    server.use(myConcertsFound([makePage([makeConcert({ title: 'Serata rock', eventDate: FUTURE })])]))
    await user.click(screen.getByRole('button', { name: 'Riprova' }))

    expect(await screen.findByRole('article', { name: 'Serata rock' })).toBeInTheDocument()
  })
})

describe('MyEventsTab · indie event', () => {
  const draft = makeIndieEvent({ id: 'd1', title: 'Bozza serale', status: 'DRAFT', eventDate: FUTURE })
  const published = makeIndieEvent({ id: 'p1', title: 'Già fuori', status: 'PUBLISHED', eventDate: FUTURE })

  it("una bozza ha l'etichetta «Bozza» e il pulsante «Pubblica»; un pubblicato no", async () => {
    server.use(myIndieFound([makePage([draft, published])]))
    renderTab('indie')

    const draftRow = await screen.findByRole('article', { name: 'Bozza serale' })
    expect(within(draftRow).getByText('Bozza')).toBeInTheDocument()
    expect(within(draftRow).getByRole('button', { name: 'Pubblica: Bozza serale' })).toBeInTheDocument()
    const publishedRow = rowOf('Già fuori')
    expect(within(publishedRow).queryByText('Bozza')).not.toBeInTheDocument()
    expect(within(publishedRow).queryByRole('button', { name: /^Pubblica/ })).not.toBeInTheDocument()
    expect(within(publishedRow).getByRole('link', { name: 'Già fuori' })).toHaveAttribute('href', '/indie/p1')
  })

  it("lo stato vuoto rimanda al form dell'indie event", async () => {
    server.use(myIndieFound([makePage([])]))
    renderTab('indie')

    expect(await screen.findByText('Non sono ancora presenti eventi pubblicati.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pubblica evento' })).toHaveAttribute('href', ROUTES.newIndieEvent)
  })

  it('«Pubblica» pubblica la bozza, mostra «Evento pubblicato.» e la riga perde «Bozza»', async () => {
    const calls: Request[] = []
    let isPublished = false
    server.use(
      http.get('*/api/indie-events/mine', () =>
        HttpResponse.json(makePage([isPublished ? { ...draft, status: 'PUBLISHED' as const } : draft])),
      ),
      http.patch('*/api/indie-events/:id/publish', ({ request }) => {
        isPublished = true
        calls.push(request.clone())
        return HttpResponse.json({ ...draft, status: 'PUBLISHED' })
      }),
    )
    const user = renderTab('indie')

    await user.click(await screen.findByRole('button', { name: 'Pubblica: Bozza serale' }))

    expect(await screen.findByText('Evento pubblicato.')).toBeInTheDocument()
    expect(new URL(calls[0].url).pathname).toBe('/api/indie-events/d1/publish')
    await waitFor(() => expect(within(rowOf('Bozza serale')).queryByText('Bozza')).not.toBeInTheDocument())
  })

  it.each([
    [400, 'EVENT_DATE_PAST', "La data dell'evento è passata: scegline una futura."],
    [409, 'EVENT_ALREADY_PUBLISHED', "L'evento è già pubblicato."],
  ])('%i %s: avviso con il messaggio del codice, senza «Evento pubblicato.»', async (status, code, message) => {
    server.use(myIndieFound([makePage([draft])]), indiePublishRejected(status, code))
    const user = renderTab('indie')

    await user.click(await screen.findByRole('button', { name: 'Pubblica: Bozza serale' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.queryByText('Evento pubblicato.')).not.toBeInTheDocument()
  })

  it('«Cancella» di un indie event usa il suo endpoint', async () => {
    const calls: Request[] = []
    server.use(myIndieFound([makePage([published])]), indieDeleted(calls))
    const user = renderTab('indie')

    await user.click(await screen.findByRole('button', { name: 'Cancella: Già fuori' }))
    await user.click(screen.getByRole('button', { name: 'Cancella evento' }))

    await screen.findByText('Evento cancellato.')
    expect(new URL(calls[0].url).pathname).toBe('/api/indie-events/p1')
  })

  it("l'avviso di un'azione precedente sparisce quando ne parte un'altra", async () => {
    server.use(
      myIndieFound([makePage([draft])]),
      http.patch('*/api/indie-events/:id/publish', () => HttpResponse.json({ ...draft, status: 'PUBLISHED' })),
      indieDeleted(),
    )
    const user = renderTab('indie')
    await user.click(await screen.findByRole('button', { name: 'Pubblica: Bozza serale' }))
    await screen.findByText('Evento pubblicato.')

    await user.click(screen.getByRole('button', { name: 'Cancella: Bozza serale' }))
    await user.click(screen.getByRole('button', { name: 'Cancella evento' }))

    expect(await screen.findByText('Evento cancellato.')).toBeInTheDocument()
    expect(screen.queryByText('Evento pubblicato.')).not.toBeInTheDocument()
  })
})
