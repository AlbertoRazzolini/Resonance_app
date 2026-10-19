import { Link, Outlet, useMatches } from 'react-router'
import { ROUTES } from '@/app/routes'
import { Logo } from '@/components/ui/Logo'
import { NoticeBar } from '@/components/ui/NoticeBar'

/** Cosa una rotta può dichiarare in `handle` per la cornice delle pagine di accesso. */
export type AuthRouteHandle = {
  /** Dove porta la freccia indietro; senza, alla home (decisione 83). */
  backTo?: string
}

/**
 * Cornice delle pagine di accesso, come nel prototipo: barra con freccia indietro e logo, colonna stretta al centro.
 * Sta fuori da `AppShell`: nelle pagine di accesso non ci sono né la navigazione né il menu utente. La freccia porta
 * a una destinazione fissa (non alla cronologia): così da `/verifica` si torna alla registrazione per correggere l'email.
 */
export function AuthLayout() {
  const matches = useMatches()
  const handle = matches.at(-1)?.handle as AuthRouteHandle | undefined

  return (
    <div className="rs-app">
      <header className="rs-nav rs-auth__bar">
        <Link to={handle?.backTo ?? ROUTES.home} className="rs-auth__back" aria-label="Indietro">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2Z" />
          </svg>
        </Link>
        <Logo />
      </header>
      <main className="rs-main">
        <div className="rs-auth__column">
          <NoticeBar />
          <Outlet />
        </div>
      </main>
    </div>
  )
}
