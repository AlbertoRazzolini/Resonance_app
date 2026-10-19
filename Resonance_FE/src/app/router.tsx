import { createBrowserRouter, type RouteObject } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { HydrateFallback } from './HydrateFallback'
import { ROUTES } from './routes'

/**
 * Tutte le rotte dell'app, con le pagine caricate in modo differito (ogni modulo esporta `Component`).
 * Esportate a parte per poterle montare in un router di prova nei test.
 */
export const routes: RouteObject[] = [
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
