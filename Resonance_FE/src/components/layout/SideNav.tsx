import { AnimateIcon } from '@animate-ui/react/icons'
import { Link, NavLink } from 'react-router'
import { ROUTES } from '@/app/routes'
import { Logo } from '@/components/ui/Logo'
import { selectHasRole } from '@/features/auth/authSlice'
import { useAppSelector } from '@/hooks/redux'
import { ADMIN_NAV_ITEMS, NAV_ITEMS } from './navItems'

/**
 * Colonna di navigazione a sinistra, da 768 px (decisione 83): stretta con la scritta sotto l'icona a tablet, larga
 * con icona e scritta affiancate da 1200 px, dove ospita anche il logo (`showLogo`). La forma la decide il CSS. Per ADMIN
 * e SUPERADMIN, dopo le cinque voci, ci sono «Utenti» e «Nascosti» (solo interfaccia: la protezione vera è nel backend).
 */
export function SideNav({ showLogo }: { showLogo: boolean }) {
  const isAdmin = useAppSelector(selectHasRole('ADMIN'))
  const items = isAdmin ? [...NAV_ITEMS, ...ADMIN_NAV_ITEMS] : NAV_ITEMS

  return (
    <aside className="rs-sidenav">
      {showLogo && (
        <Link to={ROUTES.events} className="rs-sidenav__brand">
          <Logo />
        </Link>
      )}
      <nav aria-label="Navigazione principale" className="rs-sidenav__list">
        {items.map(({ label, to, Icon, Badge }) => (
          // L'animazione sta sulla voce intera, non sull'icona di 22 px: parte appena il mouse entra, anche sulla scritta
          <AnimateIcon key={to} animateOnHover asChild>
            <NavLink to={to} className="rs-side-item">
              <Icon size={22} />
              <span>{label}</span>
              {Badge && <Badge />}
            </NavLink>
          </AnimateIcon>
        ))}
      </nav>
    </aside>
  )
}
