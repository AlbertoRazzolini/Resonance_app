import { useId, useState } from 'react'
import { Button } from 'react-bootstrap'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { selectCurrentUser } from '@/features/auth/authSlice'
import { useAppDispatch, useAppSelector } from '@/hooks/redux'
import { confirmationShown } from '@/lib/notices/confirmationSlice'
import type { AdminUserResponse } from '@/types/admin'
import { useGrantAdminMutation, useRevokeAdminMutation } from '../api/adminApi'
import { canActOn, platformLevel } from '../platformLevel'

/**
 * Perché «Rendi admin» è spento adesso, o `undefined` se si può: il backend risponderebbe 409 `USER_NOT_VERIFIED` o
 * `USER_NOT_ACTIVE` (progettazione, sezione 5.4). Una sospensione già scaduta conta come attiva, anche se la riattivazione
 * pigra non ha ancora chiuso la riga (decisione 54).
 */
function grantBlock(user: AdminUserResponse): string | undefined {
  if (!user.emailVerified) return 'Email non ancora verificata'
  const stillSuspended =
    user.status === 'SUSPENDED' && (user.suspendedUntil === null || Date.parse(user.suspendedUntil) > Date.now())
  if (stillSuspended) return 'Account sospeso: riattivalo prima'
  return undefined
}

/**
 * Nomina o revoca del ruolo ADMIN su una riga dell'elenco utenti (progettazione, sezione 5.4). Solo per il SUPERADMIN,
 * mai su un altro SUPERADMIN né su se stesso: per gli altri non disegna niente (solo interfaccia, il controllo vero è nel
 * backend). «Rendi admin» è spento con la spiegazione se l'utente non è verificato o è sospeso; «Togli admin» è sempre
 * attivo, perché la revoca non dipende dallo stato (decisione 54). Ogni azione chiede conferma; un rifiuto del backend
 * resta nella finestra.
 */
export function AdminRoleButton({ user }: { user: AdminUserResponse }) {
  const dispatch = useAppDispatch()
  const me = useAppSelector(selectCurrentUser)
  const [grant, granting] = useGrantAdminMutation()
  const [revoke, revoking] = useRevokeAdminMutation()
  const [confirming, setConfirming] = useState(false)
  const hintId = useId()

  if (!me || platformLevel(me.roles) < 2 || !canActOn(me, user)) return null

  const isAdmin = user.roles.includes('ADMIN')
  const block = isAdmin ? undefined : grantBlock(user)
  const mutation = isAdmin ? revoking : granting

  function close() {
    setConfirming(false)
    granting.reset()
    revoking.reset()
  }

  async function handleConfirm() {
    try {
      if (isAdmin) await revoke(user.id).unwrap()
      else await grant(user.id).unwrap()
      dispatch(confirmationShown(isAdmin ? 'Ruolo admin revocato.' : 'Ruolo admin assegnato.'))
      close()
    } catch {
      // L'errore resta nello stato della mutazione e la finestra lo mostra
    }
  }

  return (
    <>
      <Button
        variant="outline-light"
        size="sm"
        disabled={block !== undefined}
        aria-label={`${isAdmin ? 'Togli admin' : 'Rendi admin'} ${user.displayName}`}
        aria-describedby={block ? hintId : undefined}
        onClick={() => setConfirming(true)}
      >
        {isAdmin ? 'Togli admin' : 'Rendi admin'}
      </Button>
      {block && (
        <span id={hintId} className="rs-admin-row__hint">
          {block}
        </span>
      )}

      <ConfirmDialog
        show={confirming}
        title={isAdmin ? `Togliere il ruolo admin a ${user.displayName}?` : `Rendere admin ${user.displayName}?`}
        body={
          isAdmin
            ? `${user.displayName} non potrà più sospendere gli utenti né nascondere i contenuti.`
            : `${user.displayName} potrà sospendere gli utenti e nascondere i contenuti.`
        }
        confirmLabel={isAdmin ? 'Togli admin' : 'Rendi admin'}
        busy={mutation.isLoading}
        error={mutation.error}
        onConfirm={() => void handleConfirm()}
        onCancel={close}
      />
    </>
  )
}
