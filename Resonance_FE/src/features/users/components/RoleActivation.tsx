import { Button } from 'react-bootstrap'
import { Link } from 'react-router'
import { ROUTES } from '@/app/routes'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { selectHasRole } from '@/features/auth/authSlice'
import { useAppSelector } from '@/hooks/redux'
import { useActivateRoleMutation, type SelfServiceRole } from '../api/usersApi'

/** Un ruolo attivabile: cosa sblocca, il pulsante e, a ruolo attivo, il collegamento a ciò che si può pubblicare. */
type RoleCard = {
  role: SelfServiceRole
  title: string
  description: string
  action: string
  active: string
  publishLabel: string
  publishTo: string
}

const CARDS: RoleCard[] = [
  {
    role: 'musician',
    title: 'Musicista',
    description: 'Pubblica indie event e annunci per cercare altri musicisti.',
    action: 'Diventa musicista',
    active: 'Sei musicista',
    publishLabel: 'Pubblica un indie event',
    publishTo: ROUTES.newIndieEvent,
  },
  {
    role: 'host',
    title: 'Host',
    description: 'Pubblica i concerti del tuo locale.',
    action: 'Diventa host',
    active: 'Sei host',
    publishLabel: 'Pubblica un concerto',
    publishTo: ROUTES.newConcert,
  },
]

/**
 * Attivazione di MUSICIAN e HOST (progettazione, sezione 5.3): ogni ruolo spiega cosa sblocca e, finché manca, ha un
 * pulsante che lo attiva con un solo clic, senza conferma (non si disattiva, ma non ha effetti dannosi). L'attivazione
 * è idempotente (decisione 53) e un ruolo non implica l'altro. I ruoli servono qui a mostrare o nascondere: la
 * protezione vera è nel backend.
 */
export function RoleActivation() {
  const isMusician = useAppSelector(selectHasRole('MUSICIAN'))
  const isHost = useAppSelector(selectHasRole('HOST'))
  const [activateRole, { isLoading, error }] = useActivateRoleMutation()
  const owned = { musician: isMusician, host: isHost }

  async function activate(role: SelfServiceRole) {
    try {
      await activateRole(role).unwrap()
    } catch {
      // L'errore lo mostra la sezione, dallo stato della mutazione
    }
  }

  return (
    <div className="rs-roles">
      <ErrorAlert error={error} />
      {CARDS.map((card) => (
        <article key={card.role} className="rs-role-card">
          <h3>{card.title}</h3>
          <p>{card.description}</p>
          {owned[card.role] ? (
            <>
              <p className="rs-role-card__active">{card.active}</p>
              <Link to={card.publishTo}>{card.publishLabel}</Link>
            </>
          ) : (
            <>
              <p className="rs-role-card__note">Non si può disattivare.</p>
              <Button variant="primary" disabled={isLoading} onClick={() => void activate(card.role)}>
                {card.action}
              </Button>
            </>
          )}
        </article>
      ))}
    </div>
  )
}
