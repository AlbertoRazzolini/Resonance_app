import { Link } from 'react-router'
import { ROUTES } from '@/app/routes'

/**
 * Pagina di un annuncio che non esiste o è nascosto: il backend risponde 404 per tutti e due i casi (progettazione,
 * sezione 6.7) e qui non si distingue (Review Focus 6).
 */
export function CollabNotFound() {
  return (
    <>
      <h1>Annuncio non trovato</h1>
      <p>L'annuncio non esiste o non è più disponibile.</p>
      <Link className="btn btn-outline-light" to={ROUTES.collab}>
        Torna alla bacheca
      </Link>
    </>
  )
}
