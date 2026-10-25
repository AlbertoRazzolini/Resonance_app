import { AnimateIcon } from '@animate-ui/react/icons'
import { Link, NavLink } from 'react-router'
import { ROUTES } from '@/app/routes'
import { Logo } from '@/components/ui/Logo'
import { selectCurrentUser, selectHasRole } from '@/features/auth/authSlice'
import { useAppSelector } from '@/hooks/redux'
import { LogoutButton } from './LogoutButton'
import { ADMIN_NAV_ITEMS, NAV_ITEMS, type NavItem } from './navItems'

/**
 * Una voce della colonna: l'animazione sta sulla voce intera, non sull'icona di 22 px, così parte appena il mouse entra, anche
 * sulla scritta. Il tocco (`animateOnTap`) serve ai tablet senza cursore, dove l'hover non scatta mai (FE-20).
 */
function SideItem({ label, to, Icon, Badge }: NavItem) {
  return (
    <AnimateIcon animateOnHover animateOnTap asChild>
      <NavLink to={to} className="rs-side-item">
        <Icon size={22} />
        <span>{label}</span>
        {Badge && <Badge />}
      </NavLink>
    </AnimateIcon>
  )
}

/**
 * Colonna di navigazione a sinistra, da 768 px (decisione 83): stretta con la scritta sotto l'icona a tablet, larga
 * con icona e scritta affiancate da 1200 px, dove ospita anche il logo (`showLogo`). La forma la decide il CSS. Per ADMIN
 * e SUPERADMIN, dopo le sei voci, c'è una schedina «ADMIN» (riquadro dal bordo giallo tenue) con «Utenti» e «Nascosti»:
 * dice a colpo d'occhio che è un'area a sé (solo interfaccia: la protezione vera è nel backend). In fondo, con la sessione,
 * il pulsante «Esci» (decisione dello studente, 25 ottobre).
 */
export function SideNav({ showLogo }: { showLogo: boolean }) {
  const isAdmin = useAppSelector(selectHasRole('ADMIN'))
  const user = useAppSelector(selectCurrentUser)

  return (
    <aside className="rs-sidenav">
      {showLogo && (
        <Link to={ROUTES.events} className="rs-sidenav__brand">
          <Logo />
        </Link>
      )}
      <nav aria-label="Navigazione principale" className="rs-sidenav__list">
        {NAV_ITEMS.map((item) => (
          <SideItem key={item.to} {...item} />
        ))}
        {isAdmin && (
          <div role="group" aria-label="Area admin" className="rs-side-admin">
            <span className="rs-side-admin__label" aria-hidden="true">
              ADMIN
            </span>
            {ADMIN_NAV_ITEMS.map((item) => (
              <SideItem key={item.to} {...item} />
            ))}
          </div>
        )}
      </nav>
      {user && (
        <div className="rs-sidenav__logout">
          <LogoutButton variant="side" />
        </div>
      )}
    </aside>
  )
}
