import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

type DialogProps = {
  show: boolean
  busy: boolean
  onCancel: () => void
}

/**
 * Conferma di chiusura (decisione 60: non c'è riapertura). Il testo avvisa dell'effetto sulla chat, perché lo sblocco
 * fra autore e candidato dura finché l'annuncio è aperto (progettazione, sezione 6.9). Uguale nel dettaglio e nella
 * scheda «Annunci».
 */
export function CloseCollabDialog({ show, busy, onCancel, onConfirm }: DialogProps & { onConfirm: () => void }) {
  return (
    <ConfirmDialog
      show={show}
      title="Chiudere l'annuncio?"
      body="Dopo la chiusura nessuno potrà più candidarsi. Chi non è tuo amico non potrà più scriverti in chat: se vuoi continuare una conversazione, prima aggiungilo agli amici."
      confirmLabel="Chiudi annuncio"
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}

/** Conferma di cancellazione con il motivo facoltativo (progettazione, sezione 5.7). Uguale nel dettaglio e nella scheda «Annunci». */
export function DeleteCollabDialog({ show, busy, onCancel, onConfirm }: DialogProps & { onConfirm: (reason?: string) => void }) {
  return (
    <ConfirmDialog
      show={show}
      title="Cancellare l'annuncio?"
      body="L'annuncio non sarà più visibile a nessuno. L'operazione non potrà essere annullata, vuoi continuare?"
      confirmLabel="Cancella annuncio"
      withReason
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
