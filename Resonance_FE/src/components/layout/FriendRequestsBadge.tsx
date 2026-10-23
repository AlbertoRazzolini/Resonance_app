import { selectCurrentUser } from '@/features/auth/authSlice'
import { useGetPendingRequestsQuery } from '@/features/friends/api/friendsApi'
import { useAppSelector } from '@/hooks/redux'

/** Sopra questo numero il badge scrive «9+» (come Messaggi e la campanella). */
const BADGE_MAX = 9

/**
 * Numero delle richieste di amicizia ricevute in attesa sulla voce Amici, da 1 a «9+»: il `totalElements` della stessa
 * query della campanella, quindi i due numeri restano uguali e la cache è una sola. Non mostra nulla senza richieste o
 * senza sessione (e allora non chiama il server). Si rilegge al ritorno sulla scheda; una richiesta live, una
 * riconnessione e le azioni su una richiesta invalidano la cache. Ai lettori di schermo dice sempre il numero vero.
 */
export function FriendRequestsBadge() {
  const user = useAppSelector(selectCurrentUser)
  const { data } = useGetPendingRequestsQuery(undefined, { skip: !user, refetchOnFocus: true })
  const total = data?.totalElements ?? 0
  if (total === 0) return null

  return (
    <>
      <span className="rs-nav-badge" data-testid="friends-badge" aria-hidden="true">
        {total > BADGE_MAX ? `${BADGE_MAX}+` : total}
      </span>
      <span className="visually-hidden">
        {total === 1
          ? '1 richiesta di amicizia ricevuta'
          : `${total} richieste di amicizia ricevute`}
      </span>
    </>
  )
}
