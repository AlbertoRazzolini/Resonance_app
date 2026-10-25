import { Link, useMatches } from 'react-router'
import { ROUTES } from '@/app/routes'
import { Logo } from '@/components/ui/Logo'
import { selectCurrentUser } from '@/features/auth/authSlice'
import { useAppSelector } from '@/hooks/redux'
import { LogoutButton } from './LogoutButton'
import { NotificationBell } from './NotificationBell'
import { UserMenu } from './UserMenu'

/** Dato che una rotta dichiara in `handle` per dare il titolo alla barra in alto (da tablet in su). */
export type TitleRouteHandle = { title?: string }

/**
 * Barra in alto, senza menu a scomparsa (decisione 83): il logo porta agli eventi (`showLogo` lo toglie sul
 * desktop, dove sta nella colonna), poi il titolo della pagina da `handle.title` della rotta (lo mostra il CSS da
 * 768 px), a destra la campanella (solo con la sessione), il menu utente e, sul telefono, il pulsante «Esci» (da 768 px sta
 * in fondo alla colonna a sinistra; lo nasconde il CSS).
 */
export function NavBar({ showLogo = true }: { showLogo?: boolean }) {
  const user = useAppSelector(selectCurrentUser)
  const title = useMatches()
    .map((match) => (match.handle as TitleRouteHandle | undefined)?.title)
    .findLast(Boolean)

  return (
    <header className="rs-nav rs-topbar">
      {showLogo && (
        <Link to={ROUTES.events} className="rs-topbar__brand">
          <Logo />
        </Link>
      )}
      {title && <p className="rs-topbar__title">{title}</p>}
      <div className="rs-topbar__actions">
        {user && <NotificationBell />}
        <UserMenu />
        {user && <LogoutButton variant="bar" />}
      </div>
    </header>
  )
}
