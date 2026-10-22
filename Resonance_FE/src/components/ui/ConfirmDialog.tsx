import { useId, useState, type ReactNode } from 'react'
import { Button, Form, Modal } from 'react-bootstrap'
import { ErrorAlert } from './ErrorAlert'

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
  /**
   * Rende il motivo obbligatorio (con `withReason`): il campo si chiama «Motivo» e la conferma resta spenta finché il
   * motivo, senza spazi ai bordi, non ha almeno questi caratteri (es. «Nascondi» dell'area admin: da 3 a 500).
   */
  reasonMin?: number
  /** Un'azione è in corso: i pulsanti sono spenti per non confermare due volte. */
  busy?: boolean
  /** Errore del backend dell'azione tentata: resta nella finestra, che non si chiude. */
  error?: unknown
}

type DialogContentProps = Omit<ConfirmDialogProps, 'show'> & { titleId: string }

/** Contenuto della finestra: il motivo scritto vive qui, così a ogni apertura riparte vuoto (la finestra chiusa non è montata). */
function DialogContent({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  withReason,
  reasonMin,
  busy,
  error,
  titleId,
}: DialogContentProps) {
  const [reason, setReason] = useState('')
  const reasonId = useId()
  const reasonTooShort = reasonMin !== undefined && reason.trim().length < reasonMin

  return (
    <>
      <Modal.Header closeButton={!busy}>
        <Modal.Title id={titleId}>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>{body}</p>
        {withReason && (
          <Form.Group>
            <Form.Label htmlFor={reasonId}>{reasonMin === undefined ? 'Motivo (facoltativo)' : 'Motivo'}</Form.Label>
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
        <ErrorAlert error={error} />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-light" disabled={busy} onClick={onCancel}>
          Annulla
        </Button>
        <Button variant="danger" disabled={busy || reasonTooShort} onClick={() => onConfirm(reason.trim() || undefined)}>
          {confirmLabel}
        </Button>
      </Modal.Footer>
    </>
  )
}

/**
 * Finestra di conferma per le azioni che non si annullano (cancellare un evento, un post, un annuncio). Con `withReason`
 * chiede un motivo facoltativo, obbligatorio con `reasonMin`; con `error` mostra il rifiuto del backend. Non si chiude con
 * Esc o fuori dalla finestra mentre `busy`.
 */
export function ConfirmDialog({ show, onCancel, busy, ...content }: ConfirmDialogProps) {
  const titleId = useId()
  return (
    <Modal show={show} onHide={busy ? undefined : onCancel} centered aria-labelledby={titleId}>
      <DialogContent {...content} onCancel={onCancel} busy={busy} titleId={titleId} />
    </Modal>
  )
}
