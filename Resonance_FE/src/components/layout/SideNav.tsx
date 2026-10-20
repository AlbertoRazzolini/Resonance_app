import { Link, NavLink } from 'react-router'
import { ROUTES } from '@/app/routes'
import { Logo } from '@/components/ui/Logo'
import { NAV_ITEMS } from './navItems'

/**
 * Colonna di navigazione a sinistra, da 768 px (decisione 83): stretta con la scritta sotto l'icona a tablet, larga
 * con icona e scritta affiancate da 1200 px, dove ospita anche il logo (`showLogo`). La forma la decide il CSS.
 */
export function SideNav({ showLogo }: { showLogo: boolean }) {
  return (
    <aside className="rs-sidenav">
      {showLogo && (
        <Link to={ROUTES.events} className="rs-sidenav__brand">
          <Logo />
        </Link>
      )}
      <nav aria-label="Navigazione principale" className="rs-sidenav__list">
        {NAV_ITEMS.map(({ label, to, Icon }) => (
          <NavLink key={to} to={to} className="rs-side-item">
            <Icon size={22} animateOnHover />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
