import { Navigate, Outlet, createBrowserRouter, type RouteObject } from 'react-router'
import { RedirectIfAuthenticated } from '@/components/guards/RedirectIfAuthenticated'
import { RequireAuth } from '@/components/guards/RequireAuth'
import { RequireRole } from '@/components/guards/RequireRole'
import { AuthLayout, type AuthRouteHandle } from '@/components/layout/AuthLayout'
import { AppShell } from '@/components/layout/AppShell'
import type { TitleRouteHandle } from '@/components/layout/NavBar'
import { HydrateFallback } from './HydrateFallback'
import { ROUTES } from './routes'

/** Titolo della barra in alto per la rotta (da tablet in su, decisione 83). */
const titled = (title: string) => ({ title }) satisfies TitleRouteHandle

/**
 * Tutte le rotte dell'app, con le pagine caricate in modo differito (ogni modulo esporta `Component`).
 * Esportate a parte per poterle montare in un router di prova nei test. Le pagine di accesso stanno in una cornice
 * propria (`AuthLayout`) e rimandano alla home chi ha già la sessione.
 */
export const routes: RouteObject[] = [
  {
    element: (
      <RedirectIfAuthenticated>
        <AuthLayout />
      </RedirectIfAuthenticated>
    ),
    HydrateFallback,
    children: [
      { path: ROUTES.login, lazy: () => import('@/features/auth/pages/LoginPage') },
      { path: ROUTES.register, lazy: () => import('@/features/auth/pages/RegisterPage') },
      {
        path: ROUTES.verify,
        // Per correggere un'email sbagliata si torna alla registrazione (decisione 83)
        handle: { backTo: ROUTES.register } satisfies AuthRouteHandle,
        lazy: () => import('@/features/auth/pages/VerifyPage'),
      },
      {
        path: ROUTES.forgotPassword,
        lazy: () => import('@/features/auth/pages/ForgotPasswordPage'),
      },
      {
        path: ROUTES.resetPassword,
        // Per correggere un'email sbagliata si torna a "password dimenticata" (decisione 83)
        handle: { backTo: ROUTES.forgotPassword } satisfies AuthRouteHandle,
        lazy: () => import('@/features/auth/pages/ResetPasswordPage'),
      },
    ],
  },
  {
    path: ROUTES.home,
    Component: AppShell,
    HydrateFallback,
    children: [
      // La home è la lista degli eventi (decisione 83: la tab Eventi e il logo portano nello stesso posto)
      { index: true, element: <Navigate to={ROUTES.events} replace /> },
      {
        path: ROUTES.events,
        handle: titled('Eventi'),
        lazy: () => import('@/features/events/pages/NearbyEventsPage'),
      },
      {
        path: ROUTES.collab,
        handle: titled('Collab'),
        lazy: () => import('@/features/collab/pages/CollabBoardPage'),
      },
      {
        // Dettaglio di un annuncio: aperto anche agli anonimi e anche se chiuso, come `GET /api/collab-posts/{id}` (sezione 6.7).
        // La rotta statica `/collab/nuovo` vince su `:id` (ordine per specificità di React Router)
        path: ROUTES.collabPost,
        handle: titled('Annuncio'),
        lazy: () => import('@/features/collab/pages/CollabDetailPage'),
      },
      {
        path: ROUTES.feed,
        handle: titled('Feed'),
        lazy: () => import('@/features/feed/pages/FeedPage'),
      },
      {
        // Messaggi e Profilo: solo con la sessione, altrimenti accesso e ritorno qui (progettazione, sezione 6)
        element: (
          <RequireAuth>
            <Outlet />
          </RequireAuth>
        ),
        children: [
          {
            // Una sola rotta con `:id` facoltativo: passando dall'elenco a una conversazione la pagina non si rimonta
            path: ROUTES.chatPage,
            handle: titled('Messaggi'),
            lazy: () => import('@/features/chat/pages/ChatPage'),
          },
          {
            path: ROUTES.friends,
            handle: titled('Amici'),
            lazy: () => import('@/features/friends/pages/FriendsPage'),
          },
          {
            path: ROUTES.userSearch,
            handle: titled('Cerca persone'),
            lazy: () => import('@/features/friends/pages/UserSearchPage'),
          },
          {
            path: ROUTES.profile,
            handle: titled('Profilo'),
            lazy: () => import('@/features/users/pages/ProfilePage'),
          },
          {
            path: ROUTES.profileEdit,
            handle: titled('Profilo'),
            lazy: () => import('@/features/users/pages/EditProfilePage'),
          },
        ],
      },
      {
        // Profilo di un altro utente: aperto anche agli anonimi, come `GET /api/users/{id}` (progettazione, sezione 6.5)
        path: ROUTES.publicUser,
        handle: titled('Profilo'),
        lazy: () => import('@/features/users/pages/PublicProfilePage'),
      },
      {
        // Dettagli degli eventi: aperti anche agli anonimi, come `GET /api/official-concerts/{id}` (sezione 6.6). Le rotte
        // statiche `/concerti/nuovo` e `/indie/nuovo` vincono su `:id` (ordine per specificità di React Router)
        path: ROUTES.concert,
        handle: titled('Evento'),
        lazy: () => import('@/features/events/pages/ConcertDetailPage'),
      },
      {
        path: ROUTES.indieEvent,
        handle: titled('Evento'),
        lazy: () => import('@/features/events/pages/IndieEventDetailPage'),
      },
      {
        // Pubblicazione dei concerti: solo HOST (progettazione, sezione 6.6); la protezione vera è nel backend
        element: (
          <RequireRole roles={['HOST']}>
            <Outlet />
          </RequireRole>
        ),
        children: [
          {
            path: ROUTES.newConcert,
            handle: titled('Pubblica concerto'),
            lazy: () => import('@/features/events/pages/NewConcertPage'),
          },
        ],
      },
      {
        // Pubblicazione degli indie event: solo MUSICIAN (progettazione, sezione 6.6)
        element: (
          <RequireRole roles={['MUSICIAN']}>
            <Outlet />
          </RequireRole>
        ),
        children: [
          {
            path: ROUTES.newIndieEvent,
            handle: titled('Pubblica indie event'),
            lazy: () => import('@/features/events/pages/NewIndieEventPage'),
          },
          {
            // Pubblicazione degli annunci collab: solo MUSICIAN (progettazione, sezione 6.7)
            path: ROUTES.newCollab,
            handle: titled('Pubblica annuncio'),
            lazy: () => import('@/features/collab/pages/NewCollabPage'),
          },
        ],
      },
      {
        path: ROUTES.privacy,
        handle: titled('Informativa privacy'),
        lazy: () => import('@/features/legal/pages/PrivacyPolicyPage'),
      },
      {
        path: ROUTES.cookies,
        handle: titled('Informativa cookie'),
        lazy: () => import('@/features/legal/pages/CookiePolicyPage'),
      },
      { path: '*', lazy: () => import('./NotFoundPage') },
    ],
  },
]

export const router = createBrowserRouter(routes)
