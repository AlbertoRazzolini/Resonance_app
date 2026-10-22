import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupListeners } from '@reduxjs/toolkit/query'
import { http, HttpResponse } from 'msw'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { friendsPath } from '@/app/routes'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { makePage } from '@/test/fixtures/events'
import { makeFriendship } from '@/test/fixtures/friends'
import { makeLoginResponse } from '@/test/fixtures/users'
import { friendshipActionSucceeds, friendshipsFound } from '@/test/handlers/friends'
import { server } from '@/test/server'
import { setViewportWidth } from '@/test/viewport'
import type { FriendshipResponse } from '@/types/friends'
import { NotificationBell } from './NotificationBell'

// Campanella: il numero delle richieste di amicizia in attesa (da 1 a «9+») viene da una sola chiamata, si ricarica ad
// apertura, al ritorno sulla scheda e dopo ogni azione, mai a intervalli. Il pannello mostra 5 righe sotto i 768 px e
// 10 da tablet in su, con «Vedi tutte» solo se ce ne sono di più.
function request(n: number): FriendshipResponse {
  return makeFriendship({
    id: `f${n}`,
    status: 'INCOMING',
    otherUser: { id: `u${n}`, displayName: `Persona ${n}`, avatarUrl: null },
  })
}

const requests = (count: number) => Array.from({ length: count }, (_, i) => request(i + 1))

/** Pagina di richieste in attesa: il conteggio vero è `total`, anche se le righe sono meno. */
const pending = (rows: FriendshipResponse[], total = rows.length) =>
  makePage(rows, { totalElements: total })

// `setupListeners` si attiva una volta sola per modulo: va staccato a fine prova, o il prossimo store non ascolterebbe
let stopListening: () => void = () => {}
afterEach(() => stopListening())

function renderBell() {
  const store = makeStore()
  store.dispatch(sessionStarted(makeLoginResponse()))
  stopListening = setupListeners(store.dispatch)
  render(
    <Provider store={store}>
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    </Provider>,
  )
  return { user: userEvent.setup(), store }
}

const bell = () => screen.getByRole('button', { name: /^Notifiche/ })

describe('NotificationBell · numero', () => {
  it('senza richieste non mostra nessun numero', async () => {
    const calls: Request[] = []
    server.use(friendshipsFound({ INCOMING: [pending([])] }, calls))
    renderBell()

    await waitFor(() => expect(calls).toHaveLength(1))
    expect(bell()).toHaveAccessibleName('Notifiche')
    expect(screen.queryByTestId('bell-count')).not.toBeInTheDocument()
  })

  it('con 3 richieste mostra 3 e lo dice anche ai lettori di schermo', async () => {
    server.use(friendshipsFound({ INCOMING: [pending(requests(3))] }))
    renderBell()

    expect(await screen.findByTestId('bell-count')).toHaveTextContent('3')
    expect(bell()).toHaveAccessibleName('Notifiche: 3 richieste di amicizia in attesa')
  })

  it('con più di 9 richieste mostra «9+»', async () => {
    server.use(friendshipsFound({ INCOMING: [pending(requests(10), 12)] }))
    renderBell()

    expect(await screen.findByTestId('bell-count')).toHaveTextContent('9+')
    expect(bell()).toHaveAccessibleName('Notifiche: 12 richieste di amicizia in attesa')
  })

  it('con 9 richieste mostra 9, senza il più', async () => {
    server.use(friendshipsFound({ INCOMING: [pending(requests(9))] }))
    renderBell()

    expect(await screen.findByTestId('bell-count')).toHaveTextContent(/^9$/)
  })

  it('chiede una sola volta le richieste ricevute, 10 righe, senza polling', async () => {
    const calls: Request[] = []
    server.use(friendshipsFound({ INCOMING: [pending(requests(2))] }, calls))
    renderBell()

    await screen.findByTestId('bell-count')
    await new Promise((resolve) => setTimeout(resolve, 600))

    expect(calls).toHaveLength(1)
    const params = new URL(calls[0].url).searchParams
    expect(params.get('type')).toBe('INCOMING')
    expect(params.get('size')).toBe('10')
    expect(params.get('page')).toBe('0')
  })

  it('un errore del server non lascia un numero sbagliato: nessun numero', async () => {
    server.use(http.get('*/api/friendships', () => HttpResponse.json({}, { status: 500 })))
    renderBell()

    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(screen.queryByTestId('bell-count')).not.toBeInTheDocument()
  })
})

describe('NotificationBell · ricarica', () => {
  it('apre il pannello e rilegge le richieste', async () => {
    const calls: Request[] = []
    server.use(friendshipsFound({ INCOMING: [pending(requests(1))] }, calls))
    const { user } = renderBell()
    await screen.findByTestId('bell-count')

    await user.click(bell())

    await waitFor(() => expect(calls).toHaveLength(2))
  })

  it('al ritorno sulla scheda del browser rilegge le richieste', async () => {
    const calls: Request[] = []
    server.use(friendshipsFound({ INCOMING: [pending(requests(1))] }, calls))
    renderBell()
    await screen.findByTestId('bell-count')

    act(() => {
      window.dispatchEvent(new Event('focus'))
    })

    await waitFor(() => expect(calls).toHaveLength(2))
  })

  it('dopo aver accettato una richiesta il numero scende', async () => {
    let remaining = requests(2)
    server.use(
      http.get('*/api/friendships', () => HttpResponse.json(pending(remaining))),
      friendshipActionSucceeds('accept', [], makeFriendship()),
    )
    const { user } = renderBell()
    await waitFor(() => expect(screen.getByTestId('bell-count')).toHaveTextContent('2'))

    await user.click(bell())
    remaining = [request(2)]
    await user.click(await screen.findByRole('button', { name: 'Accetta: Persona 1' }))

    await waitFor(() => expect(screen.getByTestId('bell-count')).toHaveTextContent('1'))
  })
})

describe('NotificationBell · pannello', () => {
  it('ha il titolo «Notifiche» e una riga per richiesta con nome, Accetta e Rifiuta', async () => {
    server.use(friendshipsFound({ INCOMING: [pending(requests(2))] }))
    const { user } = renderBell()
    await screen.findByTestId('bell-count')

    await user.click(bell())

    const panel = await screen.findByRole('region', { name: 'Notifiche' })
    expect(within(panel).getByRole('heading', { name: 'Notifiche' })).toBeInTheDocument()
    expect(within(panel).getByRole('link', { name: 'Persona 1' })).toHaveAttribute('href', '/utenti/u1')
    expect(within(panel).getByRole('button', { name: 'Accetta: Persona 1' })).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Rifiuta: Persona 2' })).toBeInTheDocument()
  })

  it('senza richieste dice «Nessuna richiesta in attesa.»', async () => {
    server.use(friendshipsFound({ INCOMING: [pending([])] }))
    const { user } = renderBell()
    await waitFor(() => expect(bell()).toBeEnabled())

    await user.click(bell())

    expect(await screen.findByText('Nessuna richiesta in attesa.')).toBeInTheDocument()
  })

  it('da tablet in su mostra fino a 10 righe e «Vedi tutte» se ce ne sono di più', async () => {
    setViewportWidth(1280)
    server.use(friendshipsFound({ INCOMING: [pending(requests(10), 12)] }))
    const { user } = renderBell()
    await screen.findByTestId('bell-count')

    await user.click(bell())

    const panel = await screen.findByRole('region', { name: 'Notifiche' })
    expect(within(panel).getAllByRole('listitem')).toHaveLength(10)
    expect(within(panel).getByRole('link', { name: 'Vedi tutte' })).toHaveAttribute('href', friendsPath('ricevute'))
  })

  it('sotto i 768 px mostra solo le 5 più recenti', async () => {
    setViewportWidth(375)
    server.use(friendshipsFound({ INCOMING: [pending(requests(10), 12)] }))
    const { user } = renderBell()
    await screen.findByTestId('bell-count')

    await user.click(bell())

    const panel = await screen.findByRole('region', { name: 'Notifiche' })
    const names = within(panel)
      .getAllByRole('listitem')
      .map((item) => within(item).getByRole('link', { name: /^Persona/ }).textContent)
    expect(names).toEqual(['Persona 1', 'Persona 2', 'Persona 3', 'Persona 4', 'Persona 5'])
    expect(within(panel).getByRole('link', { name: 'Vedi tutte' })).toBeInTheDocument()
  })

  it('con 5 richieste su telefono mostra tutte e cinque senza «Vedi tutte»', async () => {
    setViewportWidth(375)
    server.use(friendshipsFound({ INCOMING: [pending(requests(5))] }))
    const { user } = renderBell()
    await screen.findByTestId('bell-count')

    await user.click(bell())

    const panel = await screen.findByRole('region', { name: 'Notifiche' })
    expect(within(panel).getAllByRole('listitem')).toHaveLength(5)
    expect(within(panel).queryByRole('link', { name: 'Vedi tutte' })).not.toBeInTheDocument()
  })
})
