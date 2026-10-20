import { Link } from 'react-router'
import { ROUTES } from '@/app/routes'
import { IndieEventForm } from '../components/IndieEventForm'

/** «Pubblica indie event» (solo MUSICIAN, la guardia sta nel router; progettazione, sezione 6.6). */
export function Component() {
  return (
    <div className="rs-edit">
      <Link to={ROUTES.profile} className="rs-edit__back">
        ← Torna al profilo
      </Link>
      <h1>Pubblica indie event</h1>
      <IndieEventForm />
    </div>
  )
}
