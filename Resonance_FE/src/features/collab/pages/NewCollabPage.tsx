import { Link } from 'react-router'
import { ROUTES } from '@/app/routes'
import { CollabForm } from '../components/CollabForm'

/** «Pubblica annuncio» (solo MUSICIAN, la guardia sta nel router; progettazione, sezione 6.7). */
export function Component() {
  return (
    <div className="rs-edit">
      <Link to={ROUTES.collab} className="rs-edit__back">
        ← Torna alla bacheca
      </Link>
      <h1>Pubblica annuncio</h1>
      <CollabForm />
    </div>
  )
}
