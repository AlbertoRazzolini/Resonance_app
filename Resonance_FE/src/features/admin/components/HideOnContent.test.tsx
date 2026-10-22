import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/app/routes'
import { makeStore } from '@/app/store'
import { CollabCard } from '@/features/collab/components/CollabCard'
import { CollabDetail } from '@/features/collab/components/CollabDetail'
import { EventCard } from '@/features/events/components/EventCard'
import { EventDetail } from '@/features/events/components/EventDetail'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeCollabPost } from '@/test/fixtures/collab'
import { makeConcert, makeIndieEvent } from '@/test/fixtures/events'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import { contentHidden } from '@/test/handlers/admin'
import { server } from '@/test/server'
import type { Role } from '@/types/users'

// «Nascondi» sulle card degli elenchi e nei dettagli di concerti, indie event e annunci (progettazione, sezione 5.7): solo
// per gli admin, mai sui propri contenuti; dal dettaglio, a nascondimento riuscito, si torna all'elenco della sezione.
function renderWithRoles(ui: React.ReactElement, roles: Role[], extraRoutes: React.ReactElement[] = []) {
  const store = makeStore()
  store.dispatch(sessionStarted(makeLoginResponse({ user: makeMe({ roles }) })))
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/contenuto']}>
        <Routes>
          <Route path="/contenuto" element={ui} />
          {extraRoutes}
        </Routes>
      </MemoryRouter>
    </Provider>,
  )
  return userEvent.setup()
}

const ADMIN: Role[] = ['FAN', 'ADMIN']
const FAN: Role[] = ['FAN']
const own = { id: makeMe().id, displayName: 'Io', avatarUrl: null }

describe('«Nascondi» sulle card', () => {
  it.each([
    ['concerto', <EventCard key="c" kind="official" event={makeConcert({ title: 'Serata uno' })} />, 'Serata uno'],
    ['indie event', <EventCard key="i" kind="indie" event={makeIndieEvent({ title: 'Serata due' })} />, 'Serata due'],
    ['annuncio', <CollabCard key="a" post={makeCollabPost({ title: 'Cercasi basso' })} />, 'Cercasi basso'],
  ])('un admin lo vede sulla card del %s', (_name, card, title) => {
    renderWithRoles(card, ADMIN)
    expect(screen.getByRole('button', { name: `Nascondi ${title}` })).toBeInTheDocument()
  })

  it.each([
    ['concerto', <EventCard key="c" kind="official" event={makeConcert()} />],
    ['indie event', <EventCard key="i" kind="indie" event={makeIndieEvent()} />],
    ['annuncio', <CollabCard key="a" post={makeCollabPost()} />],
  ])('un FAN non lo vede sulla card del %s', (_name, card) => {
    renderWithRoles(card, FAN)
    expect(screen.queryByRole('button', { name: /^Nascondi/ })).not.toBeInTheDocument()
  })

  it.each([
    ['concerto', <EventCard key="c" kind="official" event={makeConcert({ host: own })} />],
    ['indie event', <EventCard key="i" kind="indie" event={makeIndieEvent({ musician: own })} />],
    ['annuncio', <CollabCard key="a" post={makeCollabPost({ musician: own })} />],
  ])('un admin non lo vede sui propri contenuti (%s)', (_name, card) => {
    renderWithRoles(card, ADMIN)
    expect(screen.queryByRole('button', { name: /^Nascondi/ })).not.toBeInTheDocument()
  })

  it('sulla card di un concerto nasconde il tipo giusto: official-concerts', async () => {
    const calls: Request[] = []
    server.use(contentHidden(calls))
    const user = renderWithRoles(<EventCard kind="official" event={makeConcert({ id: 'c1', title: 'Serata uno' })} />, ADMIN)

    await user.click(screen.getByRole('button', { name: 'Nascondi Serata uno' }))
    await user.type(screen.getByLabelText('Motivo'), 'Spam')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Nascondi' }))

    await waitFor(() => expect(calls).toHaveLength(1))
    expect(new URL(calls[0].url).pathname).toBe('/api/admin/moderation/official-concerts/c1/hide')
  })
})

describe('«Nascondi» nei dettagli', () => {
  it.each([
    ['concerto', <EventDetail key="c" kind="official" event={makeConcert({ title: 'Serata uno' })} />, 'Serata uno'],
    ['indie event', <EventDetail key="i" kind="indie" event={makeIndieEvent({ title: 'Serata due' })} />, 'Serata due'],
    ['annuncio', <CollabDetail key="a" post={makeCollabPost({ title: 'Cercasi basso' })} />, 'Cercasi basso'],
  ])('un admin lo vede nel dettaglio del %s, un FAN no', (_name, detail, title) => {
    const { unmount } = renderAndUnmount(detail, ADMIN)
    expect(screen.getByRole('button', { name: `Nascondi ${title}` })).toBeInTheDocument()
    unmount()

    renderWithRoles(detail, FAN)
    expect(screen.queryByRole('button', { name: /^Nascondi/ })).not.toBeInTheDocument()
  })

  it.each([
    ['concerto', 'official-concerts', <EventDetail key="c" kind="official" event={makeConcert({ id: 'x1', title: 'Serata uno' })} />, ROUTES.events],
    ['indie event', 'indie-events', <EventDetail key="i" kind="indie" event={makeIndieEvent({ id: 'x1', title: 'Serata uno' })} />, ROUTES.events],
    ['annuncio', 'collab-posts', <CollabDetail key="a" post={makeCollabPost({ id: 'x1', title: 'Serata uno' })} />, ROUTES.collab],
  ])('dal dettaglio del %s nasconde (%s) e torna all’elenco della sezione', async (_name, type, detail, listPath) => {
    const calls: Request[] = []
    server.use(contentHidden(calls))
    const user = renderWithRoles(detail, ADMIN, [<Route key="list" path={listPath} element={<p>Elenco della sezione</p>} />])

    await user.click(screen.getByRole('button', { name: 'Nascondi Serata uno' }))
    await user.type(screen.getByLabelText('Motivo'), 'Spam')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Nascondi' }))

    expect(await screen.findByText('Elenco della sezione')).toBeInTheDocument()
    expect(new URL(calls[0].url).pathname).toBe(`/api/admin/moderation/${type}/x1/hide`)
  })
})

/** Come `renderWithRoles`, ma restituisce `unmount` per provare lo stesso contenuto con due ruoli nello stesso test. */
function renderAndUnmount(ui: React.ReactElement, roles: Role[]) {
  const store = makeStore()
  store.dispatch(sessionStarted(makeLoginResponse({ user: makeMe({ roles }) })))
  return render(
    <Provider store={store}>
      <MemoryRouter>{ui}</MemoryRouter>
    </Provider>,
  )
}
