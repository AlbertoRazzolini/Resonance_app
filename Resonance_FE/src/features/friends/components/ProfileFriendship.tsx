import { Link, useLocation } from 'react-router'
import { ROUTES } from '@/app/routes'
import type { LoginRedirectState } from '@/components/guards/RequireAuth'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { selectCurrentUser } from '@/features/auth/authSlice'
import { useAppSelector } from '@/hooks/redux'
import { useGetFriendshipWithQuery } from '../api/friendsApi'
import { FriendshipButton } from './FriendshipButton'

type ProfileFriendshipProps = {
  userId: string
  displayName: string
}

/**
 * Pulsante dell'amicizia sul profilo pubblico (decisione 102): lo stato viene da `GET /api/friendships/with/{id}`. Chi non
 * ha la sessione vede il link «Accedi per aggiungere» (il login riporta al profilo) e non chiama il backend; sul proprio
 * profilo non c'è niente. Finché lo stato non arriva non si mostra nulla, così il pulsante non cambia forma.
 */
export function ProfileFriendship({ userId, displayName }: ProfileFriendshipProps) {
  const status = useAppSelector((state) => state.auth.status)
  const me = useAppSelector(selectCurrentUser)
  const { pathname, search, hash } = useLocation()
  const isOther = status === 'authenticated' && me?.id !== userId
  const { data, error } = useGetFriendshipWithQuery(userId, { skip: !isOther })

  if (status === 'anonymous') {
    const state: LoginRedirectState = { from: pathname + search + hash, loginRequired: true }
    return (
      <p className="rs-profile__friendship">
        <Link to={ROUTES.login} state={state}>
          Accedi per aggiungere
        </Link>
      </p>
    )
  }
  if (!isOther) return null
  if (error) {
    return (
      <div className="rs-profile__friendship">
        <ErrorAlert error={error} />
      </div>
    )
  }
  if (!data) return null

  return (
    <div className="rs-profile__friendship">
      <FriendshipButton
        userId={userId}
        displayName={displayName}
        status={data.status}
        friendshipId={data.friendshipId}
        addLabel="Aggiungi agli amici"
      />
    </div>
  )
}
