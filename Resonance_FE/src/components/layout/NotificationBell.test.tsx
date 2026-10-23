import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupListeners } from '@reduxjs/toolkit/query'
import { http, HttpResponse } from 'msw'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { receiveLiveNotification } from '@/features/notifications/api/notificationsApi'
import { makePage } from '@/test/fixtures/events'
import { makeFriendship } from '@/test/fixtures/friends'
import { makeNotification, makeNotifications } from '@/test/fixtures/notifications'
import { makeLoginResponse } from '@/test/fixtures/users'
import { friendshipActionSucceeds, friendshipsFound } from '@/test/handlers/friends'
import {
  notificationPage,
  notificationReadSucceeds,
  notificationsFound,
  notificationsRejected,
  readAllSucceeds,
  unreadCountFound,
  unreadCountRejected,
} from '@/test/handlers/notifications'
import { server } from '@/test/server'
import type { LiveNotification } from '@/types/chat'
import type { NotificationResponse } from '@/types/notifications'
import { NotificationBell } from './NotificationBell'

// Campanella: il numero sull'icona sono le notifiche non lette del server (da 1 a «9+»), riletto ad apertura dell'app,
// all'apertura del pannello e al ritorno sulla scheda, mai a intervalli. Il pannello è un elenco unico dalla più recente,
// a pagine di 10 con «Carica altri», con le non lette evidenziate; il clic segna letta e porta al bersaglio.
// Una richiesta di amicizia ancora in attesa ha Accetta e Rifiuta nella sua riga.

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
const panel = () => screen.findByRole('region', { name: 'Notifiche' })

/** Registra elenco e numero: `rows` è la prima pagina, `unread` il numero delle non lette. */
function serve(rows: NotificationResponse[], unread: number, calls: { list?: Request[]; count?: Request[] } = {}) {
  server.use(
    notificationsFound([notificationPage(rows)], calls.list),
    unreadCountFound(unread, calls.count),
    friendshipsFound({}),
  )
}

describe('NotificationBell · numero', () => {
  it('senza non lette non mostra nessun numero', async () => {
    const calls: Request[] = []
    serve([], 0, { count: calls })
    renderBell()

    await waitFor(() => expect(calls).toHaveLength(1))
    expect(bell()).toHaveAccessibleName('Notifiche')
    expect(screen.queryByTestId('bell-count')).not.toBeInTheDocument()
  })

  it('con 3 non lette mostra 3 e lo dice anche ai lettori di schermo', async () => {
    serve([], 3)
    renderBell()

    expect(await screen.findByTestId('bell-count')).toHaveTextContent('3')
    expect(bell()).toHaveAccessibleName('Notifiche: 3 non lette')
  })

  it('con una sola non letta il nome accessibile è al singolare', async () => {
    serve([], 1)
    renderBell()

    await screen.findByTestId('bell-count')
    expect(bell()).toHaveAccessibleName('Notifiche: 1 non letta')
  })

  it('con più di 9 non lette mostra «9+» ma ai lettori di schermo dice il numero vero', async () => {
    serve([], 12)
    renderBell()

    expect(await screen.findByTestId('bell-count')).toHaveTextContent('9+')
    expect(bell()).toHaveAccessibleName('Notifiche: 12 non lette')
  })

  it('con 9 non lette mostra 9, senza il più', async () => {
    serve([], 9)
    renderBell()

    expect(await screen.findByTestId('bell-count')).toHaveTextContent(/^9$/)
  })

  it('chiede una sola volta il numero all’apertura dell’app, senza polling', async () => {
    const calls: Request[] = []
    serve([], 2, { count: calls })
    renderBell()

    await screen.findByTestId('bell-count')
    await new Promise((resolve) => setTimeout(resolve, 600))

    expect(calls).toHaveLength(1)
  })

  it('un errore del server non lascia un numero sbagliato: nessun numero', async () => {
    server.use(unreadCountRejected(500, 'INTERNAL_ERROR'))
    renderBell()

    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(screen.queryByTestId('bell-count')).not.toBeInTheDocument()
  })
})

describe('NotificationBell · ricarica', () => {
  it('apre il pannello e rilegge il numero e la prima pagina', async () => {
    const counts: Request[] = []
    const lists: Request[] = []
    serve(makeNotifications(2), 2, { count: counts, list: lists })
    const { user } = renderBell()
    await screen.findByTestId('bell-count')

    await user.click(bell())

    await waitFor(() => expect(counts).toHaveLength(2))
    await waitFor(() => expect(lists).toHaveLength(1))
  })

  it('al ritorno sulla scheda del browser rilegge il numero', async () => {
    const calls: Request[] = []
    serve([], 1, { count: calls })
    renderBell()
    await screen.findByTestId('bell-count')

    act(() => {
      window.dispatchEvent(new Event('focus'))
    })

    await waitFor(() => expect(calls).toHaveLength(2))
  })
})

describe('NotificationBell · pannello', () => {
  it('ha il titolo «Notifiche» e una riga per notifica, con testo, ora e collegamento', async () => {
    serve(makeNotifications(2), 2)
    const { user } = renderBell()
    await screen.findByTestId('bell-count')

    await user.click(bell())

    const region = await panel()
    expect(within(region).getByRole('heading', { name: 'Notifiche' })).toBeInTheDocument()
    expect(await within(region).findAllByRole('listitem')).toHaveLength(2)
    expect(within(region).getByRole('link', { name: 'Persona 1 ha messo mi piace al tuo post' })).toHaveAttribute(
      'href',
      '/feed',
    )
  })

  it('mostra le righe nell’ordine del server (la più recente in cima)', async () => {
    serve(makeNotifications(3), 0)
    const { user } = renderBell()
    await user.click(bell())

    const region = await panel()
    const names = (await within(region).findAllByRole('listitem')).map((item) => item.textContent?.match(/Persona \d/)?.[0])
    expect(names).toEqual(['Persona 1', 'Persona 2', 'Persona 3'])
  })

  it('le non lette hanno l’accento, le lette no', async () => {
    serve([makeNotification({ id: 'a', read: false }), makeNotification({ id: 'b', read: true })], 1)
    const { user } = renderBell()
    await user.click(bell())

    const items = await within(await panel()).findAllByRole('listitem')
    expect(items[0]).toHaveClass('rs-notification--unread')
    expect(items[1]).not.toHaveClass('rs-notification--unread')
  })

  it('senza notifiche dice «Nessuna notifica.»', async () => {
    serve([], 0)
    const { user } = renderBell()
    await waitFor(() => expect(bell()).toBeEnabled())

    await user.click(bell())

    expect(await screen.findByText('Nessuna notifica.')).toBeInTheDocument()
  })

  it('se l’elenco non si carica mostra l’errore e non «Nessuna notifica.»', async () => {
    server.use(notificationsRejected(500, 'INTERNAL_ERROR'), unreadCountFound(0), friendshipsFound({}))
    const { user } = renderBell()
    await waitFor(() => expect(bell()).toBeEnabled())

    await user.click(bell())

    expect(await within(await panel()).findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('Nessuna notifica.')).not.toBeInTheDocument()
  })

  it('«Carica altri» aggiunge la pagina successiva e sparisce all’ultima', async () => {
    const lists: Request[] = []
    const secondPage = makeNotifications(2).map((row, i) => ({ ...row, id: `p${i}` }))
    server.use(
      notificationsFound(
        [
          notificationPage(makeNotifications(10), { totalPages: 2, totalElements: 12 }),
          notificationPage(secondPage, { page: 1, totalPages: 2, totalElements: 12 }),
        ],
        lists,
      ),
      unreadCountFound(0),
      friendshipsFound({}),
    )
    const { user } = renderBell()
    await user.click(bell())
    const region = await panel()
    await within(region).findAllByRole('listitem')
    expect(within(region).getAllByRole('listitem')).toHaveLength(10)

    await user.click(within(region).getByRole('button', { name: 'Carica altri' }))

    await waitFor(() => expect(within(region).getAllByRole('listitem')).toHaveLength(12))
    expect(new URL(lists.at(-1)!.url).searchParams.get('page')).toBe('1')
    expect(within(region).queryByRole('button', { name: 'Carica altri' })).not.toBeInTheDocument()
  })

  it('con una sola pagina non c’è «Carica altri»', async () => {
    serve(makeNotifications(3), 0)
    const { user } = renderBell()
    await user.click(bell())

    await within(await panel()).findAllByRole('listitem')
    expect(screen.queryByRole('button', { name: 'Carica altri' })).not.toBeInTheDocument()
  })

  it('il clic su una notifica la segna letta sul server, abbassa il numero e chiude il pannello', async () => {
    const reads: Request[] = []
    server.use(
      notificationsFound([notificationPage(makeNotifications(2))]),
      unreadCountFound(2),
      friendshipsFound({}),
      notificationReadSucceeds(reads),
    )
    const { user } = renderBell()
    await waitFor(() => expect(screen.getByTestId('bell-count')).toHaveTextContent('2'))
    await user.click(bell())

    await user.click(await screen.findByRole('link', { name: 'Persona 2 ha messo mi piace al tuo post' }))

    await waitFor(() => expect(reads).toHaveLength(1))
    expect(new URL(reads[0].url).pathname).toBe('/api/notifications/n2/read')
    await waitFor(() => expect(screen.getByTestId('bell-count')).toHaveTextContent('1'))
    await waitFor(() => expect(bell()).toHaveAttribute('aria-expanded', 'false'))
  })
})

describe('NotificationBell · segna come lette', () => {
  it('c’è solo se ci sono non lette', async () => {
    serve(makeNotifications(1, { read: true }), 0)
    const { user } = renderBell()
    await user.click(bell())

    await within(await panel()).findAllByRole('listitem')
    expect(screen.queryByRole('button', { name: 'Segna come lette' })).not.toBeInTheDocument()
  })

  it('chiama read-all, porta il numero a zero, segna lette le righe e il pulsante sparisce', async () => {
    const calls: Request[] = []
    server.use(
      notificationsFound([notificationPage(makeNotifications(2))]),
      unreadCountFound(2),
      friendshipsFound({}),
      readAllSucceeds(calls),
    )
    const { user } = renderBell()
    await waitFor(() => expect(screen.getByTestId('bell-count')).toHaveTextContent('2'))
    await user.click(bell())
    await within(await panel()).findAllByRole('listitem')

    await user.click(screen.getByRole('button', { name: 'Segna come lette' }))

    await waitFor(() => expect(screen.queryByTestId('bell-count')).not.toBeInTheDocument())
    expect(new URL(calls[0].url).pathname).toBe('/api/notifications/read-all')
    expect(screen.queryByRole('button', { name: 'Segna come lette' })).not.toBeInTheDocument()
    for (const item of screen.getAllByRole('listitem')) expect(item).not.toHaveClass('rs-notification--unread')
  })
})

describe('NotificationBell · richieste di amicizia', () => {
  const requestNotification = makeNotification({
    id: 'nr1',
    type: 'FRIEND_REQUEST',
    targetId: 'f-attesa',
    actor: { id: 'u-mario', displayName: 'Mario Bianchi', avatarUrl: null },
  })
  const pendingFriendship = makeFriendship({
    id: 'f-attesa',
    status: 'INCOMING',
    otherUser: { id: 'u-mario', displayName: 'Mario Bianchi', avatarUrl: null },
  })

  it('una richiesta ancora in attesa ha Accetta e Rifiuta nella sua riga', async () => {
    server.use(
      notificationsFound([notificationPage([requestNotification])]),
      unreadCountFound(1),
      friendshipsFound({ INCOMING: [makePage([pendingFriendship])] }),
    )
    const { user } = renderBell()
    await user.click(bell())

    const region = await panel()
    expect(await within(region).findByRole('button', { name: 'Accetta: Mario Bianchi' })).toBeInTheDocument()
    expect(within(region).getByRole('button', { name: 'Rifiuta: Mario Bianchi' })).toBeInTheDocument()
    expect(
      within(region).getByRole('link', { name: 'Mario Bianchi ti ha inviato una richiesta di amicizia' }),
    ).toHaveAttribute('href', '/amici?scheda=ricevute')
  })

  it('una richiesta già gestita (non più in attesa) è una riga come le altre, senza pulsanti', async () => {
    server.use(
      notificationsFound([notificationPage([{ ...requestNotification, read: true }])]),
      unreadCountFound(0),
      friendshipsFound({ INCOMING: [makePage([])] }),
    )
    const { user } = renderBell()
    await user.click(bell())

    const region = await panel()
    await within(region).findByRole('link', { name: /ti ha inviato una richiesta/ })
    expect(within(region).queryByRole('button', { name: /^Accetta/ })).not.toBeInTheDocument()
  })

  it('una richiesta in attesa fuori dalle 10 più recenti non ha i pulsanti: il clic porta a /amici', async () => {
    const others = Array.from({ length: 10 }, (_, i) =>
      makeFriendship({
        id: `altra-${i}`,
        status: 'INCOMING',
        otherUser: { id: `x${i}`, displayName: `Altro ${i}`, avatarUrl: null },
      }),
    )
    server.use(
      notificationsFound([notificationPage([requestNotification])]),
      unreadCountFound(1),
      friendshipsFound({ INCOMING: [makePage(others, { totalElements: 11 })] }),
    )
    const { user } = renderBell()
    await user.click(bell())

    const region = await panel()
    await within(region).findByRole('link', { name: /ti ha inviato una richiesta/ })
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(within(region).queryByRole('button', { name: /^Accetta/ })).not.toBeInTheDocument()
  })

  it('dopo aver accettato rilegge elenco e numero: la notifica diventa letta, senza pulsanti', async () => {
    // Le risposte dipendono dall'esito: prima in attesa, poi gestita e letta (come fa il backend)
    let handled = false
    server.use(
      http.get('*/api/notifications', () =>
        HttpResponse.json(notificationPage([handled ? { ...requestNotification, read: true } : requestNotification])),
      ),
      unreadCountFound(() => (handled ? 0 : 1)),
      http.get('*/api/friendships', () => HttpResponse.json(makePage(handled ? [] : [pendingFriendship]))),
      friendshipActionSucceeds('accept', [], makeFriendship({ id: 'f-attesa' })),
    )
    const { user } = renderBell()
    await waitFor(() => expect(screen.getByTestId('bell-count')).toHaveTextContent('1'))
    await user.click(bell())
    const accept = await screen.findByRole('button', { name: 'Accetta: Mario Bianchi' })
    handled = true
    await user.click(accept)

    await waitFor(() => expect(screen.queryByRole('button', { name: /^Accetta/ })).not.toBeInTheDocument())
    await waitFor(() => expect(screen.queryByTestId('bell-count')).not.toBeInTheDocument())
    expect(screen.getByRole('listitem')).not.toHaveClass('rs-notification--unread')
  })
})

describe('NotificationBell · notifiche live', () => {
  it('una notifica live con pannello aperto entra in cima e alza il numero', async () => {
    serve(makeNotifications(2), 2)
    const { user, store } = renderBell()
    await waitFor(() => expect(screen.getByTestId('bell-count')).toHaveTextContent('2'))
    await user.click(bell())
    await within(await panel()).findAllByRole('listitem')

    const live: LiveNotification = {
      id: 'live-1',
      type: 'FRIEND_ACCEPTED',
      createdAt: '2026-10-23T12:00:00Z',
      actor: { id: 'u-anna', displayName: 'Anna Neri', avatarUrl: null },
      targetId: 'f-9',
      preview: null,
    }
    act(() => receiveLiveNotification(store.dispatch, store.getState, live))

    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Notifiche' })).getAllByRole('listitem')).toHaveLength(3))
    const items = within(screen.getByRole('region', { name: 'Notifiche' })).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Anna Neri ha accettato la tua richiesta di amicizia')
    expect(screen.getByTestId('bell-count')).toHaveTextContent('3')
  })
})

// Animazione della campanella (come le altre icone della navigazione): oscilla al passaggio del mouse e al tocco, anche se il
// mouse è sul pulsante e non sull'icona di 22 px.
describe('NotificationBell · animazione', () => {
  const iconStyles = () => [...bell().querySelectorAll('svg *')].map((node) => node.getAttribute('style') ?? '').join('|')

  it("l'animazione parte con il mouse sul pulsante, non solo sull'icona", async () => {
    serve([], 0)
    const { user } = renderBell()
    const before = iconStyles()

    await user.hover(bell())

    await waitFor(() => expect(iconStyles()).not.toBe(before))
  })

  it("l'animazione parte toccando il pulsante", async () => {
    serve([], 0)
    const { user } = renderBell()
    const before = iconStyles()

    // Si preme senza rilasciare, per non aprire il pannello: l'icona deve già animarsi
    await user.pointer({ keys: '[MouseLeft>]', target: bell() })

    await waitFor(() => expect(iconStyles()).not.toBe(before))
  })

  it('con il pulsante intatto: il nome accessibile e l’apertura del pannello non cambiano', async () => {
    serve(makeNotifications(2), 2)
    const { user } = renderBell()
    await screen.findByTestId('bell-count')

    await user.click(bell())

    expect(await screen.findByRole('region', { name: 'Notifiche' })).toBeInTheDocument()
    expect(bell()).toHaveAttribute('aria-expanded', 'true')
  })
})
