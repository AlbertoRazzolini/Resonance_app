import { Link } from 'react-router'
import { ROUTES } from '@/app/routes'

/**
 * Pagina mostrata al posto di una rotta riservata a chi non ha il ruolo richiesto. Il testo è generico: non
 * nomina ruoli né aree (approvato dallo studente il 19 ottobre).
 */
export function AccessDenied() {
  return (
    <>
      <h1>Accesso negato</h1>
      <p className="text-body-secondary">Non hai i permessi per accedere a questa pagina.</p>
      <Link to={ROUTES.home}>Torna alla home</Link>
    </>
  )
}
