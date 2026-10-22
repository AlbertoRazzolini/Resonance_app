import { selectCurrentUser } from '@/features/auth/authSlice'
import { useGetConversationsQuery } from '@/features/chat/api/chatApi'
import { totalUnread } from '@/features/chat/chatCache'
import { useAppSelector } from '@/hooks/redux'

/** Sopra questo numero il badge scrive «9+» (come la campanella, scelta dello studente in FE-09b). */
const BADGE_MAX = 9

/**
 * Numero dei messaggi non letti sull'icona Messaggi: la somma degli `unreadCount` di tutte le conversazioni, da 1 a
 * «9+». Non mostra nulla senza non letti o senza sessione (e allora non chiama il server). Legge la stessa cache
 * dell'elenco, che i messaggi in arrivo aggiornano a mano. Ai lettori di schermo dice sempre il numero vero.
 */
export function MessagesBadge() {
  const user = useAppSelector(selectCurrentUser)
  const { data } = useGetConversationsQuery(undefined, { skip: !user })
  const total = data ? totalUnread(data) : 0
  if (total === 0) return null

  return (
    <>
      <span className="rs-nav-badge" data-testid="messages-badge" aria-hidden="true">
        {total > BADGE_MAX ? `${BADGE_MAX}+` : total}
      </span>
      <span className="visually-hidden">
        {total === 1 ? '1 messaggio non letto' : `${total} messaggi non letti`}
      </span>
    </>
  )
}
