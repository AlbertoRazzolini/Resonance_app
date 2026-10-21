import { AnimateIcon } from '@animate-ui/react/icons'
import { NavLink } from 'react-router'
import { NAV_ITEMS } from './navItems'

/**
 * Barra di tab in basso, solo sul telefono (decisione 83): ferma sul bordo dello schermo, con la voce attiva in
 * giallo. `NavLink` segna la voce corrente anche sulle sottopagine (es. una conversazione).
 */
export function TabBar() {
  return (
    <nav aria-label="Navigazione principale" className="rs-tabbar">
      {NAV_ITEMS.map(({ label, to, Icon }) => (
        // L'animazione sta sulla voce intera: parte toccando anche la scritta, non solo l'icona
        <AnimateIcon key={to} animateOnTap asChild>
          <NavLink to={to} className="rs-tab">
            <Icon size={24} />
            <span>{label}</span>
          </NavLink>
        </AnimateIcon>
      ))}
    </nav>
  )
}
