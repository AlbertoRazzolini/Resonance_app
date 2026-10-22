import { useId, useState } from 'react'
import { Button, Form, Modal } from 'react-bootstrap'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import type { SuspendUserRequest } from '@/types/admin'
import {
  buildSuspendRequest,
  isSuspensionValid,
  REASON_MAX,
  SUSPENSION_DAYS,
  type SuspensionDuration,
} from '../suspensionForm'

type SuspensionDialogProps = {
  show: boolean
  displayName: string
  /** Una richiesta è in corso: i pulsanti sono spenti per non confermare due volte. */
  busy?: boolean
  /** Errore del backend (es. `INSUFFICIENT_PLATFORM_LEVEL`): resta dentro la finestra, che non si chiude. */
  error?: unknown
  onConfirm: (request: SuspendUserRequest) => void
  onCancel: () => void
}

/** Etichetta di ogni durata fissa («1 giorno», «3 giorni»…). */
const daysLabel = (days: number) => (days === 1 ? '1 giorno' : `${days} giorni`)

/** Contenuto della finestra: motivo e durata vivono qui, così a ogni apertura ripartono vuoti (la finestra chiusa non è montata). */
function DialogContent({ displayName, busy, error, onConfirm, onCancel, titleId }: Omit<SuspensionDialogProps, 'show'> & { titleId: string }) {
  const [reason, setReason] = useState('')
  const [duration, setDuration] = useState<SuspensionDuration>(null)
  const [touched, setTouched] = useState(false)
  const reasonId = useId()
  const values = { reason, duration }
  const reasonMissing = touched && reason.trim() === ''

  return (
    <>
      <Modal.Header closeButton={!busy}>
        <Modal.Title id={titleId}>Sospendere {displayName}?</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>L'utente verrà disconnesso subito.</p>

        <Form.Group className="mb-3">
          <Form.Label htmlFor={reasonId}>Motivo</Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            id={reasonId}
            maxLength={REASON_MAX}
            value={reason}
            isInvalid={reasonMissing}
            aria-describedby={`${reasonId}-hint`}
            onChange={(event) => setReason(event.target.value)}
            onBlur={() => setTouched(true)}
          />
          <p id={`${reasonId}-hint`} className="rs-field-hint">
            {reason.length} / {REASON_MAX}
          </p>
          {reasonMissing && <Form.Text className="text-danger">Scrivi il motivo (massimo {REASON_MAX} caratteri).</Form.Text>}
        </Form.Group>

        {/* Una sola durata alla volta: scegliendone un'altra la precedente è sostituita, mai giorni e indeterminata insieme */}
        <fieldset className="rs-duration">
          <legend>Durata</legend>
          {SUSPENSION_DAYS.map((days) => (
            <Form.Check
              key={days}
              type="radio"
              name="duration"
              id={`${reasonId}-${days}`}
              label={daysLabel(days)}
              checked={duration === days}
              disabled={busy}
              onChange={() => setDuration(days)}
            />
          ))}
          <Form.Check
            type="radio"
            name="duration"
            id={`${reasonId}-indefinite`}
            label="Indeterminata"
            checked={duration === 'indefinite'}
            disabled={busy}
            onChange={() => setDuration('indefinite')}
          />
        </fieldset>

        <ErrorAlert error={error} />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-light" disabled={busy} onClick={onCancel}>
          Annulla
        </Button>
        <Button
          variant="danger"
          disabled={busy || !isSuspensionValid(values)}
          onClick={() => onConfirm(buildSuspendRequest(values))}
        >
          Sospendi
        </Button>
      </Modal.Footer>
    </>
  )
}

/**
 * Finestra di sospensione di un utente (progettazione, sezione 5.5): motivo obbligatorio (1–500) e una durata scelta fra
 * 1, 3, 7, 30 e 90 giorni oppure indeterminata. «Sospendi» resta spento finché non c'è tutto; un errore del backend resta
 * dentro la finestra. Non si chiude con Esc o fuori dalla finestra mentre `busy`.
 */
export function SuspensionDialog({ show, onCancel, busy, ...content }: SuspensionDialogProps) {
  const titleId = useId()
  return (
    <Modal show={show} onHide={busy ? undefined : onCancel} centered aria-labelledby={titleId}>
      <DialogContent {...content} onCancel={onCancel} busy={busy} titleId={titleId} />
    </Modal>
  )
}
