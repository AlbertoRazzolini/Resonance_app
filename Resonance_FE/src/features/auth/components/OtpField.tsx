import { useId, useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { FieldError } from '@/components/ui/FieldError'

const DIGITS = 6

type OtpFieldProps = {
  /** Le cifre scritte finora, es. "48" (al massimo 6). */
  value: string
  onChange: (value: string) => void
  error?: string
  label?: string
  disabled?: boolean
}

/**
 * Codice di verifica a 6 cifre in 6 caselle (riuso adattato di `CampoCodiceOtp` di NoseY). Solo cifre: il cursore
 * avanza da solo, Backspace torna indietro e si può incollare il codice intero. Sul telefono compare il tastierino
 * numerico e `one-time-code` lascia proporre il codice arrivato.
 */
export function OtpField({
  value,
  onChange,
  error,
  label = 'Codice',
  disabled = false,
}: OtpFieldProps) {
  const boxes = useRef<(HTMLInputElement | null)[]>([])
  const labelId = useId()
  const errorId = useId()
  const digits = Array.from({ length: DIGITS }, (_, i) => value[i] ?? '')

  const focusBox = (index: number) =>
    boxes.current[Math.max(0, Math.min(DIGITS - 1, index))]?.focus()

  /** Scrive le cifre di `text` dalla casella `index` in poi (più cifre insieme: incolla o suggerimento del telefono). */
  function write(index: number, text: string) {
    const typed = text.replace(/\D/g, '')
    if (!typed) return
    const next = (value.slice(0, index) + typed).slice(0, DIGITS)
    onChange(next)
    focusBox(next.length)
  }

  function handleKey(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace') {
      event.preventDefault()
      // Cancella la cifra di questa casella, oppure (se vuota) quella prima, e ci va sopra
      const from = digits[index] ? index : index - 1
      if (from < 0) return
      onChange(value.slice(0, from))
      focusBox(from)
    } else if (event.key === 'ArrowLeft') {
      focusBox(index - 1)
    } else if (event.key === 'ArrowRight') {
      focusBox(index + 1)
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault()
    write(0, event.clipboardData.getData('text'))
  }

  return (
    <div className="mb-4">
      <span id={labelId} className="form-label rs-required d-block">
        {label}
      </span>
      <div role="group" aria-labelledby={labelId} className="rs-otp">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              boxes.current[index] = element
            }}
            className="rs-otp__box"
            value={digit}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={DIGITS}
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            disabled={disabled}
            aria-label={`Cifra ${index + 1} di ${DIGITS}`}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => write(index, event.target.value.slice(-DIGITS))}
            onKeyDown={(event) => handleKey(index, event)}
            onPaste={handlePaste}
            onFocus={(event) => event.target.select()}
          />
        ))}
      </div>
      <FieldError id={errorId} message={error} />
    </div>
  )
}
