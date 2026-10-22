import type { ComponentType } from 'react'
import { Calendar } from '@/components/animate-ui/icons/calendar'
import { Layers } from '@/components/animate-ui/icons/layers'
import { MessageSquare } from '@/components/animate-ui/icons/message-square'
import { User } from '@/components/animate-ui/icons/user'
import { Users } from '@/components/animate-ui/icons/users'
import { ROUTES } from '@/app/routes'
import { MessagesBadge } from './MessagesBadge'

/** Una voce della navigazione principale: la stessa lista serve alle tab del telefono e alla colonna. */
export type NavItem = {
  label: string
  to: string
  Icon: ComponentType<{ size?: number; animateOnTap?: boolean; animateOnHover?: boolean }>
  /** Numero o segno sopra la voce (i messaggi non letti): lo disegna il componente, che decide quando mostrarsi. */
  Badge?: ComponentType
}

/** Le cinque voci, nell'ordine del prototipo (decisione 83). Messaggi e Profilo li protegge il router. */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Eventi', to: ROUTES.events, Icon: Calendar },
  { label: 'Collab', to: ROUTES.collab, Icon: Users },
  { label: 'Feed', to: ROUTES.feed, Icon: Layers },
  { label: 'Messaggi', to: ROUTES.chat, Icon: MessageSquare, Badge: MessagesBadge },
  { label: 'Profilo', to: ROUTES.profile, Icon: User },
]
