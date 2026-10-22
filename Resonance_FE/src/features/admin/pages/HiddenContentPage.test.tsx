import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/app/routes'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeHiddenContent } from '@/test/fixtures/admin'
import { makePage } from '@/test/fixtures/events'
import { makeLoginResponse, makeMe, makePublicUser } from '@/test/fixtures/users'
import {
  contentRestored,
  contentRestoreRejected,
  hiddenContentFound,
} from '@/test/handlers/admin'
import { publicUserFound } from '@/test/handlers/users'
import { server } from '@/test/server'
import { Component as HiddenContentPage } from './HiddenContentPage'

// Contenuti nascosti (progettazione, sezione 5.7): una scheda per tipo nell'indirizzo (?scheda=), righe con motivo e chi
// ha nascosto (il nome dell'admin da una chiamata per riga, «Eliminato dall'utente» senza chiamata), «Ripristina» con
// conferma e spento per ciò che ha cancellato il proprietario.
function Where() {
  const location = useLocation()
  return <p data-testid="where">{location.pathname + location.search}</p>
}

function renderHidden(entry: string = ROUTES.adminContent) {
  const store = makeStore()
  store.dispatch(sessionStarted(makeLoginResponse({ user: makeMe({ roles: ['FAN', 'ADMIN'] }) })))
  const router = createMemoryRouter(
    [
      {
        path: ROUTES.adminContent,
        element: (
          <>
            <HiddenContentPage />
            <Where />
          </>
        ),
      },
    ],
    { initialEntries: [entry] },
  )
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
  return { user: userEvent.setup(), store }
}

const ADMIN_ID = '66666666-6666-6666-6666-666666666666'
const concert = makeHiddenContent({ id: 'h-concert', title: 'Serata contestata', hiddenBy: ADMIN_ID })
const ownerDeleted = makeHiddenContent({
  id: 'h-owner',
  title: 'Evento cancellato',
  deletedByOwner: true,
  hiddenBy: '55555555-5555-5555-5555-555555555555',
  hiddenReason: null,
})
const typeOf = (call: Request) => new URL(call.url).pathname.split('/')[4]
const rowOf = (title: string) => within(screen.getByText(title).closest('tr') as HTMLElement)

describe('HiddenContentPage · schede', () => {
  it('apre «Concerti» di base e chiede solo i concerti', async () => {
    const calls: Request[] = []
    server.use(hiddenContentFound({ 'official-concerts': [makePage([concert])] }, calls), publicUserFound(makePublicUser()))
    renderHidden()

    expect(screen.getByRole('tab', { name: 'Concerti', selected: true })).toBeInTheDocument()
    expect(await screen.findByText('Serata contestata')).toBeInTheDocument()
    expect(calls.map(typeOf)).toEqual(['official-concerts'])
  })

  it('apre la scheda indicata nell’indirizzo e al clic cambia scheda e indirizzo', async () => {
    const calls: Request[] = []
    server.use(
      hiddenContentFound(
        { 'collab-posts': [makePage([makeHiddenContent({ id: 'h-collab', title: 'Cercasi batterista' })])], 'feed-posts': [makePage([])] },
        calls,
      ),
      publicUserFound(makePublicUser()),
    )
    const { user } = renderHidden(`${ROUTES.adminContent}?scheda=annunci`)

    expect(await screen.findByText('Cercasi batterista')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Annunci', selected: true })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Post' }))
    expect(await screen.findByText('Nessun contenuto nascosto')).toBeInTheDocument()
    expect(screen.getByTestId('where')).toHaveTextContent(`${ROUTES.adminContent}?scheda=post`)
    expect(calls.map(typeOf)).toEqual(['collab-posts', 'feed-posts'])
  })

  it('un valore sconosciuto apre «Concerti»', async () => {
    server.use(hiddenContentFound({ 'official-concerts': [makePage([concert])] }), publicUserFound(makePublicUser()))
    renderHidden(`${ROUTES.adminContent}?scheda=boh`)

    expect(await screen.findByText('Serata contestata')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Concerti', selected: true })).toBeInTheDocument()
  })
})

describe('HiddenContentPage · elenco', () => {
  it('mostra titolo, autore con il suo profilo, data, motivo e il nome dell’admin che ha nascosto', async () => {
    server.use(
      hiddenContentFound({ 'official-concerts': [makePage([concert])] }),
      http.get('*/api/users/:id', ({ params }) =>
        HttpResponse.json(makePublicUser({ id: String(params.id), displayName: 'Admin Bianchi' })),
      ),
    )
    renderHidden()

    await screen.findByText('Serata contestata')
    const row = rowOf('Serata contestata')
    expect(row.getByRole('link', { name: 'Anna Bianchi' })).toHaveAttribute('href', '/utenti/55555555-5555-5555-5555-555555555555')
    expect(row.getByText('Motivo: Contenuto offensivo')).toBeInTheDocument()
    expect(await row.findByText('Nascosto da Admin Bianchi')).toBeInTheDocument()
  })

  it('finché il nome non arriva, o se la chiamata fallisce, scrive «Nascosto da un admin»', async () => {
    server.use(
      hiddenContentFound({ 'official-concerts': [makePage([concert])] }),
      http.get('*/api/users/:id', () => HttpResponse.json({ status: 404, code: 'NOT_FOUND' }, { status: 404 })),
    )
    renderHidden()

    await screen.findByText('Serata contestata')
    expect(await rowOf('Serata contestata').findByText('Nascosto da un admin')).toBeInTheDocument()
  })

  it('un contenuto eliminato dal proprietario lo dice, senza cercare il profilo di chi l’ha nascosto', async () => {
    const profileCalls: Request[] = []
    server.use(
      hiddenContentFound({ 'official-concerts': [makePage([ownerDeleted])] }),
      publicUserFound(makePublicUser(), profileCalls),
    )
    renderHidden()

    await screen.findByText('Evento cancellato')
    const row = rowOf('Evento cancellato')
    expect(row.getByText('Eliminato dall\'utente')).toBeInTheDocument()
    expect(row.queryByText(/Motivo:/)).not.toBeInTheDocument()
    expect(profileCalls).toHaveLength(0)
  })

  it('passa alla pagina scelta', async () => {
    const calls: Request[] = []
    server.use(
      hiddenContentFound(
        {
          'official-concerts': [
            makePage([concert], { page: 0, totalPages: 2 }),
            makePage([makeHiddenContent({ id: 'h-2', title: 'Seconda pagina' })], { page: 1, totalPages: 2 }),
          ],
        },
        calls,
      ),
      publicUserFound(makePublicUser()),
    )
    const { user } = renderHidden()
    await screen.findByText('Serata contestata')

    await user.click(screen.getByRole('button', { name: 'Pagina 2' }))

    expect(await screen.findByText('Seconda pagina')).toBeInTheDocument()
    expect(new URL(calls[calls.length - 1].url).searchParams.get('page')).toBe('1')
  })

  it('mostra lo stato vuoto', async () => {
    server.use(hiddenContentFound({}))
    renderHidden()

    expect(await screen.findByText('Nessun contenuto nascosto')).toBeInTheDocument()
  })

  it('mostra l’errore del backend con «Riprova»', async () => {
    server.use(http.get('*/api/admin/moderation/:type/hidden', () => HttpResponse.json({ status: 500, code: 'INTERNAL_ERROR' }, { status: 500 })))
    renderHidden()

    expect(await screen.findByRole('alert')).toHaveTextContent('Si è verificato un problema imprevisto')
    expect(screen.getByRole('button', { name: 'Riprova' })).toBeInTheDocument()
  })
})

describe('HiddenContentPage · ripristino', () => {
  it('ripristina dopo la conferma, mostra l’avviso e ricarica l’elenco', async () => {
    let listed = [concert]
    const calls: Request[] = []
    server.use(
      http.get('*/api/admin/moderation/:type/hidden', () => HttpResponse.json(makePage(listed))),
      http.post('*/api/admin/moderation/:type/:id/restore', ({ request }) => {
        calls.push(request.clone())
        listed = []
        return new HttpResponse(null, { status: 204 })
      }),
      publicUserFound(makePublicUser()),
    )
    const { user, store } = renderHidden()
    await screen.findByText('Serata contestata')

    await user.click(rowOf('Serata contestata').getByRole('button', { name: /Ripristina/ }))
    const dialog = screen.getByRole('dialog', { name: 'Ripristinare il contenuto?' })
    expect(within(dialog).getByText('Tornerà visibile a tutti.')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
    await user.click(within(dialog).getByRole('button', { name: 'Ripristina' }))

    await waitFor(() => expect(calls).toHaveLength(1))
    expect(new URL(calls[0].url).pathname).toBe('/api/admin/moderation/official-concerts/h-concert/restore')
    await waitFor(() => expect(store.getState().confirmation.text).toBe('Contenuto ripristinato.'))
    expect(await screen.findByText('Nessun contenuto nascosto')).toBeInTheDocument()
  })

  it('con un rifiuto del backend mostra l’errore nella finestra e non conferma', async () => {
    server.use(
      hiddenContentFound({ 'official-concerts': [makePage([concert])] }),
      contentRestoreRejected(409, 'RESTORE_NOT_ALLOWED'),
      publicUserFound(makePublicUser()),
    )
    const { user, store } = renderHidden()
    await screen.findByText('Serata contestata')

    await user.click(rowOf('Serata contestata').getByRole('button', { name: /Ripristina/ }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Ripristina' }))

    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('Questo contenuto non si può ripristinare.')
    expect(store.getState().confirmation.text).toBeNull()
  })

  it('«Annulla» non chiama il backend', async () => {
    const calls: Request[] = []
    server.use(
      hiddenContentFound({ 'official-concerts': [makePage([concert])] }),
      contentRestored(calls),
      publicUserFound(makePublicUser()),
    )
    const { user } = renderHidden()
    await screen.findByText('Serata contestata')

    await user.click(rowOf('Serata contestata').getByRole('button', { name: /Ripristina/ }))
    await user.click(screen.getByRole('button', { name: 'Annulla' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(calls).toHaveLength(0)
  })

  it('per un contenuto eliminato dal proprietario «Ripristina» è spento con la spiegazione', async () => {
    server.use(hiddenContentFound({ 'official-concerts': [makePage([ownerDeleted])] }))
    renderHidden()
    await screen.findByText('Evento cancellato')

    const row = rowOf('Evento cancellato')
    expect(row.getByRole('button', { name: /Ripristina/ })).toBeDisabled()
    expect(row.getByText('Eliminato dall\'utente: non si può ripristinare.')).toBeInTheDocument()
  })
})
