import { Bell } from '@/components/animate-ui/icons/bell'

/**
 * Campanella delle notifiche, per ora disattivata: la collega FE-09b (decisione 83). Ha già il posto e il nome
 * definitivi, così la barra non cambia quando le notifiche arrivano.
 */
export function NotificationBell() {
  return (
    <button type="button" className="rs-bell" aria-label="Notifiche" disabled>
      <Bell size={22} />
    </button>
  )
}
