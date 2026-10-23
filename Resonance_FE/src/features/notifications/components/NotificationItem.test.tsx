import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeNotification } from '@/test/fixtures/notifications'
import { makeLoginResponse } from '@/test/fixtures/users'
import { notificationReadSucceeds } from '@/test/handlers/notifications'
import { server } from '@/test/server'
import type { NotificationResponse } from '@/types/notifications'
import { NotificationItem } from './NotificationItem'

// Una voce di notifica salvata nella campanella: testo e destinazione per tipo, segno «non letta» (accento giallo e
// pallino), azioni facoltative e il clic che la segna letta sul server solo se non lo è già.
function renderItem(notification: NotificationResponse, actions?: React.ReactNode) {
  const store = makeStore()
  store.dispatch(sessionStarted(makeLoginResponse()))
  const { container } = render(
    <Provider store={store}>
      <MemoryRouter>
        <ul>
          <NotificationItem notification={notification} actions={actions} />
        </ul>
      </MemoryRouter>
    </Provider>,
  )
  return { user: userEvent.setup(), container }
}

describe('NotificationItem', () => {
  it('mostra il testo della notifica come collegamento verso il bersaglio', () => {
    renderItem(makeNotification({ type: 'COLLAB_APPLICATION', targetId: 'annuncio-3' }))
    expect(screen.getByRole('link', { name: 'Giulia Rossi si è candidato al tuo annuncio' })).toHaveAttribute(
      'href',
      '/collab/annuncio-3',
    )
  })

  it('una richiesta accettata porta al profilo di chi ha accettato', () => {
    renderItem(makeNotification({ type: 'FRIEND_ACCEPTED', actor: { id: 'u9', displayName: 'Anna Neri', avatarUrl: null } }))
    expect(screen.getByRole('link', { name: 'Anna Neri ha accettato la tua richiesta di amicizia' })).toHaveAttribute(
      'href',
      '/utenti/u9',
    )
  })

  it('una notifica non letta ha l’accento, il pallino e lo dice ai lettori di schermo', () => {
    const { container } = renderItem(makeNotification({ read: false }))

    expect(screen.getByText('Non letta')).toHaveClass('visually-hidden')
    expect(container.querySelector('.rs-notification--unread')).not.toBeNull()
    expect(container.querySelector('.rs-notification__dot')).not.toBeNull()
  })

  it('una notifica letta non ha né accento né pallino né avviso', () => {
    const { container } = renderItem(makeNotification({ read: true }))

    expect(screen.queryByText('Non letta')).not.toBeInTheDocument()
    expect(container.querySelector('.rs-notification--unread')).toBeNull()
    expect(container.querySelector('.rs-notification__dot')).toBeNull()
  })

  it('mostra l’ora della notifica', () => {
    const { container } = renderItem(makeNotification({ createdAt: '2026-10-23T10:00:00Z' }))
    expect(container.querySelector('time')).toHaveAttribute('datetime', '2026-10-23T10:00:00Z')
  })

  it('il clic su una non letta la segna letta sul server', async () => {
    const calls: Request[] = []
    server.use(notificationReadSucceeds(calls))
    const { user } = renderItem(makeNotification({ id: 'n-7', read: false }))

    await user.click(screen.getByRole('link', { name: /mi piace/ }))

    await waitFor(() => expect(calls).toHaveLength(1))
    expect(new URL(calls[0].url).pathname).toBe('/api/notifications/n-7/read')
  })

  it('il clic su una già letta non chiama il server', async () => {
    const calls: Request[] = []
    server.use(notificationReadSucceeds(calls))
    const { user } = renderItem(makeNotification({ read: true }))

    await user.click(screen.getByRole('link', { name: /mi piace/ }))
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(calls).toHaveLength(0)
  })

  it('mostra le azioni passate dal genitore (Accetta e Rifiuta di una richiesta in attesa)', () => {
    renderItem(makeNotification({ type: 'FRIEND_REQUEST' }), <button type="button">Accetta</button>)
    expect(screen.getByRole('button', { name: 'Accetta' })).toBeInTheDocument()
  })
})
