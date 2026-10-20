import { useState, type KeyboardEvent } from 'react'
import { Form } from 'react-bootstrap'
import { FieldError } from '@/components/ui/FieldError'
import { addGenre, GENRES_MAX } from '../eventForm'

type GenreInputProps = {
  id: string
  tags: string[]
  onChange: (tags: string[]) => void
  /** Errore del form (per esempio del server) per questo campo. */
  error?: string
}

/**
 * Generi come chip (progettazione, sezione 6.6): Invio aggiunge quello scritto, «×» lo toglie. Anche uscire dal campo
 * (per esempio cliccando «Pubblica») aggiunge il genere già scritto, così non si perde. Invio non invia mai il form.
 */
export function GenreInput({ id, tags, onChange, error }: GenreInputProps) {
  const [text, setText] = useState('')
  const [addError, setAddError] = useState<string>()

  function commit() {
    const result = addGenre(tags, text)
    setAddError(result.error)
    if (result.error) return
    if (result.tags !== tags) onChange(result.tags)
    setText('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    commit()
  }

  const message = addError ?? error
  return (
    <Form.Group className="mb-4">
      <Form.Label htmlFor={id}>Generi</Form.Label>
      <Form.Control
        id={id}
        type="text"
        value={text}
        isInvalid={Boolean(message)}
        aria-invalid={Boolean(message)}
        aria-describedby={`${id}-hint${message ? ` ${id}-error` : ''}`}
        onChange={(event) => {
          setText(event.target.value)
          setAddError(undefined)
        }}
        onKeyDown={handleKeyDown}
        onBlur={commit}
      />
      <p id={`${id}-hint`} className="rs-field-hint">
        Scrivi un genere e premi Invio ·{' '}
        <span>
          {tags.length} / {GENRES_MAX}
        </span>
      </p>
      <FieldError id={`${id}-error`} message={message} />
      {tags.length > 0 && (
        <ul className="rs-chips">
          {tags.map((tag) => (
            <li key={tag} className="rs-chip">
              <span>{tag}</span>
              <button
                type="button"
                className="rs-chip__remove"
                aria-label={`Togli ${tag}`}
                onClick={() => onChange(tags.filter((current) => current !== tag))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </Form.Group>
  )
}
