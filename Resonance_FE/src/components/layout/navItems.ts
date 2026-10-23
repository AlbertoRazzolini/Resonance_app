import type { ComponentType } from 'react'
import { Calendar } from '@/components/animate-ui/icons/calendar'
import { Coffee } from '@/components/animate-ui/icons/coffee'
import { EyeOff } from '@/components/animate-ui/icons/eye-off'
import { Layers } from '@/components/animate-ui/icons/layers'
import { MessageSquare } from '@/components/animate-ui/icons/message-square'
import { User } from '@/components/animate-ui/icons/user'
import { UserCog } from '@/components/animate-ui/icons/user-cog'
import { Users } from '@/components/animate-ui/icons/users'
import { ROUTES } from '@/app/routes'
import { FriendRequestsBadge } from './FriendRequestsBadge'
import { MessagesBadge } from './MessagesBadge'

/** Una voce della navigazione principale: la stessa lista serve alle tab del telefono e alla colonna. */
export type NavItem = {
  label: string
  to: string
  Icon: ComponentType<{ size?: number; animateOnTap?: boolean; animateOnHover?: boolean }>
  /** Numero o segno sopra la voce (i messaggi non letti, le richieste di amicizia): lo disegna il componente, che decide quando mostrarsi. */
  Badge?: ComponentType
}

/** Le sei voci: le cinque del prototipo (decisione 83) più Amici, in coda (FE-17). Messaggi, Profilo e Amici li protegge il router. */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Eventi', to: ROUTES.events, Icon: Calendar },
  { label: 'Collab', to: ROUTES.collab, Icon: Users },
  { label: 'Feed', to: ROUTES.feed, Icon: Layers },
  { label: 'Messaggi', to: ROUTES.chat, Icon: MessageSquare, Badge: MessagesBadge },
  { label: 'Profilo', to: ROUTES.profile, Icon: User },
  { label: 'Amici', to: ROUTES.friends, Icon: Coffee, Badge: FriendRequestsBadge },
]

/**
 * Le voci dell'area di moderazione, solo per ADMIN e SUPERADMIN e solo nella colonna a sinistra (da 768 px): sul telefono
 * la barra di tab non le ha e l'area admin sta nel menu utente (scelta dello studente, FE-10).
 */
export const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'Utenti', to: ROUTES.adminUsers, Icon: UserCog },
  { label: 'Nascosti', to: ROUTES.adminContent, Icon: EyeOff },
]
