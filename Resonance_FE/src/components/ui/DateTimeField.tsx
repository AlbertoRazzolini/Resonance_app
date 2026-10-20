import { Form } from 'react-bootstrap'
import { FieldError } from './FieldError'

type DateTimeFieldProps = {
  id: string
  label: string
  /** Ora locale senza fuso, nel formato del campo (`2026-10-21T21:00`), o `''`. */
  value: string
  onChange: (value: string) => void
  error?: string
  required?: boolean
  /** Prima di questo istante il selettore del browser non lascia scegliere. */
  min?: Date
}

/** `Date` nel formato del campo `datetime-local`, in ora locale. */
function toDateTimeLocal(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Data e ora con il selettore del browser (progettazione, sezione 6.6). Il valore è l'ora locale senza fuso: chi invia
 * lo converte in un istante con offset (`eventDateToIso`). L'errore sta sotto il campo.
 */
export function DateTimeField({ id, label, value, onChange, error, required, min }: DateTimeFieldProps) {
  return (
    <Form.Group className="mb-4">
      <Form.Label htmlFor={id} className={required ? 'rs-required' : undefined}>
        {label}
      </Form.Label>
      <Form.Control
        id={id}
        type="datetime-local"
        value={value}
        min={min ? toDateTimeLocal(min) : undefined}
        isInvalid={Boolean(error)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldError id={`${id}-error`} message={error} />
    </Form.Group>
  )
}
