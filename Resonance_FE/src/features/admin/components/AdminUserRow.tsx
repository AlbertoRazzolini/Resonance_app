import type { ReactNode } from 'react'
import { UserText } from '@/components/ui/UserText'
import { formatDate } from '@/lib/format/dates'
import type { AdminUserResponse } from '@/types/admin'
import { ROLE_LABELS, type UserStatus } from '@/types/users'

/** Nome da mostrare per ogni stato (testi approvati dallo studente, FE-10). */
const STATUS_LABELS: Record<UserStatus, string> = { ACTIVE: 'Attivo', SUSPENDED: 'Sospeso' }

/**
 * Una riga dell'elenco utenti: nome, email, ruoli, stato (per un sospeso scadenza e motivo, il motivo da `UserText`),
 * «Non verificato» e data di registrazione. È una riga di
 * tabella da `lg`; sotto, il CSS la ridisegna come scheda (le etichette stanno in `data-label`). Le azioni stanno nella
 * cella finale (`children`).
 */
export function AdminUserRow({ user, children }: { user: AdminUserResponse; children?: ReactNode }) {
  return (
    <tr className="rs-admin-row">
      <td className="rs-admin-row__who">
        <div className="rs-admin-row__cell rs-admin-row__cell--stack">
          <span className="rs-admin-row__name">{user.displayName}</span>
          <span className="rs-admin-row__email">{user.email}</span>
        </div>
      </td>
      <td data-label="Ruoli">
        <ul className="rs-admin-row__roles">
          {user.roles.map((role) => (
            <li key={role} className="rs-role-badge">
              {ROLE_LABELS[role]}
            </li>
          ))}
        </ul>
      </td>
      <td data-label="Stato">
        <div className="rs-admin-row__cell">
          <span className={`rs-status rs-status--${user.status.toLowerCase()}`}>{STATUS_LABELS[user.status]}</span>
          {!user.emailVerified && <span className="rs-admin-row__unverified">Non verificato</span>}
          {user.status === 'SUSPENDED' && (
            <p className="rs-admin-row__suspension">
              <span>
                {user.suspendedUntil
                  ? `Sospeso fino al ${formatDate(user.suspendedUntil)}`
                  : 'Sospeso a tempo indeterminato'}
              </span>
              {user.suspensionReason && (
                <span>
                  <UserText text={`Motivo: ${user.suspensionReason}`} />
                </span>
              )}
            </p>
          )}
        </div>
      </td>
      <td data-label="Registrato il">
        <time dateTime={user.createdAt}>{formatDate(user.createdAt)}</time>
      </td>
      <td className="rs-admin-row__actions">
        <div className="rs-admin-row__cell">{children}</div>
      </td>
    </tr>
  )
}
