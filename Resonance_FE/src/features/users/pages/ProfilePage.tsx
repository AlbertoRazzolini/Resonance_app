import { Alert } from 'react-bootstrap'
import { Link, useLocation } from 'react-router'
import { ROUTES } from '@/app/routes'
import { selectCurrentUser } from '@/features/auth/authSlice'
import { wasCollabDeleted } from '@/features/collab/collabForm'
import { wasEventDeleted } from '@/features/events/eventForm'
import { useAppSelector } from '@/hooks/redux'
import { AreaTabs } from '../components/AreaTabs'
import { ProfileHeader } from '../components/ProfileHeader'
import { wasProfileUpdated } from '../profilePatch'

/**
 * Profilo dell'utente autenticato (progettazione, sezione 6.5): la sua scheda, «Modifica profilo» e gli avvisi dopo
 * un salvataggio o una cancellazione (stato del router, non URL). Sotto, le schede dei contenuti secondo i ruoli (`AreaTabs`).
 */
export function Component() {
  const user = useAppSelector(selectCurrentUser)
  const location = useLocation()

  // RequireAuth non mostra questa pagina senza sessione: l'utente c'è sempre
  if (!user) return null

  return (
    <>
      {wasProfileUpdated(location.state) && (
        <Alert variant="success" role="status">
          Profilo aggiornato.
        </Alert>
      )}
      {wasEventDeleted(location.state) && (
        <Alert variant="success" role="status">
          Evento cancellato.
        </Alert>
      )}
      {wasCollabDeleted(location.state) && (
        <Alert variant="success" role="status">
          Annuncio cancellato.
        </Alert>
      )}
      <ProfileHeader
        displayName={user.displayName}
        avatarUrl={user.avatarUrl}
        city={user.city}
        bio={user.bio}
        roles={user.roles}
      >
        <Link to={ROUTES.profileEdit} className="btn btn-primary">
          Modifica profilo
        </Link>
      </ProfileHeader>
      <AreaTabs />
    </>
  )
}
