import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/app/routes'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { makePage } from '@/test/fixtures/events'
import { makeSearchResult } from '@/test/fixtures/friends'
import { makeLoginResponse } from '@/test/fixtures/users'
import { friendshipRequestRejected, searchFound, searchRejected } from '@/test/handlers/friends'
import { server } from '@/test/server'
import type { FriendshipSummary } from '@/types/friends'
import { Component as UserSearchPage } from './UserSearchPage'

// Ricerca utenti: parte 400 ms dopo l'ultimo tasto e con almeno 2 caratteri (spazi ai bordi esclusi), il testo sta
// nell'indirizzo (?q=), «Carica altri» chiede la pagina dopo, TOO_MANY_REQUESTS mostra il suo testo.
function Where() {
  const location = useLocation()
  return <p data-testid="where">{location.pathname + location.search}</p>
}

function renderSearch(entry: string = ROUTES.userSearch) {
  const store = makeStore()
  store.dispatch(sessionStarted(makeLoginResponse()))
  const router = createMemoryRouter(
    [
      {
        path: ROUTES.userSearch,
        element: (
          <>
            <UserSearchPage />
            <Where />
          </>
        ),
      },
      { path: ROUTES.publicUser, element: <p>Profilo pubblico</p> },
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

const field = () => screen.getByRole('searchbox', { name: 'Cerca per nome' })

describe('UserSearchPage · attesa e minimo di caratteri', () => {
  it('all’inizio mostra l’invito a scrivere almeno 2 caratteri e non chiama il server', () => {
    const calls: Request[] = []
    server.use(searchFound([makePage([])], calls))
    renderSearch()

    expect(screen.getByText('Scrivi almeno 2 caratteri per cercare.')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('con un solo carattere non cerca, nemmeno dopo l’attesa', async () => {
    const calls: Request[] = []
    server.use(searchFound([makePage([])], calls))
    const user = renderSearch()

    await user.type(field(), 'm')
    await new Promise((resolve) => setTimeout(resolve, 600))

    expect(calls).toHaveLength(0)
    expect(screen.getByText('Scrivi almeno 2 caratteri per cercare.')).toBeInTheDocument()
  })

  it('con spazi ai bordi conta i caratteri puliti: « m » non cerca', async () => {
    const calls: Request[] = []
    server.use(searchFound([makePage([])], calls))
    const user = renderSearch()

    await user.type(field(), '  m  ')
    await new Promise((resolve) => setTimeout(resolve, 600))

    expect(calls).toHaveLength(0)
  })

  it('aspetta 400 ms dopo l’ultimo tasto e fa una sola chiamata, con il testo pulito', async () => {
    const calls: Request[] = []
    server.use(searchFound([makePage([makeSearchResult()])], calls))
    const user = renderSearch()

    await user.type(field(), ' mario ')
    expect(calls).toHaveLength(0)

    await screen.findByText('Mario Rossi')
    expect(calls).toHaveLength(1)
    const params = new URL(calls[0].url).searchParams
    expect(params.get('q')).toBe('mario')
    expect(params.get('page')).toBe('0')
  })

  it('il campo non accetta più di 50 caratteri (il limite del backend)', () => {
    renderSearch()
    expect(field()).toHaveAttribute('maxlength', '50')
  })
})

describe('UserSearchPage · risultati', () => {
  it('mostra nome come link al profilo e città', async () => {
    server.use(
      searchFound([makePage([makeSearchResult({ id: 'u9', displayName: 'Ada Lovelace', city: 'Pisa' })])]),
    )
    const user = renderSearch()

    await user.type(field(), 'ada')

    expect(await screen.findByRole('link', { name: 'Ada Lovelace' })).toHaveAttribute('href', '/utenti/u9')
    expect(screen.getByText('Pisa')).toBeInTheDocument()
  })

  it('senza risultati dice «Nessuna persona trovata.»', async () => {
    server.use(searchFound([makePage([])]))
    const user = renderSearch()

    await user.type(field(), 'zzz')

    expect(await screen.findByText('Nessuna persona trovata.')).toBeInTheDocument()
  })

  it('«Carica altri» chiede la pagina dopo e tiene quella già caricata', async () => {
    const calls: Request[] = []
    server.use(
      searchFound(
        [
          makePage([makeSearchResult({ id: 'a', displayName: 'Anna Uno' })], { page: 0, totalPages: 2 }),
          makePage([makeSearchResult({ id: 'b', displayName: 'Bruno Due' })], { page: 1, totalPages: 2 }),
        ],
        calls,
      ),
    )
    const user = renderSearch()

    await user.type(field(), 'an')
    await screen.findByText('Anna Uno')
    await user.click(screen.getByRole('button', { name: 'Carica altri' }))

    expect(await screen.findByText('Bruno Due')).toBeInTheDocument()
    expect(screen.getByText('Anna Uno')).toBeInTheDocument()
    expect(new URL(calls[1].url).searchParams.get('page')).toBe('1')
    expect(screen.queryByRole('button', { name: 'Carica altri' })).not.toBeInTheDocument()
  })

  it('TOO_MANY_REQUESTS mostra il suo testo italiano e «Riprova»', async () => {
    server.use(searchRejected(429, 'TOO_MANY_REQUESTS'))
    const user = renderSearch()

    await user.type(field(), 'mario')

    expect(await screen.findByRole('alert')).toHaveTextContent('Troppi tentativi: attendi un momento e riprova.')
    expect(screen.getByRole('button', { name: 'Riprova' })).toBeInTheDocument()
  })
})

describe('UserSearchPage · testo nell’indirizzo', () => {
  it('apre con ?q= già nel campo e cerca subito', async () => {
    const calls: Request[] = []
    server.use(searchFound([makePage([makeSearchResult()])], calls))
    renderSearch(`${ROUTES.userSearch}?q=mario`)

    expect(field()).toHaveValue('mario')
    await screen.findByText('Mario Rossi')
    expect(new URL(calls[0].url).searchParams.get('q')).toBe('mario')
  })

  it('dopo l’attesa scrive il testo cercato in ?q= sostituendo la voce della cronologia', async () => {
    server.use(searchFound([makePage([makeSearchResult()])]))
    const user = renderSearch()

    await user.type(field(), 'mario')

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/amici/cerca?q=mario'))
  })
})

describe('UserSearchPage · stato dell’amicizia nei risultati', () => {
  it('richiesta già ricevuta: la ricerca si ricarica e al posto di «Aggiungi» compare «Accetta»', async () => {
    let calls = 0
    server.use(
      http.get('*/api/users/search', () => {
        calls += 1
        const friendship: FriendshipSummary =
          calls === 1 ? { status: 'NONE', friendshipId: null } : { status: 'INCOMING', friendshipId: 'f-in' }
        return HttpResponse.json(makePage([makeSearchResult({ friendship })]))
      }),
      friendshipRequestRejected(409, 'FRIEND_REQUEST_ALREADY_RECEIVED'),
    )
    const user = renderSearch()

    await user.type(field(), 'mario')
    await user.click(await screen.findByRole('button', { name: /^Aggiungi/ }))

    expect(await screen.findByRole('button', { name: /^Accetta/ })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /^Aggiungi/ })).not.toBeInTheDocument()
  })
})
