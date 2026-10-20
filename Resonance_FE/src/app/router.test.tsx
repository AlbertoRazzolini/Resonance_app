import { render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { sessionEnded, sessionStarted } from '@/features/auth/authSlice'
import { makeLoginResponse, makeMe, makePublicUser } from '@/test/fixtures/users'
import { publicUserFound } from '@/test/handlers/users'
import { server } from '@/test/server'
import { setViewportWidth } from '@/test/viewport'
import type { Role } from '@/types/users'
import { makeStore } from './store'
import { routes } from './router'
import { ROUTES, userPath } from './routes'

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
  it('"/" porta agli eventi', async () => {
    const router = renderAt(ROUTES.home)
    expect(await screen.findByRole('heading', { name: 'Eventi' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(ROUTES.events)
  })

  it.each([
    [ROUTES.events, 'Eventi'],
    [ROUTES.collab, 'Collab'],
    [ROUTES.feed, 'Feed'],
  ])("%s è aperta all'anonimo e mostra il segnaposto", async (path, title) => {
    const router = renderAt(path)
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
    expect(screen.getByText('Questa sezione arriva presto.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(path)
  })

  it.each([
    [ROUTES.privacy, 'Informativa sulla privacy'],
    [ROUTES.cookies, 'Informativa sui cookie'],
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
    expect(screen.getByLabelText('Nome visibile')).toHaveValue('Fan di prova')
  })

  it("/utenti/:id è aperta all'anonimo e mostra il profilo pubblico", async () => {
    server.use(publicUserFound(makePublicUser({ displayName: 'Chitarrista' })))
    const router = renderAt(userPath('abc'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Chitarrista' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(userPath('abc'))
  })

  it.each([ROUTES.newConcert, ROUTES.newIndieEvent])(
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
  ])('%s mostra «Accesso negato» a chi non ha il ruolo giusto', async (path, roles) => {
    const router = renderAt(path, { loggedIn: true, roles })
    expect(await screen.findByRole('heading', { name: 'Accesso negato' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(path)
  })

  it.each([
    [ROUTES.newConcert, 'HOST' as Role, 'Pubblica concerto'],
    [ROUTES.newIndieEvent, 'MUSICIAN' as Role, 'Pubblica indie event'],
  ])('%s mostra il segnaposto a chi ha il ruolo giusto', async (path, role, title) => {
    renderAt(path, { loggedIn: true, roles: ['FAN', role] })
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
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
