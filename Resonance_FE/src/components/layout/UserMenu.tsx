import { Dropdown } from 'react-bootstrap'
import { Link } from 'react-router'
import { ROUTES } from '@/app/routes'
import { selectCurrentUser } from '@/features/auth/authSlice'
import { useLogoutMutation } from '@/features/auth/api/authApi'
import { useAppSelector } from '@/hooks/redux'

const graphemes = new Intl.Segmenter('it', { granularity: 'grapheme' })

/** Prima lettera del nome in maiuscolo; con un'emoji prende l'emoji intera, non un carattere spezzato. */
function initialOf(displayName: string): string {
  const first = graphemes.segment(displayName.trim())[Symbol.iterator]().next()
  return first.done ? '?' : first.value.segment.toUpperCase()
}

/**
 * Menu utente della barra (decisione 83): per l'anonimo i pulsanti Accedi e Registrati; per chi ha la sessione il
 * cerchio giallo con l'iniziale e un menu con "Esci". Le card successive aggiungono qui le loro voci (Profilo, Area
 * personale). La foto sostituisce l'iniziale con FE-04.
 */
export function UserMenu() {
  const user = useAppSelector(selectCurrentUser)
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
          className="rs-avatar"
          aria-label={`Menu dell'account di ${user.displayName}`}
        >
          {initialOf(user.displayName)}
        </Dropdown.Toggle>
        <Dropdown.Menu>
          <Dropdown.Item as="button" type="button" onClick={() => void logout()}>
            Esci
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    </div>
  )
}
