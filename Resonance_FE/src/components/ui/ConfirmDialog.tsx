import { useId, useState, type ReactNode } from 'react'
import { Button, Form, Modal } from 'react-bootstrap'

/** Lunghezza massima del motivo: quella del backend per la cancellazione del proprietario (progettazione, sezione 5.7). */
const REASON_MAX = 500

type ConfirmDialogProps = {
  show: boolean
  title: string
  body: ReactNode
  confirmLabel: string
  /** Con `withReason` riceve il motivo senza spazi ai bordi, o `undefined` se vuoto. */
  onConfirm: (reason?: string) => void
  onCancel: () => void
  /** Aggiunge il campo «Motivo (facoltativo)». */
  withReason?: boolean
  /** Un'azione è in corso: i pulsanti sono spenti per non confermare due volte. */
  busy?: boolean
}

type DialogContentProps = Omit<ConfirmDialogProps, 'show'> & { titleId: string }

/** Contenuto della finestra: il motivo scritto vive qui, così a ogni apertura riparte vuoto (la finestra chiusa non è montata). */
function DialogContent({ title, body, confirmLabel, onConfirm, onCancel, withReason, busy, titleId }: DialogContentProps) {
  const [reason, setReason] = useState('')
  const reasonId = useId()

  return (
    <>
      <Modal.Header closeButton={!busy}>
        <Modal.Title id={titleId}>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>{body}</p>
        {withReason && (
          <Form.Group>
            <Form.Label htmlFor={reasonId}>Motivo (facoltativo)</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              id={reasonId}
              maxLength={REASON_MAX}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <p className="rs-field-hint">
              {reason.length} / {REASON_MAX}
            </p>
          </Form.Group>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-light" disabled={busy} onClick={onCancel}>
          Annulla
        </Button>
        <Button variant="danger" disabled={busy} onClick={() => onConfirm(reason.trim() || undefined)}>
          {confirmLabel}
        </Button>
      </Modal.Footer>
    </>
  )
}

/**
 * Finestra di conferma per le azioni che non si annullano (cancellare un evento, un post, un annuncio). Con `withReason`
 * chiede un motivo facoltativo. Non si chiude con Esc o fuori dalla finestra mentre `busy`.
 */
export function ConfirmDialog({ show, onCancel, busy, ...content }: ConfirmDialogProps) {
  const titleId = useId()
  return (
    <Modal show={show} onHide={busy ? undefined : onCancel} centered aria-labelledby={titleId}>
      <DialogContent {...content} onCancel={onCancel} busy={busy} titleId={titleId} />
    </Modal>
  )
}
