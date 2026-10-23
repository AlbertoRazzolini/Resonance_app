import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { ROUTES, userPath } from '@/app/routes'
import { makeStore } from '@/app/store'
import { ConfirmationBar } from '@/components/ui/ConfirmationBar'
import { sessionEnded, sessionStarted } from '@/features/auth/authSlice'
import { makeFriendship } from '@/test/fixtures/friends'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import {
  friendshipStateFound,
  friendshipStateRejected,
} from '@/test/handlers/friends'
import { server } from '@/test/server'
import type { FriendshipSummary } from '@/types/friends'
import { ProfileFriendship } from './ProfileFriendship'

// Pulsante dell'amicizia sul profilo pubblico (decisione 102): nessuna chiamata per l'anonimo e per il profilo proprio,
// il link «Accedi per aggiungere» riporta al profilo dopo l'accesso, lo stato segue il backend e si rilegge dopo l'azione.

const OTHER = 'u-mario'

/** Mostra la pagina di accesso con la pagina a cui tornare, passata nello stato del router. */
function LoginProbe() {
  const state = useLocation().state as { from?: string } | null
  return <p data-testid="login-from">{state?.from}</p>
}

function renderProfile(session: 'anonymous' | 'me' | 'other-account', userId = OTHER) {
  const store = makeStore()
  if (session === 'anonymous') store.dispatch(sessionEnded())
  else store.dispatch(sessionStarted(makeLoginResponse({ user: makeMe({ id: 'u-io' }) })))
  const router = createMemoryRouter(
    [
      {
        path: ROUTES.publicUser,
        element: (
          <>
            <ConfirmationBar />
            <ProfileFriendship userId={session === 'me' ? 'u-io' : userId} displayName="Mario Rossi" />
          </>
        ),
      },
      { path: ROUTES.login, element: <LoginProbe /> },
    ],
    { initialEntries: [userPath(userId)] },
  )
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
  return userEvent.setup()
}

describe('ProfileFriendship · chi guarda', () => {
  it('senza sessione: link «Accedi per aggiungere» che riporta al profilo e nessuna chiamata', async () => {
    const calls: Request[] = []
    server.use(friendshipStateFound({ status: 'NONE', friendshipId: null }, calls))
    const user = renderProfile('anonymous')

    await user.click(screen.getByRole('link', { name: 'Accedi per aggiungere' }))

    expect(screen.getByTestId('login-from')).toHaveTextContent(userPath(OTHER))
    expect(calls).toHaveLength(0)
  })

  it('sul proprio profilo: nessun pulsante e nessuna chiamata', async () => {
    const calls: Request[] = []
    server.use(friendshipStateFound({ status: 'NONE', friendshipId: null }, calls))

    renderProfile('me')

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('con la sessione chiede lo stato dell\'utente del profilo', async () => {
    const calls: Request[] = []
    server.use(friendshipStateFound({ status: 'NONE', friendshipId: null }, calls))

    renderProfile('other-account')

    await screen.findByRole('button', { name: /^Aggiungi agli amici/ })
    expect(new URL(calls[0].url).pathname).toBe(`/api/friendships/with/${OTHER}`)
  })
})

describe('ProfileFriendship · stati', () => {
  it('NONE: «Aggiungi agli amici»; dopo la richiesta lo stato si rilegge e diventa «Richiesta inviata»', async () => {
    let state: FriendshipSummary = { status: 'NONE', friendshipId: null }
    const requests: Request[] = []
    server.use(
      http.get('*/api/friendships/with/:userId', () => HttpResponse.json(state)),
      // Come il backend: dopo la richiesta lo stato visto da chi l'ha inviata è OUTGOING.
      http.post('*/api/friendships', ({ request }) => {
        requests.push(request.clone())
        state = { status: 'OUTGOING', friendshipId: 'f1' }
        return HttpResponse.json(makeFriendship({ status: 'OUTGOING' }), { status: 201 })
      }),
    )
    const user = renderProfile('other-account')

    await user.click(await screen.findByRole('button', { name: /^Aggiungi agli amici/ }))

    expect(await screen.findByText('Richiesta inviata', { selector: 'span' })).toBeInTheDocument()
    expect(await requests[0].json()).toEqual({ userId: OTHER })
    expect(screen.getByRole('button', { name: /^Annulla/ })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /^Aggiungi/ })).not.toBeInTheDocument()
  })

  it('INCOMING: «Accetta» chiama l’amicizia giusta e lo stato diventa «Amici»', async () => {
    let state: FriendshipSummary = { status: 'INCOMING', friendshipId: 'f9' }
    const accepts: Request[] = []
    server.use(
      http.get('*/api/friendships/with/:userId', () => HttpResponse.json(state)),
      http.post('*/api/friendships/:id/accept', ({ request }) => {
        accepts.push(request.clone())
        state = { status: 'FRIENDS', friendshipId: 'f9' }
        return HttpResponse.json(makeFriendship({ id: 'f9' }))
      }),
    )
    const user = renderProfile('other-account')
    expect(await screen.findByRole('button', { name: /^Rifiuta/ })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: /^Accetta/ }))

    expect(await screen.findByText('Amici', { selector: 'span' })).toBeInTheDocument()
    expect(new URL(accepts[0].url).pathname).toBe('/api/friendships/f9/accept')
    expect(screen.getByRole('button', { name: /^Scrivi/ })).toBeEnabled()
    expect(screen.getByRole('status')).toHaveTextContent('Amicizia accettata')
  })

  it('FRIENDS: «Amici» con «Scrivi» e «Rimuovi»', async () => {
    server.use(friendshipStateFound({ status: 'FRIENDS', friendshipId: 'f2' }))

    renderProfile('other-account')

    expect(await screen.findByText('Amici', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Scrivi/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /^Rimuovi/ })).toBeEnabled()
  })

  it('UNAVAILABLE: «Non disponibile» spento', async () => {
    server.use(friendshipStateFound({ status: 'UNAVAILABLE', friendshipId: null }))

    renderProfile('other-account')

    expect(await screen.findByRole('button', { name: 'Non disponibile' })).toBeDisabled()
  })
})

describe('ProfileFriendship · errori', () => {
  it('uno stato rifiutato (429) mostra l\'avviso e nessun pulsante', async () => {
    server.use(friendshipStateRejected(429, 'TOO_MANY_REQUESTS'))

    renderProfile('other-account')

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
