import { useEffect, useRef, type FormEvent, type KeyboardEvent } from 'react'
import { Alert, Button } from 'react-bootstrap'
import type { StompStatus } from '@/lib/stomp/client'

/** Lunghezza massima di un messaggio (progettazione, sezione 7.5: 1–2000). */
export const MESSAGE_MAX = 2000

/** Altezza massima della casella: oltre scorre. */
const MAX_HEIGHT_PX = 160

/** Testi dello stato della connessione; `idle` (prima del primo tentativo) si legge come «Connessione…». */
const STATUS_TEXT: Record<StompStatus, string> = {
  idle: 'Connessione…',
  connecting: 'Connessione…',
  connected: 'Connesso',
  reconnecting: 'Riconnessione…',
}

type MessageComposerProps = {
  /** Nome dell'altra persona, per l'etichetta e il segnaposto. */
  name: string
  value: string
  onChange: (value: string) => void
  /** Chiamata con Invio o col pulsante, solo se il testo è valido e si è connessi. */
  onSubmit: () => void
  status: StompStatus
  /** Se falso la casella è spenta e una nota spiega perché (decisione 66: testo neutro). */
  canSend: boolean
  /** Errore dell'ultimo invio, sopra la casella. */
  error: string | null
}

/**
 * Casella di scrittura (progettazione, sezione 7.5): stato della connessione e contatore «n / 2000» sopra, casella e
 * «Invia» sotto. Invio manda, Maiusc+Invio va a capo; «Invia» resta spento senza testo o senza connessione. La casella
 * cresce col testo fino a 160 px. Con `canSend` falso è spenta e una nota neutra spiega che si può solo rileggere.
 */
export function MessageComposer({ name, value, onChange, onSubmit, status, canSend, error }: MessageComposerProps) {
  const field = useRef<HTMLTextAreaElement>(null)
  const trimmed = value.trim()
  const canSubmit = canSend && status === 'connected' && trimmed.length > 0 && value.length <= MESSAGE_MAX

  // La casella cresce con il testo, fino al massimo
  useEffect(() => {
    const element = field.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT_PX)}px`
  }, [value])

  function submit(event?: FormEvent) {
    event?.preventDefault()
    if (canSubmit) onSubmit()
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    submit()
  }

  return (
    <form className="rs-composer" onSubmit={submit}>
      {error && (
        <Alert variant="danger" role="alert" className="rs-composer__error">
          {error}
        </Alert>
      )}
      <div className="rs-composer__meta">
        <span role="status" className={`rs-composer__status rs-composer__status--${status}`}>
          {STATUS_TEXT[status]}
        </span>
        <span className="rs-composer__count">
          {value.length} / {MESSAGE_MAX}
        </span>
      </div>
      <div className="rs-composer__row">
        <textarea
          ref={field}
          rows={1}
          className="form-control"
          value={value}
          maxLength={MESSAGE_MAX}
          disabled={!canSend}
          aria-label={`Messaggio per ${name}`}
          placeholder={`Scrivi a ${name}…`}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <Button type="submit" variant="primary" disabled={!canSubmit}>
          Invia
        </Button>
      </div>
      {!canSend && (
        <p className="rs-composer__note">
          Al momento non puoi inviare messaggi a questa persona. Puoi rileggere la conversazione.
        </p>
      )}
    </form>
  )
}
