import { Link } from 'react-router'
import { ROUTES } from '@/app/routes'
import { ConcertForm } from '../components/ConcertForm'

/** «Pubblica concerto» (solo HOST, la guardia sta nel router; progettazione, sezione 6.6). */
export function Component() {
  return (
    <div className="rs-edit rs-edit--full">
      <Link to={ROUTES.profile} className="rs-edit__back">
        ← Torna al profilo
      </Link>
      <h1>Pubblica concerto</h1>
      <ConcertForm />
    </div>
  )
}
