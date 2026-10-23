import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { makePage } from '@/test/fixtures/events'
import { makeFriendship } from '@/test/fixtures/friends'
import { makeLoginResponse } from '@/test/fixtures/users'
import { friendshipsFound } from '@/test/handlers/friends'
import { server } from '@/test/server'
import { FriendRequestsBadge } from './FriendRequestsBadge'

// Badge sulla voce Amici: il numero delle richieste ricevute in attesa (`totalElements`), da 1 a «9+»; non mostra nulla
// senza richieste o senza sessione (e allora non chiama il server).
function renderBadge(totalElements: number, loggedIn = true) {
  const calls: Request[] = []
  server.use(
    friendshipsFound(
      {
        INCOMING: [
          makePage(
            Array.from({ length: Math.min(totalElements, 10) }, () => makeFriendship()),
            { totalElements },
          ),
        ],
      },
      calls,
    ),
  )
  const store = makeStore()
  if (loggedIn) store.dispatch(sessionStarted(makeLoginResponse()))
  render(
    <Provider store={store}>
      <FriendRequestsBadge />
    </Provider>,
  )
  return { calls }
}

describe('FriendRequestsBadge', () => {
  it('mostra il numero delle richieste ricevute, con il testo per i lettori di schermo', async () => {
    renderBadge(3)
    expect(await screen.findByTestId('friends-badge')).toHaveTextContent('3')
    expect(screen.getByText('3 richieste di amicizia ricevute')).toHaveClass('visually-hidden')
  })

  it('con una sola richiesta dice «1 richiesta di amicizia ricevuta»', async () => {
    renderBadge(1)
    expect(await screen.findByText('1 richiesta di amicizia ricevuta')).toBeInTheDocument()
  })

  it('sopra 9 scrive «9+», ma ai lettori di schermo dice il numero vero', async () => {
    renderBadge(14)
    expect(await screen.findByTestId('friends-badge')).toHaveTextContent('9+')
    expect(screen.getByText('14 richieste di amicizia ricevute')).toBeInTheDocument()
  })

  it('senza richieste non mostra nulla', async () => {
    const { calls } = renderBadge(0)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(calls).toHaveLength(1)
    expect(screen.queryByTestId('friends-badge')).not.toBeInTheDocument()
  })

  it('da anonimi non chiama il server e non mostra nulla', async () => {
    const { calls } = renderBadge(3, false)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(calls).toHaveLength(0)
    expect(screen.queryByTestId('friends-badge')).not.toBeInTheDocument()
  })
})
