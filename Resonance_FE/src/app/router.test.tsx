import { render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { sessionEnded, sessionStarted } from '@/features/auth/authSlice'
import { makeAdminUser } from '@/test/fixtures/admin'
import { makeCollabPost } from '@/test/fixtures/collab'
import { makeConcert, makeIndieEvent, makePage } from '@/test/fixtures/events'
import { makeLoginResponse, makeMe, makePublicUser } from '@/test/fixtures/users'
import { adminUsersFound, hiddenContentFound } from '@/test/handlers/admin'
import { collabFound, collabPostFound } from '@/test/handlers/collab'
import { concertFound, indieEventFound, nearbyConcertsFound, nearbyIndieFound } from '@/test/handlers/events'
import { feedFound } from '@/test/handlers/feed'
import { publicUserFound } from '@/test/handlers/users'
import { server } from '@/test/server'
import { setViewportWidth } from '@/test/viewport'
import type { Role } from '@/types/users'
import { makeStore } from './store'
import { routes } from './router'
import { collabPath, concertPath, indieEventPath, ROUTES, userPath } from './routes'

// Prova del router: home verso gli eventi, pagine segnaposto delle tab (Messaggi e Profilo dietro il login), pagina
// "non trovato", frecce indietro delle pagine di accesso e navigazione del telefono senza menu a scomparsa.
// Serve uno store: la barra degli avvisi dentro AppShell legge lo stato.
function renderAt(path: string, { loggedIn = false, roles = ['FAN'] as Role[] } = {}) {
  const store = makeStore()
  store.dispatch(
    loggedIn ? sessionStarted(makeLoginResponse({ user: makeMe({ roles }) })) : sessionEnded(),
  )
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
  return router
}

describe('router', () => {
  // /eventi cerca concerti e indie event vicini all'apertura: senza handler la richiesta farebbe fallire il test
  beforeEach(() => server.use(nearbyConcertsFound([makePage([])]), nearbyIndieFound([makePage([])])))

  it('"/" mostra la landing a chi non ha l\'accesso e resta su "/"', async () => {
    const router = renderAt(ROUTES.home)
    expect(
      await screen.findByRole('heading', { level: 1, name: /trova la tua scena dal vivo/i }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(ROUTES.home)
  })

  it('"/" porta agli eventi chi ha già la sessione', async () => {
    const router = renderAt(ROUTES.home, { loggedIn: true })
    expect(await screen.findByRole('heading', { level: 1, name: 'Eventi vicini' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(ROUTES.events)
  })

  it("/collab è aperta all'anonimo e mostra la bacheca", async () => {
    server.use(collabFound([makePage([])]))
    const router = renderAt(ROUTES.collab)
    expect(await screen.findByRole('heading', { level: 1, name: 'Collab' })).toBeInTheDocument()
    expect(await screen.findByText('Nessun annuncio aperto.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(ROUTES.collab)
  })

  it("/collab/:id è aperta all'anonimo e mostra il dettaglio, anche di un annuncio chiuso", async () => {
    server.use(collabPostFound(makeCollabPost({ title: 'Cercasi bassista', isOpen: false })))
    const router = renderAt(collabPath('a1'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Cercasi bassista' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(collabPath('a1'))
  })

  it("/feed è aperta all'anonimo e mostra il feed con il pulsante «Nuovo post» che porta all'accesso", async () => {
    server.use(feedFound([makePage([])]))
    const router = renderAt(ROUTES.feed)
    expect(await screen.findByRole('heading', { level: 1, name: 'Feed' })).toBeInTheDocument()
    expect(await screen.findByText('Ancora nessun post.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Nuovo post' })).toHaveAttribute('href', ROUTES.login)
    expect(router.state.location.pathname).toBe(ROUTES.feed)
  })

  it("/eventi è aperta all'anonimo e mostra gli eventi vicini", async () => {
    const router = renderAt(ROUTES.events)
    expect(await screen.findByRole('heading', { level: 1, name: 'Eventi vicini' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(ROUTES.events)
  })

  it("/concerti/:id è aperta all'anonimo e mostra il dettaglio, con il titolo «Evento» in barra", async () => {
    server.use(concertFound(makeConcert({ title: 'Mogwai' })))
    renderAt(concertPath('c1'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Mogwai' })).toBeInTheDocument()
  })

  it("/indie/:id è aperta all'anonimo e mostra il dettaglio", async () => {
    server.use(indieEventFound(makeIndieEvent({ title: 'Underground night' })))
    renderAt(indieEventPath('e1'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Underground night' })).toBeInTheDocument()
  })

  it.each([
    [ROUTES.privacy, 'Informativa sulla privacy'],
    [ROUTES.cookies, 'Informativa sui cookie'],
    [ROUTES.copyright, 'Copyright'],
    [ROUTES.terms, 'Termini di servizio'],
  ])("%s è aperta all'anonimo", async (path, title) => {
    const router = renderAt(path)
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(path)
  })

  it.each([ROUTES.chat, ROUTES.profile, ROUTES.profileEdit])(
    "%s manda l'anonimo all'accesso, ricordando la pagina richiesta",
    async (path) => {
      const router = renderAt(path)
      await waitFor(() => expect(router.state.location.pathname).toBe(ROUTES.login))
      expect(router.state.location.state).toEqual({ from: path, loginRequired: true })
    },
  )

  it('/chat mostra il segnaposto di Messaggi a chi ha la sessione', async () => {
    renderAt(ROUTES.chat, { loggedIn: true })
    expect(await screen.findByRole('heading', { name: 'Messaggi' })).toBeInTheDocument()
  })

  it('/profilo mostra il profilo a chi ha la sessione', async () => {
    renderAt(ROUTES.profile, { loggedIn: true })
    expect(await screen.findByRole('heading', { level: 1, name: 'Fan di prova' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Modifica profilo' })).toBeInTheDocument()
  })

  it('/profilo/modifica mostra il form a chi ha la sessione', async () => {
    renderAt(ROUTES.profileEdit, { loggedIn: true })
    expect(await screen.findByRole('heading', { name: 'Modifica profilo' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nome utente')).toHaveValue('Fan di prova')
  })

  it("/utenti/:id è aperta all'anonimo e mostra il profilo pubblico", async () => {
    server.use(publicUserFound(makePublicUser({ displayName: 'Chitarrista' })))
    const router = renderAt(userPath('abc'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Chitarrista' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(userPath('abc'))
  })

  it.each([ROUTES.newConcert, ROUTES.newIndieEvent, ROUTES.newCollab])(
    "%s manda l'anonimo all'accesso, ricordando la pagina richiesta",
    async (path) => {
      const router = renderAt(path)
      await waitFor(() => expect(router.state.location.pathname).toBe(ROUTES.login))
      expect(router.state.location.state).toEqual({ from: path, loginRequired: true })
    },
  )

  it.each([
    [ROUTES.newConcert, ['FAN', 'MUSICIAN'] as Role[]],
    [ROUTES.newIndieEvent, ['FAN', 'HOST'] as Role[]],
    [ROUTES.newCollab, ['FAN', 'HOST'] as Role[]],
  ])('%s mostra «Accesso negato» a chi non ha il ruolo giusto', async (path, roles) => {
    const router = renderAt(path, { loggedIn: true, roles })
    expect(await screen.findByRole('heading', { name: 'Accesso negato' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(path)
  })

  it.each([
    [ROUTES.newConcert, 'HOST' as Role, 'Pubblica concerto'],
    [ROUTES.newIndieEvent, 'MUSICIAN' as Role, 'Pubblica indie event'],
    [ROUTES.newCollab, 'MUSICIAN' as Role, 'Pubblica annuncio'],
  ])('%s mostra la pagina a chi ha il ruolo giusto', async (path, role, title) => {
    renderAt(path, { loggedIn: true, roles: ['FAN', role] })
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
  })

  it("/admin/utenti manda l'anonimo all'accesso, ricordando la pagina richiesta", async () => {
    const router = renderAt(ROUTES.adminUsers)
    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTES.login))
    expect(router.state.location.state).toEqual({ from: ROUTES.adminUsers, loginRequired: true })
  })

  it.each([[['FAN'] as Role[]], [['FAN', 'MUSICIAN', 'HOST'] as Role[]]])(
    '/admin/utenti mostra «Accesso negato» a chi ha i ruoli %s',
    async (roles) => {
      renderAt(ROUTES.adminUsers, { loggedIn: true, roles })
      expect(await screen.findByRole('heading', { name: 'Accesso negato' })).toBeInTheDocument()
    },
  )

  it.each([['ADMIN'], ['SUPERADMIN']] as [Role][])('/admin/utenti mostra l’elenco a un %s', async (role) => {
    server.use(adminUsersFound([makePage([makeAdminUser()])]))
    renderAt(ROUTES.adminUsers, { loggedIn: true, roles: ['FAN', role] })
    expect(await screen.findByRole('heading', { level: 1, name: 'Utenti' })).toBeInTheDocument()
    expect(await screen.findByText('Marco Rossi')).toBeInTheDocument()
  })

  it("/admin/contenuti manda l'anonimo all'accesso, ricordando la pagina richiesta", async () => {
    const router = renderAt(ROUTES.adminContent)
    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTES.login))
    expect(router.state.location.state).toEqual({ from: ROUTES.adminContent, loginRequired: true })
  })

  it('/admin/contenuti mostra «Accesso negato» a chi non è admin', async () => {
    renderAt(ROUTES.adminContent, { loggedIn: true, roles: ['FAN', 'HOST'] })
    expect(await screen.findByRole('heading', { name: 'Accesso negato' })).toBeInTheDocument()
  })

  it.each([['ADMIN'], ['SUPERADMIN']] as [Role][])('/admin/contenuti mostra i contenuti nascosti a un %s', async (role) => {
    server.use(hiddenContentFound({}))
    renderAt(ROUTES.adminContent, { loggedIn: true, roles: ['FAN', role] })
    expect(await screen.findByRole('heading', { level: 1, name: 'Contenuti nascosti' })).toBeInTheDocument()
  })

  it('sul telefono mostra la barra di tab e nessun menu a scomparsa', async () => {
    setViewportWidth(375)
    renderAt(ROUTES.events)
    expect(
      await screen.findByRole('navigation', { name: 'Navigazione principale' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Apri il menu' })).not.toBeInTheDocument()
  })

  it('mostra "Pagina non trovata" per un percorso sconosciuto', async () => {
    renderAt('/percorso-che-non-esiste')
    expect(await screen.findByRole('heading', { name: 'Pagina non trovata' })).toBeInTheDocument()
  })

  it('la freccia indietro di /verifica porta alla registrazione, quella di /accesso alla home', async () => {
    renderAt(ROUTES.verify)
    expect(await screen.findByRole('link', { name: 'Indietro' })).toHaveAttribute(
      'href',
      ROUTES.register,
    )
  })

  it('la freccia indietro del reset porta a "password dimenticata", quella di "password dimenticata" alla home', async () => {
    renderAt(ROUTES.resetPassword)
    expect(await screen.findByRole('link', { name: 'Indietro' })).toHaveAttribute(
      'href',
      ROUTES.forgotPassword,
    )
  })

  it('la freccia indietro di "password dimenticata" porta alla home', async () => {
    renderAt(ROUTES.forgotPassword)
    expect(await screen.findByRole('link', { name: 'Indietro' })).toHaveAttribute(
      'href',
      ROUTES.home,
    )
  })

  it('la freccia indietro di /accesso porta alla home', async () => {
    renderAt(ROUTES.login)
    expect(await screen.findByRole('link', { name: 'Indietro' })).toHaveAttribute(
      'href',
      ROUTES.home,
    )
  })
})
