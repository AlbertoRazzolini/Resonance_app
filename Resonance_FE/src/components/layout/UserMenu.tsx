import { Dropdown } from 'react-bootstrap'
import { Link } from 'react-router'
import { ROUTES } from '@/app/routes'
import StarBorder from '@/components/motion/StarBorder'
import { STAR_BORDER_LOOK } from '@/components/motion/starBorderLook'
import { Avatar } from '@/components/ui/Avatar'
import { selectCurrentUser, selectHasRole } from '@/features/auth/authSlice'
import { useLogoutMutation } from '@/features/auth/api/authApi'
import { useAppSelector } from '@/hooks/redux'
import { useMediaQuery } from '@/hooks/useMediaQuery'

/**
 * Menu utente della barra (decisione 83): per l'anonimo i pulsanti Accedi e Registrati; per chi ha la sessione il
 * cerchio giallo con la foto o l'iniziale e un menu con le voci «Pubblica» secondo i ruoli, sul telefono le voci
 * dell'area di moderazione per ADMIN e SUPERADMIN (da 768 px le ha la colonna a sinistra; solo per mostrare o nascondere: la
 * protezione vera è nel backend) e "Esci".
 */
export function UserMenu() {
  const user = useAppSelector(selectCurrentUser)
  const isHost = useAppSelector(selectHasRole('HOST'))
  const isMusician = useAppSelector(selectHasRole('MUSICIAN'))
  // Il SUPERADMIN vale anche come ADMIN (selectHasRole): la voce dell'area di moderazione serve a entrambi
  const isAdmin = useAppSelector(selectHasRole('ADMIN'))
  // Da 768 px la colonna a sinistra ha già «Utenti» e «Nascosti»: nel menu sarebbero ridondanti, restano solo sul telefono
  const hasSideNav = useMediaQuery('(min-width: 768px)')
  const [logout] = useLogoutMutation()

  if (!user) {
    return (
      <div className="d-flex align-items-center gap-2">
        <StarBorder
          {...STAR_BORDER_LOOK}
          as={Link}
          to={ROUTES.login}
          className="rs-nav-login"
          backgroundColor="transparent"
          textColor="var(--rs-color-text)"
          borderColor="var(--rs-color-border-strong)"
        >
          Accedi
        </StarBorder>
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
          {isAdmin && !hasSideNav && (
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
