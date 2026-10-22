import { Dropdown } from 'react-bootstrap'
import { Link } from 'react-router'
import { ROUTES } from '@/app/routes'
import { Avatar } from '@/components/ui/Avatar'
import { selectCurrentUser, selectHasRole } from '@/features/auth/authSlice'
import { useLogoutMutation } from '@/features/auth/api/authApi'
import { useAppSelector } from '@/hooks/redux'

/**
 * Menu utente della barra (decisione 83): per l'anonimo i pulsanti Accedi e Registrati; per chi ha la sessione il
 * cerchio giallo con la foto o l'iniziale e un menu con «Amici», le voci «Pubblica» secondo i ruoli, le voci dell'area di
 * moderazione per ADMIN e SUPERADMIN (solo per mostrare o nascondere: la protezione vera è nel backend) e "Esci".
 */
export function UserMenu() {
  const user = useAppSelector(selectCurrentUser)
  const isHost = useAppSelector(selectHasRole('HOST'))
  const isMusician = useAppSelector(selectHasRole('MUSICIAN'))
  // Il SUPERADMIN vale anche come ADMIN (selectHasRole): la voce dell'area di moderazione serve a entrambi
  const isAdmin = useAppSelector(selectHasRole('ADMIN'))
  const [logout] = useLogoutMutation()

  if (!user) {
    return (
      <div className="d-flex align-items-center gap-2">
        <Link to={ROUTES.login} className="btn btn-outline-light btn-sm">
          Accedi
        </Link>
        <Link to={ROUTES.register} className="btn btn-primary btn-sm">
          Registrati
        </Link>
      </div>
    )
  }

  return (
    <div className="rs-user">
      {/* Il nome lo mostra solo il desktop (CSS); il pulsante ha già il suo nome per i lettori di schermo */}
      <span className="rs-user__name" aria-hidden="true">
        {user.displayName}
      </span>
      <Dropdown align="end">
        <Dropdown.Toggle
          as="button"
          type="button"
          className="rs-avatar-toggle"
          aria-label={`Menu dell'account di ${user.displayName}`}
        >
          <Avatar displayName={user.displayName} avatarUrl={user.avatarUrl} />
        </Dropdown.Toggle>
        <Dropdown.Menu>
          <Dropdown.Item as={Link} to={ROUTES.friends}>
            Amici
          </Dropdown.Item>
          <Dropdown.Divider />
          {isHost && (
            <Dropdown.Item as={Link} to={ROUTES.newConcert}>
              Pubblica concerto
            </Dropdown.Item>
          )}
          {isMusician && (
            <Dropdown.Item as={Link} to={ROUTES.newIndieEvent}>
              Pubblica indie event
            </Dropdown.Item>
          )}
          {(isHost || isMusician) && <Dropdown.Divider />}
          {isAdmin && (
            <>
              <Dropdown.Item as={Link} to={ROUTES.adminUsers}>
                Utenti
              </Dropdown.Item>
              <Dropdown.Item as={Link} to={ROUTES.adminContent}>
                Contenuti nascosti
              </Dropdown.Item>
              <Dropdown.Divider />
            </>
          )}
          <Dropdown.Item as="button" type="button" onClick={() => void logout()}>
            Esci
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    </div>
  )
}
