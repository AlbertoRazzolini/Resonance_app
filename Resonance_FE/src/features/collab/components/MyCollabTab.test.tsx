import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/app/routes'
import { makeStore } from '@/app/store'
import { makeCollabPost } from '@/test/fixtures/collab'
import { makePage } from '@/test/fixtures/events'
import {
  collabClosed,
  collabCloseRejected,
  collabDeleted,
  collabDeleteRejected,
  myCollabFound,
  myCollabRejected,
} from '@/test/handlers/collab'
import { server } from '@/test/server'
import { MyCollabTab } from './MyCollabTab'

// Scheda «Annunci» dell'area personale: i propri annunci (`/mine`), chiusi compresi, con lo stato «Aperto» o «Chiuso»,
// «Apri», «Chiudi» (solo se aperto) e «Cancella» con conferma, avvisi di esito, messaggi dei codici d'errore, stato
// vuoto, «Carica altri» e «Riprova».
function renderTab() {
  const router = createMemoryRouter([{ path: '*', element: <MyCollabTab /> }], { initialEntries: ['/'] })
  render(
    <Provider store={makeStore()}>
      <RouterProvider router={router} />
    </Provider>,
  )
  return userEvent.setup()
}

const rowOf = (title: string) => screen.getByRole('article', { name: title })

describe('MyCollabTab · elenco', () => {
  it('elenca gli annunci con ruolo, data numerica, stato e «Apri» verso il dettaglio', async () => {
    server.use(
      myCollabFound([
        makePage([
          makeCollabPost({
            id: 'a1',
            title: 'Cercasi bassista',
            roleNeeded: 'Bassista',
            isOpen: true,
            createdAt: '2026-10-20T12:00:00Z',
          }),
        ]),
      ]),
    )
    renderTab()

    const row = await screen.findByRole('article', { name: 'Cercasi bassista' })

    expect(within(row).getByText('Bassista')).toBeInTheDocument()
    expect(within(row).getByText('20/10/2026')).toBeInTheDocument()
    expect(within(row).getByText('Aperto')).toBeInTheDocument()
    expect(within(row).getByRole('link', { name: 'Apri: Cercasi bassista' })).toHaveAttribute('href', '/collab/a1')
    expect(within(row).getByRole('button', { name: 'Chiudi: Cercasi bassista' })).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Cancella: Cercasi bassista' })).toBeInTheDocument()
  })

  it('un annuncio chiuso è nell\'elenco con lo stato «Chiuso» e senza «Chiudi»', async () => {
    server.use(myCollabFound([makePage([makeCollabPost({ title: 'Già chiuso', isOpen: false })])]))
    renderTab()

    const row = await screen.findByRole('article', { name: 'Già chiuso' })

    expect(within(row).getByText('Chiuso')).toBeInTheDocument()
    expect(within(row).queryByText('Aperto')).not.toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: /^Chiudi/ })).not.toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Cancella: Già chiuso' })).toBeInTheDocument()
  })

  it('senza annunci mostra lo stato vuoto con il collegamento a «Pubblica annuncio»', async () => {
    server.use(myCollabFound([makePage([])]))
    renderTab()

    expect(await screen.findByText('Non hai ancora pubblicato annunci.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pubblica annuncio' })).toHaveAttribute('href', ROUTES.newCollab)
  })

  it('«Carica altri» accoda la pagina successiva', async () => {
    server.use(
      myCollabFound([
        makePage([makeCollabPost({ id: 'a', title: 'Primo' })], { totalPages: 2 }),
        makePage([makeCollabPost({ id: 'b', title: 'Secondo' })], { page: 1, totalPages: 2 }),
      ]),
    )
    const user = renderTab()
    await screen.findByRole('article', { name: 'Primo' })

    await user.click(screen.getByRole('button', { name: 'Carica altri' }))

    expect(await screen.findByRole('article', { name: 'Secondo' })).toBeInTheDocument()
    expect(rowOf('Primo')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Carica altri' })).not.toBeInTheDocument()
  })

  it("un errore di caricamento mostra l'avviso e «Riprova»", async () => {
    server.use(myCollabRejected(500, 'INTERNAL_ERROR'))
    const user = renderTab()

    expect(await screen.findByRole('alert')).toHaveTextContent('Si è verificato un problema imprevisto')
    server.use(myCollabFound([makePage([makeCollabPost({ title: 'Ora c\'è' })])]))
    await user.click(screen.getByRole('button', { name: 'Riprova' }))

    expect(await screen.findByRole('article', { name: "Ora c'è" })).toBeInTheDocument()
  })
})

describe('MyCollabTab · chiusura', () => {
  it('«Chiudi» apre la conferma con l\'avviso sulla chat; «Annulla» la chiude senza chiamare il server', async () => {
    const calls: Request[] = []
    server.use(
      myCollabFound([makePage([makeCollabPost({ id: 'a1', title: 'Cercasi bassista' })])]),
      collabClosed(makeCollabPost({ isOpen: false }), calls),
    )
    const user = renderTab()

    await user.click(await screen.findByRole('button', { name: 'Chiudi: Cercasi bassista' }))
    const dialog = screen.getByRole('dialog', { name: "Chiudere l'annuncio?" })
    expect(dialog).toHaveTextContent('Chi non è tuo amico non potrà più scriverti in chat')
    await user.click(within(dialog).getByRole('button', { name: 'Annulla' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(calls).toHaveLength(0)
  })

  it('confermando chiude l\'annuncio, mostra «Annuncio chiuso.» e la riga passa a «Chiuso» senza «Chiudi»', async () => {
    const calls: Request[] = []
    let closed = false
    server.use(
      http.get('*/api/collab-posts/mine', () =>
        HttpResponse.json(makePage([makeCollabPost({ id: 'a1', title: 'Cercasi bassista', isOpen: !closed })])),
      ),
      http.patch('*/api/collab-posts/:id/close', ({ request }) => {
        closed = true
        calls.push(request.clone())
        return HttpResponse.json(makeCollabPost({ id: 'a1', isOpen: false }))
      }),
    )
    const user = renderTab()

    await user.click(await screen.findByRole('button', { name: 'Chiudi: Cercasi bassista' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Chiudi annuncio' }))

    expect(await screen.findByText('Annuncio chiuso.')).toBeInTheDocument()
    await waitFor(() => expect(within(rowOf('Cercasi bassista')).getByText('Chiuso')).toBeInTheDocument())
    expect(within(rowOf('Cercasi bassista')).queryByRole('button', { name: /^Chiudi/ })).not.toBeInTheDocument()
    expect(new URL(calls[0].url).pathname).toBe('/api/collab-posts/a1/close')
  })

  it('un errore alla chiusura mostra il messaggio del suo codice e nessun avviso di successo', async () => {
    server.use(
      myCollabFound([makePage([makeCollabPost({ title: 'Cercasi bassista' })])]),
      collabCloseRejected(403, 'NOT_OWNER'),
    )
    const user = renderTab()

    await user.click(await screen.findByRole('button', { name: 'Chiudi: Cercasi bassista' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Chiudi annuncio' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Solo chi l'ha creato può farlo.")
    expect(screen.queryByText('Annuncio chiuso.')).not.toBeInTheDocument()
  })
})

describe('MyCollabTab · cancellazione', () => {
  it('«Cancella» apre la conferma con il motivo facoltativo', async () => {
    server.use(myCollabFound([makePage([makeCollabPost({ title: 'Cercasi bassista' })])]))
    const user = renderTab()

    await user.click(await screen.findByRole('button', { name: 'Cancella: Cercasi bassista' }))

    const dialog = screen.getByRole('dialog', { name: "Cancellare l'annuncio?" })
    expect(within(dialog).getByLabelText('Motivo (facoltativo)')).toBeInTheDocument()
  })

  it('conferma senza motivo: DELETE senza body, avviso «Annuncio cancellato.» e la riga sparisce', async () => {
    const calls: Request[] = []
    let deleted = false
    server.use(
      http.get('*/api/collab-posts/mine', () =>
        HttpResponse.json(makePage(deleted ? [] : [makeCollabPost({ id: 'a1', title: 'Cercasi bassista' })])),
      ),
      http.delete('*/api/collab-posts/:id', ({ request }) => {
        deleted = true
        calls.push(request.clone())
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = renderTab()

    await user.click(await screen.findByRole('button', { name: 'Cancella: Cercasi bassista' }))
    await user.click(screen.getByRole('button', { name: 'Cancella annuncio' }))

    expect(await screen.findByText('Annuncio cancellato.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Cercasi bassista' })).not.toBeInTheDocument())
    expect(new URL(calls[0].url).pathname).toBe('/api/collab-posts/a1')
    expect(await calls[0].text()).toBe('')
  })

  it('conferma con un motivo: lo manda nel body', async () => {
    const calls: Request[] = []
    server.use(myCollabFound([makePage([makeCollabPost({ title: 'Cercasi bassista' })])]), collabDeleted(calls))
    const user = renderTab()

    await user.click(await screen.findByRole('button', { name: 'Cancella: Cercasi bassista' }))
    await user.type(screen.getByLabelText('Motivo (facoltativo)'), 'Trovato il bassista')
    await user.click(screen.getByRole('button', { name: 'Cancella annuncio' }))

    await screen.findByText('Annuncio cancellato.')
    expect(await calls[0].json()).toEqual({ reason: 'Trovato il bassista' })
  })

  it('un errore alla cancellazione mostra il messaggio del suo codice e nessun avviso di successo', async () => {
    server.use(
      myCollabFound([makePage([makeCollabPost({ title: 'Cercasi bassista' })])]),
      collabDeleteRejected(403, 'NOT_OWNER'),
    )
    const user = renderTab()

    await user.click(await screen.findByRole('button', { name: 'Cancella: Cercasi bassista' }))
    await user.click(screen.getByRole('button', { name: 'Cancella annuncio' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Solo chi l'ha creato può farlo.")
    expect(screen.queryByText('Annuncio cancellato.')).not.toBeInTheDocument()
  })
})
