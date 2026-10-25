import { Link } from 'react-router'
import { ROUTES } from '@/app/routes'
import { selectCurrentUser } from '@/features/auth/authSlice'
import { useAppSelector } from '@/hooks/redux'
import { LocationSettings } from '../components/LocationSettings'
import { ProfileForm } from '../components/ProfileForm'
import { RoleActivation } from '../components/RoleActivation'

/**
 * Modifica del profilo (progettazione, sezione 6.5): i dati personali; posizione e ruoli stanno sotto, nelle loro
 * sezioni.
 */
export function Component() {
  const user = useAppSelector(selectCurrentUser)

  // RequireAuth non mostra questa pagina senza sessione: l'utente c'è sempre
  if (!user) return null

  return (
    <div className="rs-edit rs-edit--full">
      <Link to={ROUTES.profile} className="rs-edit__back">
        ← Torna al profilo
      </Link>
      <h1>Modifica profilo</h1>
      <section aria-labelledby="edit-data-title" className="rs-edit__section">
        <h2 id="edit-data-title">I tuoi dati</h2>
        <ProfileForm user={user} />
      </section>
      <section aria-labelledby="edit-location-title" className="rs-edit__section">
        <h2 id="edit-location-title">La tua posizione</h2>
        <LocationSettings />
      </section>
      <section aria-labelledby="edit-roles-title" className="rs-edit__section">
        <h2 id="edit-roles-title">I tuoi ruoli</h2>
        <RoleActivation />
      </section>
    </div>
  )
}
