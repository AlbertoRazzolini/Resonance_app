import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import type { LiveNotification } from '@/types/chat'
import { received, selectNotifications, selectUnreadNotificationCount } from '../notificationsSlice'
import { NotificationItem } from './NotificationItem'

// Una voce di notifica nella campanella: testo e destinazione per tipo, anteprima da UserText, segno «non letta» e il
// clic che la segna letta.
const base: LiveNotification = {
  type: 'NEW_LIKE',
  createdAt: '2026-10-22T10:00:00Z',
  actor: { id: 'u1', displayName: 'Giulia Rossi', avatarUrl: null },
  targetId: 'post-1',
  preview: null,
}

function renderItem(notification: LiveNotification) {
  const store = makeStore()
  store.dispatch(received(notification))
  const [item] = selectNotifications(store.getState())
  render(
    <Provider store={store}>
      <MemoryRouter>
        <ul>
          <NotificationItem notification={item} />
        </ul>
      </MemoryRouter>
    </Provider>,
  )
  return { store, user: userEvent.setup() }
}

describe('NotificationItem', () => {
  it('mostra il testo della notifica come collegamento verso il bersaglio', () => {
    renderItem({ ...base, type: 'COLLAB_APPLICATION', targetId: 'annuncio-3' })
    expect(screen.getByRole('link', { name: 'Giulia Rossi si è candidato al tuo annuncio' })).toHaveAttribute(
      'href',
      '/collab/annuncio-3',
    )
  })

  it('per un messaggio mostra anche l’anteprima', () => {
    renderItem({ ...base, type: 'NEW_MESSAGE', targetId: 'c1', preview: 'Ci vediamo alle 20' })
    expect(screen.getByText('Ci vediamo alle 20')).toBeInTheDocument()
  })

  it('un indirizzo nell’anteprima resta un pulsante con conferma, non un collegamento nel collegamento', () => {
    renderItem({ ...base, type: 'NEW_MESSAGE', targetId: 'c1', preview: 'Guarda https://esempio.it/x' })
    expect(screen.getByRole('button', { name: 'https://esempio.it/x' })).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('una notifica non letta lo dice ai lettori di schermo', () => {
    renderItem(base)
    expect(screen.getByText('Non letta')).toHaveClass('visually-hidden')
  })

  it('il clic sul collegamento la segna letta', async () => {
    const { store, user } = renderItem(base)

    await user.click(screen.getByRole('link', { name: /mi piace/ }))

    expect(selectUnreadNotificationCount(store.getState())).toBe(0)
    expect(screen.queryByText('Non letta')).not.toBeInTheDocument()
  })
})
