import { Link, useParams } from 'react-router'
import { ROUTES } from '@/app/routes'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { ProfileFriendship } from '@/features/friends/components/ProfileFriendship'
import { useGetPublicUserQuery } from '../api/usersApi'
import { ProfileHeader } from '../components/ProfileHeader'

/**
 * Profilo di un altro utente (progettazione, sezione 6.5), aperto anche a chi non ha la sessione: il backend non
 * restituisce mai email né coordinate. Un utente inesistente o non verificato è un 404, che qui diventa «Utente non
 * trovato.» (come per i contenuti nascosti, Review Focus 6); gli altri errori si mostrano con il loro messaggio.
 */
export function Component() {
  const { id } = useParams()
  const { data, error, isLoading } = useGetPublicUserQuery(id ?? '', { skip: !id })

  if (isLoading) {
    return (
      <p className="text-body-secondary" role="status">
        Caricamento…
      </p>
    )
  }

  if (error && 'status' in error && error.status === 404) {
    return (
      <>
        <h1>Utente non trovato.</h1>
        <Link to={ROUTES.home}>Torna alla pagina iniziale</Link>
      </>
    )
  }

  if (error || !data) return <ErrorAlert error={error ?? new Error('profilo assente')} />

  return (
    <ProfileHeader
      displayName={data.displayName}
      avatarUrl={data.avatarUrl}
      city={data.city}
      bio={data.bio}
      roles={data.roles}
      friendship={<ProfileFriendship userId={data.id} displayName={data.displayName} />}
    />
  )
}
