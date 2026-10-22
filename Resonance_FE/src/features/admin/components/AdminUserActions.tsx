import { useId, useState } from 'react'
import { Button } from 'react-bootstrap'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ERROR_MESSAGES } from '@/lib/errors/errorMessages'
import { confirmationShown } from '@/lib/notices/confirmationSlice'
import { selectCurrentUser } from '@/features/auth/authSlice'
import { useAppDispatch, useAppSelector } from '@/hooks/redux'
import type { AdminUserResponse, SuspendUserRequest } from '@/types/admin'
import { useReactivateUserMutation, useSuspendUserMutation } from '../api/adminApi'
import { canActOn } from '../platformLevel'
import { SuspensionDialog } from './SuspensionDialog'

/**
 * Azioni di una riga dell'elenco utenti: «Sospendi» (finestra con motivo e durata) o, per un utente sospeso, «Riattiva»
 * (con conferma). Dove la regola dei livelli lo vieta (se stessi, un ruolo pari o superiore: progettazione, sezione 5.6)
 * il pulsante è spento e una frase spiega perché; il controllo vero resta nel backend. Dopo l'azione l'elenco si rilegge e
 * la riga si aggiorna da sola.
 */
export function AdminUserActions({ user }: { user: AdminUserResponse }) {
  const dispatch = useAppDispatch()
  const me = useAppSelector(selectCurrentUser)
  const [suspend, suspension] = useSuspendUserMutation()
  const [reactivate, reactivation] = useReactivateUserMutation()
  const [dialog, setDialog] = useState<'suspend' | 'reactivate' | null>(null)
  const hintId = useId()
  const allowed = me !== null && canActOn(me, user)
  const isSuspended = user.status === 'SUSPENDED'

  function close() {
    setDialog(null)
    suspension.reset()
    reactivation.reset()
  }

  async function handleSuspend(body: SuspendUserRequest) {
    try {
      await suspend({ id: user.id, body }).unwrap()
      dispatch(confirmationShown('Account sospeso.'))
      close()
    } catch {
      // L'errore resta nello stato della mutazione e la finestra lo mostra
    }
  }

  async function handleReactivate() {
    try {
      await reactivate(user.id).unwrap()
      dispatch(confirmationShown('Account riattivato.'))
      close()
    } catch {
      // Idem: l'errore resta nella finestra
    }
  }

  return (
    <>
      <Button
        variant={isSuspended ? 'outline-light' : 'outline-danger'}
        size="sm"
        disabled={!allowed}
        // Il nome serve a chi legge con lo schermo: in una tabella i pulsanti «Sospendi» sono tutti uguali
        aria-label={`${isSuspended ? 'Riattiva' : 'Sospendi'} ${user.displayName}`}
        aria-describedby={allowed ? undefined : hintId}
        onClick={() => setDialog(isSuspended ? 'reactivate' : 'suspend')}
      >
        {isSuspended ? 'Riattiva' : 'Sospendi'}
      </Button>
      {!allowed && (
        <span id={hintId} className="rs-admin-row__hint">
          {ERROR_MESSAGES.INSUFFICIENT_PLATFORM_LEVEL}
        </span>
      )}

      <SuspensionDialog
        show={dialog === 'suspend'}
        displayName={user.displayName}
        busy={suspension.isLoading}
        error={suspension.error}
        onConfirm={(body) => void handleSuspend(body)}
        onCancel={close}
      />
      <ConfirmDialog
        show={dialog === 'reactivate'}
        title={`Riattivare ${user.displayName}?`}
        body="L'utente potrà accedere di nuovo."
        confirmLabel="Riattiva"
        busy={reactivation.isLoading}
        error={reactivation.error}
        onConfirm={() => void handleReactivate()}
        onCancel={close}
      />
    </>
  )
}
