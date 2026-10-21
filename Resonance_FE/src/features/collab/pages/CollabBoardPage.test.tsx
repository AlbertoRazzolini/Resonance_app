import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/app/routes'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeCollabPost } from '@/test/fixtures/collab'
import { makePage } from '@/test/fixtures/events'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import { collabFound, collabRejected } from '@/test/handlers/collab'
import { server } from '@/test/server'
import type { MeResponse } from '@/types/users'
import { Component as CollabBoardPage } from './CollabBoardPage'

// Bacheca collab: aperta anche agli anonimi, annunci dal più recente con «Carica altri», «Pubblica annuncio» solo ai
// MUSICIAN, stato vuoto con l'invito solo per loro, «Riprova» su errore. La bacheca non mostra mai annunci chiusi.
function renderBoard(user?: MeResponse) {
  const store = makeStore()
  if (user) store.dispatch(sessionStarted(makeLoginResponse({ user })))
  const router = createMemoryRouter([{ path: ROUTES.collab, element: <CollabBoardPage /> }], {
    initialEntries: [ROUTES.collab],
  })
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
  return userEvent.setup()
}

const MUSICIAN = makeMe({ roles: ['MUSICIAN'] })

describe('CollabBoardPage · elenco', () => {
  it('mostra titolo e sottotitolo, e chiede solo la prima pagina', async () => {
    const calls: Request[] = []
    server.use(collabFound([makePage([makeCollabPost()])], calls))
    renderBoard()

    expect(screen.getByRole('heading', { level: 1, name: 'Collab' })).toBeInTheDocument()
    expect(screen.getByText('Annunci per progetti, musicisti e collaborazioni.')).toBeInTheDocument()
    await screen.findByRole('article', { name: 'Cercasi bassista per progetto post-rock' })
    expect(calls).toHaveLength(1)
    expect(new URL(calls[0].url).searchParams.get('page')).toBe('0')
  })

  it('la card mostra autore con il link al profilo, data numerica, luogo, ruolo, generi e il collegamento al dettaglio', async () => {
    server.use(
      collabFound([
        makePage([
          makeCollabPost({
            id: 'a1',
            title: 'Cercasi bassista',
            musician: { id: 'u1', displayName: 'Veleno Rosa', avatarUrl: null },
            roleNeeded: 'Bassista',
            location: 'Milano (NoLo)',
            genreTags: ['post-rock', 'noise'],
            createdAt: '2026-10-20T12:00:00Z',
          }),
        ]),
      ]),
    )
    renderBoard()

    const card = await screen.findByRole('article', { name: 'Cercasi bassista' })

    expect(within(card).getByRole('link', { name: 'Veleno Rosa' })).toHaveAttribute('href', '/utenti/u1')
    expect(within(card).getByText('20/10/2026')).toBeInTheDocument()
    expect(within(card).getByText('Milano (NoLo)')).toBeInTheDocument()
    expect(within(card).getByText('Bassista')).toBeInTheDocument()
    expect(within(card).getByText('post-rock')).toBeInTheDocument()
    expect(within(card).getByText('noise')).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: /Candidati \/ Scrivi/ })).toHaveAttribute('href', '/collab/a1')
  })

  it('senza luogo non scrive niente al suo posto', async () => {
    server.use(collabFound([makePage([makeCollabPost({ title: 'Senza luogo', location: null })])]))
    renderBoard()

    const card = await screen.findByRole('article', { name: 'Senza luogo' })

    expect(within(card).queryByText('null')).not.toBeInTheDocument()
    expect(card.querySelector('.rs-collab-card__location')).toBeNull()
  })

  it('il testo scritto dagli utenti resta testo: il codice HTML nel titolo e nella descrizione non crea elementi', async () => {
    server.use(
      collabFound([
        makePage([makeCollabPost({ title: '<b>grassetto</b>', description: '<img src=x onerror=alert(1)>' })]),
      ]),
    )
    renderBoard()

    const card = await screen.findByRole('article', { name: '<b>grassetto</b>' })

    expect(card.querySelector('b')).toBeNull()
    expect(card.querySelector('img[src="x"]')).toBeNull()
  })

  it('«Carica altri» accoda la pagina successiva senza duplicare', async () => {
    server.use(
      collabFound([
        makePage([makeCollabPost({ id: 'a', title: 'Primo' })], { totalPages: 2 }),
        makePage([makeCollabPost({ id: 'b', title: 'Secondo' })], { page: 1, totalPages: 2 }),
      ]),
    )
    const user = renderBoard()

    await screen.findByRole('article', { name: 'Primo' })
    await user.click(screen.getByRole('button', { name: 'Carica altri' }))

    expect(await screen.findByRole('article', { name: 'Secondo' })).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Carica altri' })).not.toBeInTheDocument()
  })
})

describe('CollabBoardPage · «Pubblica annuncio»', () => {
  it('un MUSICIAN vede il pulsante che porta alla creazione', async () => {
    server.use(collabFound([makePage([makeCollabPost()])]))
    renderBoard(MUSICIAN)

    expect(await screen.findByRole('link', { name: 'Pubblica annuncio' })).toHaveAttribute('href', ROUTES.newCollab)
  })

  it('un FAN non lo vede', async () => {
    server.use(collabFound([makePage([makeCollabPost()])]))
    renderBoard(makeMe({ roles: ['FAN'] }))

    await screen.findByRole('article')

    expect(screen.queryByRole('link', { name: 'Pubblica annuncio' })).not.toBeInTheDocument()
  })

  it('un anonimo non lo vede', async () => {
    server.use(collabFound([makePage([makeCollabPost()])]))
    renderBoard()

    await screen.findByRole('article')

    expect(screen.queryByRole('link', { name: 'Pubblica annuncio' })).not.toBeInTheDocument()
  })
})

describe('CollabBoardPage · stato vuoto ed errori', () => {
  it('senza annunci scrive «Nessun annuncio aperto.» e invita a pubblicare i MUSICIAN', async () => {
    server.use(collabFound([makePage([])]))
    renderBoard(MUSICIAN)

    expect(await screen.findByText('Nessun annuncio aperto.')).toBeInTheDocument()
    expect(screen.getByText('Pubblica il primo!')).toBeInTheDocument()
  })

  it("senza annunci un anonimo non riceve l'invito a pubblicare", async () => {
    server.use(collabFound([makePage([])]))
    renderBoard()

    expect(await screen.findByText('Nessun annuncio aperto.')).toBeInTheDocument()
    expect(screen.queryByText('Pubblica il primo!')).not.toBeInTheDocument()
  })

  it('un errore del server mostra il messaggio del suo codice e «Riprova» rilegge', async () => {
    server.use(collabRejected(500, 'INTERNAL_ERROR'))
    const user = renderBoard()

    expect(await screen.findByText('Si è verificato un problema imprevisto. Riprova tra poco.')).toBeInTheDocument()
    server.use(collabFound([makePage([makeCollabPost({ title: "Ora c'è" })])]))
    await user.click(screen.getByRole('button', { name: 'Riprova' }))

    expect(await screen.findByRole('article', { name: "Ora c'è" })).toBeInTheDocument()
  })
})
