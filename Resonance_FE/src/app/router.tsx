import { Navigate, Outlet, createBrowserRouter, type RouteObject } from 'react-router'
import { RedirectIfAuthenticated } from '@/components/guards/RedirectIfAuthenticated'
import { RequireAuth } from '@/components/guards/RequireAuth'
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
            path: ROUTES.chat,
            handle: titled('Messaggi'),
            lazy: () => import('@/features/chat/pages/ChatPage'),
          },
          {
            path: ROUTES.profile,
            handle: titled('Profilo'),
            lazy: () => import('@/features/users/pages/ProfilePage'),
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
