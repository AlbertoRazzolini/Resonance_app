import { useState } from 'react'
import { getFieldErrors } from '@/lib/errors/getErrorMessage'
import type { CreateCollabPostRequest } from '@/types/collab'

// Logica pura del modulo «Pubblica annuncio» (progettazione, sezione 6.7): valori, controlli come quelli del backend e
// corpo della richiesta. I generi e le loro regole stanno in `lib/genres.ts`, condivisi con gli eventi.

export const TITLE_MIN = 3
export const TITLE_MAX = 150
export const DESCRIPTION_MAX = 5000
export const ROLE_MAX = 100
export const LOCATION_MAX = 150
/** Messaggio di candidatura: 1800 e non 2000, perché in chat porta davanti il prefisso con il titolo (decisione 67). */
export const MESSAGE_MAX = 1800

/** Valori del modulo: i campi di testo sono sempre stringhe (il vuoto è `''`). */
export type CollabFormValues = {
  title: string
  description: string
  roleNeeded: string
  genreTags: string[]
  location: string
}

export type CollabErrors = Partial<Record<keyof CollabFormValues, string>>

export const EMPTY_COLLAB_VALUES: CollabFormValues = {
  title: '',
  description: '',
  roleNeeded: '',
  genreTags: [],
  location: '',
}

/** Un errore per ogni campo sbagliato, con le regole del backend (i campi si contano dopo il trim). */
export function validateCollab(values: CollabFormValues): CollabErrors {
  const errors: CollabErrors = {}
  const title = values.title.trim()
  if (!title) errors.title = 'Scrivi il titolo.'
  else if (title.length < TITLE_MIN) errors.title = `Il titolo deve avere almeno ${TITLE_MIN} caratteri.`
  else if (title.length > TITLE_MAX) errors.title = `Il titolo può avere al massimo ${TITLE_MAX} caratteri.`

  const description = values.description.trim()
  if (!description) errors.description = 'Scrivi la descrizione.'
  else if (description.length > DESCRIPTION_MAX) {
    errors.description = `La descrizione può avere al massimo ${DESCRIPTION_MAX} caratteri.`
  }

  const roleNeeded = values.roleNeeded.trim()
  if (!roleNeeded) errors.roleNeeded = 'Scrivi il ruolo cercato.'
  else if (roleNeeded.length > ROLE_MAX) errors.roleNeeded = `Il ruolo cercato può avere al massimo ${ROLE_MAX} caratteri.`

  if (values.location.trim().length > LOCATION_MAX) {
    errors.location = `Il luogo può avere al massimo ${LOCATION_MAX} caratteri.`
  }
  return errors
}

/** Errore del messaggio di candidatura (1–1800 caratteri dopo il trim), o `undefined` se va bene. */
export function validateApplication(message: string): string | undefined {
  const text = message.trim()
  if (!text) return 'Scrivi il messaggio.'
  if (text.length > MESSAGE_MAX) return `Il messaggio può avere al massimo ${MESSAGE_MAX} caratteri.`
  return undefined
}

/** Corpo di `POST /api/collab-posts`: testi senza spazi ai bordi, luogo vuoto omesso. */
export function buildCollabRequest(values: CollabFormValues): CreateCollabPostRequest {
  const location = values.location.trim()
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    roleNeeded: values.roleNeeded.trim(),
    genreTags: values.genreTags,
    ...(location && { location }),
  }
}

/** Stato di navigazione verso `/profilo` dopo una cancellazione dal dettaglio: serve all'avviso «Annuncio cancellato.». */
export type CollabLocationState = { collabDeleted?: true }

/** Legge lo stato di navigazione ignorando tutto ciò che non è il segno della cancellazione. */
export function wasCollabDeleted(state: unknown): boolean {
  return typeof state === 'object' && state !== null && (state as CollabLocationState).collabDeleted === true
}

/** Chiave del campo del modulo per una chiave di errore del server (`genreTags[2]` → `genreTags`), o `undefined` se non c'è. */
function fieldOf(key: string): keyof CollabFormValues | undefined {
  const field = key.replace(/\[\d+\]$/, '')
  return field in EMPTY_COLLAB_VALUES ? (field as keyof CollabFormValues) : undefined
}

/** Ultimo invio fallito: l'errore, se va mostrato in un avviso (nessun campo da evidenziare), e gli errori dei campi. */
type Failure = { error: unknown; alert: boolean; fields: CollabErrors }

/**
 * Stato del modulo: valori, controlli del client dopo il primo invio ed errori dei campi del server
 * (`VALIDATION_ERROR`), che spariscono appena si cambia quel campo. Un errore senza campi (rete, `TOO_MANY_REQUESTS`)
 * resta in `alertError` fino al prossimo invio.
 */
export function useCollabFormState() {
  const [values, setValues] = useState<CollabFormValues>(EMPTY_COLLAB_VALUES)
  const [submitted, setSubmitted] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)
  // Invii falliti per errori dei campi: li usa `useFocusFirstInvalid` per portare il cursore sul primo campo sbagliato
  const [invalidAttempts, setInvalidAttempts] = useState(0)

  const errors: CollabErrors = { ...failure?.fields, ...(submitted ? validateCollab(values) : {}) }

  /** Aggiorna dei campi e toglie gli errori del server su quei campi. */
  function change(patch: Partial<CollabFormValues>) {
    setValues((current) => ({ ...current, ...patch }))
    setFailure((current) => {
      if (!current) return current
      const fields = { ...current.fields }
      for (const key of Object.keys(patch) as (keyof CollabFormValues)[]) delete fields[key]
      return { ...current, fields }
    })
  }

  /** Da chiamare all'invio: attiva i messaggi del client e dice se si può procedere. */
  function validate(): boolean {
    setSubmitted(true)
    setFailure(null)
    const valid = Object.keys(validateCollab(values)).length === 0
    if (!valid) setInvalidAttempts((current) => current + 1)
    return valid
  }

  /** Registra l'errore di un invio fallito, separando i campi da evidenziare dall'avviso generale. */
  function fail(error: unknown) {
    const fields: CollabErrors = {}
    for (const [key, message] of Object.entries(getFieldErrors(error))) {
      const field = fieldOf(key)
      if (field) fields[field] = message
    }
    setFailure({ error, alert: Object.keys(fields).length === 0, fields })
    if (Object.keys(fields).length > 0) setInvalidAttempts((current) => current + 1)
  }

  return { values, errors, change, validate, fail, invalidAttempts, alertError: failure?.alert ? failure.error : null }
}
