import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/app/routes'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { makePage } from '@/test/fixtures/events'
import { makeFriendship } from '@/test/fixtures/friends'
import { makeLoginResponse } from '@/test/fixtures/users'
import {
  friendshipActionSucceeds,
  friendshipsFound,
  friendshipsRejected,
} from '@/test/handlers/friends'
import { server } from '@/test/server'
import { Component as FriendsPage } from './FriendsPage'

// Elenchi Amici, Ricevute e Inviate: la scheda aperta sta nell'indirizzo (?scheda=), ognuna ha il suo endpoint, il suo
// stato vuoto e «Carica altri»; accettare una richiesta la toglie da Ricevute.
function Where() {
  const location = useLocation()
  return <p data-testid="where">{location.pathname + location.search}</p>
}

function renderFriends(entry: string = ROUTES.friends) {
  const store = makeStore()
  store.dispatch(sessionStarted(makeLoginResponse()))
  const router = createMemoryRouter(
    [
      {
        path: ROUTES.friends,
        element: (
          <>
            <FriendsPage />
            <Where />
          </>
        ),
      },
      { path: ROUTES.userSearch, element: <p>Pagina di ricerca</p> },
    ],
    { initialEntries: [entry] },
  )
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
  return userEvent.setup()
}

const giulia = makeFriendship({
  id: 'f-giulia',
  otherUser: { id: 'u-giulia', displayName: 'Giulia Verdi', avatarUrl: null },
})
const luca = makeFriendship({
  id: 'f-luca',
  status: 'INCOMING',
  otherUser: { id: 'u-luca', displayName: 'Luca Neri', avatarUrl: null },
})
const sara = makeFriendship({
  id: 'f-sara',
  status: 'OUTGOING',
  otherUser: { id: 'u-sara', displayName: 'Sara Blu', avatarUrl: null },
})

const typeOf = (call: Request) => new URL(call.url).searchParams.get('type')

describe('FriendsPage · schede', () => {
  it('apre «Amici» di base e chiede solo gli amici', async () => {
    const calls: Request[] = []
    server.use(friendshipsFound({ FRIENDS: [makePage([giulia])] }, calls))
    renderFriends()

    expect(screen.getByRole('tab', { name: 'Amici', selected: true })).toBeInTheDocument()
    const link = await screen.findByRole('link', { name: 'Giulia Verdi' })
    expect(link).toHaveAttribute('href', '/utenti/u-giulia')
    expect(calls.map(typeOf)).toEqual(['FRIENDS'])
    expect(screen.getByRole('button', { name: /^Rimuovi/ })).toBeInTheDocument()
  })

  it('?scheda=ricevute apre «Ricevute», con Accetta e Rifiuta', async () => {
    const calls: Request[] = []
    server.use(friendshipsFound({ INCOMING: [makePage([luca])] }, calls))
    renderFriends(`${ROUTES.friends}?scheda=ricevute`)

    expect(screen.getByRole('tab', { name: 'Ricevute', selected: true })).toBeInTheDocument()
    await screen.findByRole('link', { name: 'Luca Neri' })
    expect(calls.map(typeOf)).toEqual(['INCOMING'])
    expect(screen.getByRole('button', { name: /^Accetta/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Rifiuta/ })).toBeInTheDocument()
  })

  it('?scheda=inviate apre «Inviate», con Annulla', async () => {
    server.use(friendshipsFound({ OUTGOING: [makePage([sara])] }))
    renderFriends(`${ROUTES.friends}?scheda=inviate`)

    await screen.findByRole('link', { name: 'Sara Blu' })
    expect(screen.getByRole('tab', { name: 'Inviate', selected: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Annulla/ })).toBeInTheDocument()
  })

  it('una scheda sconosciuta nell’indirizzo ripiega su «Amici»', () => {
    server.use(friendshipsFound({}))
    renderFriends(`${ROUTES.friends}?scheda=boh`)

    expect(screen.getByRole('tab', { name: 'Amici', selected: true })).toBeInTheDocument()
  })

  it('cambiare scheda aggiorna l’indirizzo; «Amici» torna all’indirizzo pulito', async () => {
    server.use(friendshipsFound({}))
    const user = renderFriends()

    await user.click(screen.getByRole('tab', { name: 'Ricevute' }))
    expect(screen.getByTestId('where')).toHaveTextContent('/amici?scheda=ricevute')
    await user.click(screen.getByRole('tab', { name: 'Inviate' }))
    expect(screen.getByTestId('where')).toHaveTextContent('/amici?scheda=inviate')
    await user.click(screen.getByRole('tab', { name: 'Amici' }))
    expect(screen.getByTestId('where').textContent).toBe('/amici')
  })

  it('chiede l’elenco di una scheda solo quando la apri', async () => {
    const calls: Request[] = []
    server.use(friendshipsFound({}, calls))
    const user = renderFriends()
    await screen.findByText('Non hai ancora amici.')
    expect(calls.map(typeOf)).toEqual(['FRIENDS'])

    await user.click(screen.getByRole('tab', { name: 'Ricevute' }))
    await screen.findByText('Nessuna richiesta ricevuta.')

    expect(calls.map(typeOf)).toEqual(['FRIENDS', 'INCOMING'])
  })
})

describe('FriendsPage · stati vuoti e pagine', () => {
  it.each([
    ['', 'Non hai ancora amici.'],
    ['?scheda=ricevute', 'Nessuna richiesta ricevuta.'],
    ['?scheda=inviate', 'Nessuna richiesta inviata.'],
  ])('scheda %s vuota: «%s» con il link «Cerca persone»', async (query, text) => {
    server.use(friendshipsFound({}))
    renderFriends(`${ROUTES.friends}${query}`)

    expect(await screen.findByText(text)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Cerca persone' }).at(-1)).toHaveAttribute(
      'href',
      ROUTES.userSearch,
    )
  })

  it('«Carica altri» chiede la pagina dopo senza perdere la prima', async () => {
    const calls: Request[] = []
    const second = makeFriendship({
      id: 'f2',
      otherUser: { id: 'u2', displayName: 'Bruno Due', avatarUrl: null },
    })
    server.use(
      friendshipsFound(
        { FRIENDS: [makePage([giulia], { page: 0, totalPages: 2 }), makePage([second], { page: 1, totalPages: 2 })] },
        calls,
      ),
    )
    const user = renderFriends()

    await screen.findByText('Giulia Verdi')
    await user.click(screen.getByRole('button', { name: 'Carica altri' }))

    expect(await screen.findByText('Bruno Due')).toBeInTheDocument()
    expect(screen.getByText('Giulia Verdi')).toBeInTheDocument()
    expect(new URL(calls[1].url).searchParams.get('page')).toBe('1')
  })

  it('un errore dell’elenco si legge con il suo testo e c’è «Riprova»', async () => {
    server.use(friendshipsRejected(500, 'INTERNAL_ERROR'))
    renderFriends()

    expect(await screen.findByRole('alert')).toHaveTextContent('Si è verificato un problema imprevisto. Riprova tra poco.')
    expect(screen.getByRole('button', { name: 'Riprova' })).toBeInTheDocument()
  })

  it('«Cerca persone» in cima porta alla ricerca', () => {
    server.use(friendshipsFound({}))
    renderFriends()

    expect(screen.getAllByRole('link', { name: 'Cerca persone' })[0]).toHaveAttribute('href', ROUTES.userSearch)
  })
})

describe('FriendsPage · azioni', () => {
  it('accettare una richiesta la toglie da «Ricevute» dopo il ricaricamento', async () => {
    let accepted = false
    const calls: Request[] = []
    server.use(
      http.get('*/api/friendships', () =>
        HttpResponse.json(makePage(accepted ? [] : [luca])),
      ),
      friendshipActionSucceeds('accept', calls, makeFriendship({ id: 'f-luca' })),
    )
    const user = renderFriends(`${ROUTES.friends}?scheda=ricevute`)
    const row = (await screen.findByRole('link', { name: 'Luca Neri' })).closest('li') as HTMLElement

    accepted = true
    await user.click(within(row).getByRole('button', { name: /^Accetta/ }))

    expect(await screen.findByText('Nessuna richiesta ricevuta.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Luca Neri' })).not.toBeInTheDocument()
    expect(new URL(calls[0].url).pathname).toBe('/api/friendships/f-luca/accept')
  })
})
