import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { makePage } from '@/test/fixtures/events'
import { makeFeedPost } from '@/test/fixtures/feed'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import { likeSet, myPostsFound, myPostsRejected, postDeleted } from '@/test/handlers/feed'
import { server } from '@/test/server'
import { MyPostsTab } from './MyPostsTab'

// Scheda «Post» dell'area personale: i propri post da /mine con like e «Cancella», stato vuoto con il link al feed,
// «Carica altri», «Riprova» e l'avviso dopo una cancellazione.
const ME = makeMe({ id: 'me-id', displayName: 'Io' })
const mine = (overrides = {}) =>
  makeFeedPost({ author: { id: ME.id, displayName: 'Io', avatarUrl: null }, ...overrides })

function renderTab() {
  const store = makeStore()
  store.dispatch(sessionStarted(makeLoginResponse({ user: ME })))
  const router = createMemoryRouter([{ path: '*', element: <MyPostsTab /> }], { initialEntries: ['/profilo'] })
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
  return userEvent.setup()
}

describe('MyPostsTab', () => {
  it('mostra i propri post, chiedendo /mine dalla pagina 0', async () => {
    const calls: Request[] = []
    server.use(myPostsFound([makePage([mine({ id: 'a', body: 'Primo mio post' }), mine({ id: 'b', body: 'Secondo' })])], calls))
    renderTab()

    expect(await screen.findByText('Primo mio post')).toBeInTheDocument()
    expect(screen.getByText('Secondo')).toBeInTheDocument()
    const url = new URL(calls[0].url)
    expect(url.pathname).toBe('/api/feed-posts/mine')
    expect(url.searchParams.get('page')).toBe('0')
  })

  it('non mostra la distanza (in /mine è sempre nulla)', async () => {
    server.use(myPostsFound([makePage([mine({ distanceKm: null })])]))
    renderTab()
    await screen.findAllByRole('article')

    expect(screen.queryByText(/ km$| m$/)).not.toBeInTheDocument()
  })

  it('senza post invita a scrivere dal feed', async () => {
    server.use(myPostsFound([makePage([])]))
    renderTab()

    expect(await screen.findByText('Non hai ancora scritto post.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Vai al feed' })).toHaveAttribute('href', '/feed')
  })

  it('«Carica altri» aggiunge la pagina dopo e sparisce all\'ultima', async () => {
    server.use(
      myPostsFound([
        makePage([mine({ id: 'a', body: 'Pagina uno' })], { totalPages: 2 }),
        makePage([mine({ id: 'b', body: 'Pagina due' })], { page: 1, totalPages: 2 }),
      ]),
    )
    const user = renderTab()
    await screen.findByText('Pagina uno')

    await user.click(screen.getByRole('button', { name: 'Carica altri' }))

    expect(await screen.findByText('Pagina due')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Carica altri' })).not.toBeInTheDocument()
  })

  it('con un errore mostra il messaggio e «Riprova»', async () => {
    server.use(myPostsRejected(500, 'INTERNAL_ERROR'))
    renderTab()

    expect(await screen.findByRole('alert')).toHaveTextContent('Si è verificato un problema imprevisto. Riprova tra poco.')
    expect(screen.getByRole('button', { name: 'Riprova' })).toBeInTheDocument()
  })

  it('il like funziona anche qui: il numero sale subito', async () => {
    server.use(myPostsFound([makePage([mine({ likesCount: 3, likedByMe: false })])]), likeSet({ likesCount: 4, likedByMe: true }, [], 200))
    const user = renderTab()

    await user.click(await screen.findByRole('button', { name: 'Mi piace' }))

    expect(await screen.findByRole('button', { name: 'Togli il mi piace' })).toHaveTextContent('4')
  })

  it('cancellare un post chiede conferma, avvisa e il post sparisce', async () => {
    let posts = [mine({ id: 'mio', body: 'Da cancellare' })]
    server.use(
      http.get('*/api/feed-posts/mine', () => HttpResponse.json(makePage(posts))),
      postDeleted(),
    )
    const user = renderTab()
    await screen.findByText('Da cancellare')
    posts = []

    await user.click(screen.getByRole('button', { name: /Cancella/ }))
    await user.click(await screen.findByRole('button', { name: 'Cancella post' }))

    expect(await screen.findByText('Post cancellato.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Da cancellare')).not.toBeInTheDocument())
    expect(await screen.findByText('Non hai ancora scritto post.')).toBeInTheDocument()
  })
})
