import { createBrowserRouter, type RouteObject } from 'react-router'
import { RedirectIfAuthenticated } from '@/components/guards/RedirectIfAuthenticated'
import { AuthLayout, type AuthRouteHandle } from '@/components/layout/AuthLayout'
import { AppShell } from '@/components/layout/AppShell'
import { HydrateFallback } from './HydrateFallback'
import { ROUTES } from './routes'

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
      { index: true, lazy: () => import('./HomePage') },
      { path: '*', lazy: () => import('./NotFoundPage') },
    ],
  },
]

export const router = createBrowserRouter(routes)
