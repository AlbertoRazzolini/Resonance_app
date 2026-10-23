import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Alert, Button } from 'react-bootstrap'
import type { StompStatus } from '@/lib/stomp/client'
import { insertAtSelection } from '../emojiInsert'
import { SmileIcon } from './ChatIcons'
import { EmojiPicker } from './EmojiPicker'

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
 * Il pulsante con la faccina apre il selettore di emoji sopra la casella: l'emoji entra nel punto del cursore (o al posto
 * della selezione) se il messaggio resta entro il limite, poi il selettore si chiude e il cursore torna nella casella;
 * si chiude anche con Esc e con un clic fuori.
 */
export function MessageComposer({ name, value, onChange, onSubmit, status, canSend, error }: MessageComposerProps) {
  const field = useRef<HTMLTextAreaElement>(null)
  const emojiBox = useRef<HTMLDivElement>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  // Posizione del cursore da ripristinare dopo che React ha scritto il nuovo testo nella casella
  const pendingCaret = useRef<number | null>(null)
  const trimmed = value.trim()
  const canSubmit = canSend && status === 'connected' && trimmed.length > 0 && value.length <= MESSAGE_MAX

  // La casella cresce con il testo, fino al massimo
  useEffect(() => {
    const element = field.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT_PX)}px`
  }, [value])

  // Dopo un inserimento il cursore va subito dopo l'emoji
  useEffect(() => {
    const element = field.current
    if (pendingCaret.current === null || !element) return
    element.setSelectionRange(pendingCaret.current, pendingCaret.current)
    pendingCaret.current = null
  }, [value])

  // Selettore aperto: Esc e clic fuori lo chiudono (il clic sul pulsante lo gestisce il pulsante stesso)
  useEffect(() => {
    if (!pickerOpen) return
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return
      setPickerOpen(false)
      field.current?.focus()
    }
    function onPointerDown(event: PointerEvent) {
      if (!emojiBox.current?.contains(event.target as Node)) setPickerOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [pickerOpen])

  /** Mette l'emoji nel punto del cursore, chiude il selettore e rimette il cursore nella casella. */
  function insertEmoji(unicode: string) {
    const element = field.current
    setPickerOpen(false)
    if (!element) return
    const inserted = insertAtSelection(value, element.selectionStart, element.selectionEnd, unicode, MESSAGE_MAX)
    if (inserted) {
      pendingCaret.current = inserted.caret
      onChange(inserted.value)
    }
    element.focus()
  }

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
        <div ref={emojiBox} className="rs-composer__emoji">
          <Button
            type="button"
            variant="outline-secondary"
            className="rs-composer__emoji-button"
            disabled={!canSend}
            aria-label="Inserisci emoji"
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen((open) => !open)}
          >
            <SmileIcon />
          </Button>
          {pickerOpen && <EmojiPicker onPick={insertEmoji} />}
        </div>
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
