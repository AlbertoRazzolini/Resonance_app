import { useState } from 'react'
import { Button } from 'react-bootstrap'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { selectCurrentUser, selectHasRole } from '@/features/auth/authSlice'
import { useAppDispatch, useAppSelector } from '@/hooks/redux'
import { confirmationShown } from '@/lib/notices/confirmationSlice'
import type { ModeratedType } from '@/types/admin'
import { useHideContentMutation } from '../api/adminApi'

/** Lunghezza minima del motivo di «Nascondi» (progettazione, sezione 5.7: da 3 a 500 caratteri). */
const REASON_MIN = 3

type HideContentButtonProps = {
  type: ModeratedType
  id: string
  /** L'autore del contenuto: sui propri contenuti il pulsante non c'è (la regola dei livelli vieta di agire su se stessi). */
  authorId: string
  /** Titolo o autore, per il nome accessibile del pulsante: nelle liste i «Nascondi» sono tutti uguali. */
  name: string
  /** Chiamato a nascondimento riuscito: il dettaglio lo usa per tornare all'elenco. */
  onHidden?: () => void
}

/**
 * «Nascondi» di un contenuto (progettazione, sezione 5.7), per ADMIN e SUPERADMIN, sulle card degli elenchi e nei dettagli.
 * Chiede un motivo obbligatorio (3–500) in una finestra di conferma; l'interfaccia non conosce i ruoli dell'autore, quindi se
 * è un altro admin il 403 `INSUFFICIENT_PLATFORM_LEVEL` compare nella finestra. Solo interfaccia: il controllo vero è nel
 * backend. A esito riuscito gli elenchi pubblici si rileggono (`contentTags`) e compare «Contenuto nascosto.».
 */
export function HideContentButton({ type, id, authorId, name, onHidden }: HideContentButtonProps) {
  const dispatch = useAppDispatch()
  const me = useAppSelector(selectCurrentUser)
  const isAdmin = useAppSelector(selectHasRole('ADMIN'))
  const [hide, hiding] = useHideContentMutation()
  const [confirming, setConfirming] = useState(false)

  if (!isAdmin || me?.id === authorId) return null

  function close() {
    setConfirming(false)
    hiding.reset()
  }

  async function handleConfirm(reason?: string) {
    try {
      await hide({ type, id, reason: reason ?? '' }).unwrap()
      dispatch(confirmationShown('Contenuto nascosto.'))
      close()
      onHidden?.()
    } catch {
      // L'errore resta nello stato della mutazione e la finestra lo mostra
    }
  }

  return (
    <>
      <Button variant="outline-light" size="sm" aria-label={`Nascondi ${name}`} onClick={() => setConfirming(true)}>
        Nascondi
      </Button>
      <ConfirmDialog
        show={confirming}
        title="Nascondere il contenuto?"
        body="Non sarà più visibile agli utenti. Potrai ripristinarlo da Contenuti nascosti."
        confirmLabel="Nascondi"
        withReason
        reasonMin={REASON_MIN}
        busy={hiding.isLoading}
        error={hiding.error}
        onConfirm={(reason) => void handleConfirm(reason)}
        onCancel={close}
      />
    </>
  )
}
