import { Link } from 'react-router'
import { ROUTES } from '@/app/routes'

/**
 * Pagina di un evento che non esiste, è nascosto o è la bozza di un altro utente: il backend risponde 404 per tutti i
 * casi (progettazione, sezione 6.6) e qui non si distingue (Review Focus 6).
 */
export function EventNotFound() {
  return (
    <>
      <h1>Evento non trovato</h1>
      <p>L'evento non esiste o non è più disponibile.</p>
      <Link className="btn btn-outline-light" to={ROUTES.events}>
        Torna agli eventi
      </Link>
    </>
  )
}
