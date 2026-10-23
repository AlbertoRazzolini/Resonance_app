import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ROUTES, userPath } from '@/app/routes'
import { makeStore } from '@/app/store'
import { sessionEnded, sessionStarted } from '@/features/auth/authSlice'
import { makeLoginResponse, makeMe, makePublicUser } from '@/test/fixtures/users'
import { friendshipStateFound } from '@/test/handlers/friends'
import { publicUserFound, publicUserRejected } from '@/test/handlers/users'
import { server } from '@/test/server'
import { Component as PublicProfilePage } from './PublicProfilePage'

// Profilo di un altro utente: aperto anche a chi non ha la sessione (progettazione, sezione 6.5), senza email né
// coordinate; un utente inesistente o non verificato dà «Utente non trovato.», un altro errore un avviso.
function renderPublic(id: string, loggedInAs?: string) {
  const store = makeStore()
  if (loggedInAs) store.dispatch(sessionStarted(makeLoginResponse({ user: makeMe({ id: loggedInAs }) })))
  else store.dispatch(sessionEnded())
  const router = createMemoryRouter(
    [
      { path: ROUTES.publicUser, element: <PublicProfilePage /> },
      { path: ROUTES.home, element: <p>Home</p> },
    ],
    { initialEntries: [userPath(id)] },
  )
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
}

describe('PublicProfilePage', () => {
  it('mostra nome, ruoli, città e bio a chi non ha la sessione', async () => {
    server.use(
      publicUserFound(
        makePublicUser({
          displayName: 'Chitarrista',
          roles: ['FAN', 'MUSICIAN'],
          city: 'Bologna',
          bio: 'Suono dal vivo',
        }),
      ),
    )

    renderPublic('abc')

    expect(await screen.findByRole('heading', { level: 1, name: 'Chitarrista' })).toBeInTheDocument()
    expect(screen.getByText('Fan')).toBeInTheDocument()
    expect(screen.getByText('Musicista')).toBeInTheDocument()
    expect(screen.getByText('Bologna')).toBeInTheDocument()
    expect(screen.getByText('Suono dal vivo')).toBeInTheDocument()
  })

  it('chiede al backend il profilo dell\'id nell\'indirizzo', async () => {
    const calls: Request[] = []
    server.use(publicUserFound(makePublicUser(), calls))

    renderPublic('id-con/barra')

    await screen.findByRole('heading', { level: 1 })
    expect(new URL(calls[0].url).pathname).toBe('/api/users/id-con%2Fbarra')
  })

  it('non offre «Modifica profilo» né le schede dei contenuti', async () => {
    server.use(publicUserFound(makePublicUser()))

    renderPublic('abc')

    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('link', { name: 'Modifica profilo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })

  // Pulsante dell'amicizia (decisione 102): sotto nome e città, prima della bio.
  it('con la sessione mostra «Aggiungi agli amici» sul profilo di un altro, prima della bio', async () => {
    server.use(
      publicUserFound(makePublicUser({ id: 'u-altro', bio: 'Suono dal vivo' })),
      friendshipStateFound({ status: 'NONE', friendshipId: null }),
    )

    renderPublic('u-altro', 'u-io')

    const button = await screen.findByRole('button', { name: /^Aggiungi agli amici/ })
    expect(button.compareDocumentPosition(screen.getByTestId('profile-bio'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })

  it('senza sessione mostra «Accedi per aggiungere», non il pulsante', async () => {
    server.use(publicUserFound(makePublicUser({ id: 'u-altro' })))

    renderPublic('u-altro')

    expect(await screen.findByRole('link', { name: 'Accedi per aggiungere' })).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('sul proprio profilo pubblico non c\'è né il pulsante né il link', async () => {
    server.use(publicUserFound(makePublicUser({ id: 'u-io' })))

    renderPublic('u-io', 'u-io')

    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Accedi per aggiungere' })).not.toBeInTheDocument()
  })

  it('mostra la foto se il profilo ha un indirizzo', async () => {
    server.use(publicUserFound(makePublicUser({ avatarUrl: 'https://x.it/a.png' })))

    renderPublic('abc')

    await screen.findByRole('heading', { level: 1 })
    expect(document.querySelector('img')).toHaveAttribute('src', 'https://x.it/a.png')
  })

  it('mentre carica mostra «Caricamento…»', () => {
    server.use(publicUserFound(makePublicUser()))

    renderPublic('abc')

    expect(screen.getByRole('status')).toHaveTextContent('Caricamento…')
  })

  it('un utente che non esiste (404) mostra «Utente non trovato.» con il collegamento alla home', async () => {
    server.use(publicUserRejected(404, 'NOT_FOUND'))

    renderPublic('inesistente')

    expect(await screen.findByRole('heading', { name: 'Utente non trovato.' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Torna alla pagina iniziale' })).toHaveAttribute(
      'href',
      ROUTES.home,
    )
  })

  it('un altro errore mostra il suo messaggio, non «non trovato»', async () => {
    server.use(publicUserRejected(500, 'INTERNAL_ERROR'))

    renderPublic('abc')

    expect(await screen.findByRole('alert')).toHaveTextContent('problema imprevisto')
    expect(screen.queryByText('Utente non trovato.')).not.toBeInTheDocument()
  })
})
