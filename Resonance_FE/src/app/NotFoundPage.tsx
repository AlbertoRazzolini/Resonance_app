import { Link } from 'react-router'
import { ROUTES } from './routes'

/** Pagina mostrata per ogni percorso che l'app non conosce (anche un contenuto nascosto aperto da un link). */
export function Component() {
  return (
    <>
      <h1>Pagina non trovata</h1>
      <p>Il contenuto che cerchi non esiste o non è più disponibile.</p>
      <Link to={ROUTES.home}>Torna alla pagina iniziale</Link>
    </>
  )
}
