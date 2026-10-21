import { Link } from 'react-router'
import { ROUTES } from '@/app/routes'
import { EmptyState } from '@/components/ui/EmptyState'
import { selectHasRole } from '@/features/auth/authSlice'
import { useAppSelector } from '@/hooks/redux'
import { CollabPages } from '../components/CollabPages'

/**
 * Bacheca collab (progettazione, sezione 6.7), aperta anche a chi non ha la sessione: gli annunci aperti dal più
 * recente con «Carica altri». «Pubblica annuncio» e l'invito dello stato vuoto compaiono solo ai MUSICIAN (solo
 * interfaccia: la protezione vera è nel backend). I filtri per ruolo o strumento sono una funzione futura.
 */
export function Component() {
  const isMusician = useAppSelector(selectHasRole('MUSICIAN'))

  return (
    <>
      <div className="rs-collab-head">
        <div>
          <h1>Collab</h1>
          <p className="text-body-secondary">Annunci per progetti, musicisti e collaborazioni.</p>
        </div>
        {isMusician && (
          <Link className="btn btn-outline-light" to={ROUTES.newCollab}>
            Pubblica annuncio
          </Link>
        )}
      </div>

      <section aria-label="Annunci collab">
        <CollabPages
          emptyState={
            <EmptyState
              title="Nessun annuncio aperto."
              hint={isMusician ? 'Pubblica il primo!' : undefined}
            />
          }
        />
      </section>
    </>
  )
}
