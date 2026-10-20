import { APPEAL_CONTACT } from '@/config'
import { formatDate } from '@/lib/format/dates'
import type { SuspensionDetails } from '@/types/users'

/**
 * Avviso di account sospeso (progettazione, sezione 4.7; decisione 83): motivo, scadenza in ora locale o "a tempo
 * indeterminato" e contatto per i ricorsi. Il motivo lo scrive un admin: si mostra come testo, mai come HTML.
 */
export function SuspendedNotice({ details }: { details: SuspensionDetails }) {
  const { suspensionReason, suspendedUntil } = details
  return (
    <section className="rs-suspended" role="alert">
      <div className="rs-suspended__head">
        <span className="rs-suspended__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2a8 8 0 0 1 6.32 12.9L7.1 5.68A7.96 7.96 0 0 1 12 4ZM5.68 7.1l11.22 11.22A8 8 0 0 1 5.68 7.1Z" />
          </svg>
        </span>
        <div>
          <span className="rs-suspended__badge">Restrizione attiva</span>
          <h2 className="rs-suspended__title">Account sospeso</h2>
        </div>
      </div>
      <div className="rs-suspended__details">
        <p className="rs-suspended__until">
          {suspendedUntil ? (
            <>
              Sospeso fino al{' '}
              <span className="rs-suspended__date">{formatDate(suspendedUntil)}</span>
            </>
          ) : (
            'A tempo indeterminato'
          )}
        </p>
        {suspensionReason && (
          <p>
            <strong>Motivo:</strong> {suspensionReason}
          </p>
        )}
        <p className="rs-suspended__appeal">
          Per un ricorso scrivi a <a href={`mailto:${APPEAL_CONTACT}`}>{APPEAL_CONTACT}</a>
        </p>
      </div>
    </section>
  )
}
