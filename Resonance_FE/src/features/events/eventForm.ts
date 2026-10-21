import { useState } from 'react'
import { getFieldErrors } from '@/lib/errors/getErrorMessage'
import { parseHttpUrl } from '@/lib/urls'
import type { CreateConcertRequest, CreateIndieEventRequest, IndieEventStatus } from '@/types/events'

// Logica pura dei form di pubblicazione (progettazione, sezione 6.6): valori, controlli come quelli del backend,
// data con offset e corpi delle richieste.

export const TITLE_MIN = 3
export const TITLE_MAX = 150
export const DESCRIPTION_MAX = 5000
export const VENUE_MAX = 150
export const ADDRESS_MAX = 255
export const URL_MAX = 2048

/** Valori dei form: i campi di testo sono sempre stringhe (il vuoto è `''`), `eventDate` quella del campo `datetime-local`. */
export type EventFormValues = {
  title: string
  description: string
  venueName: string
  address: string
  /** Ora locale senza fuso, es. `2026-10-21T21:00`: la converte `eventDateToIso`. */
  eventDate: string
  genreTags: string[]
  coverImageUrl: string
  /** Solo concerti. */
  externalTicketUrl: string
  /** Solo indie event. */
  isFree: boolean
}

export type EventErrors = Partial<Record<keyof EventFormValues, string>>

/** Tipo di evento per i controlli: il biglietto esiste solo nei concerti. */
export type EventFormKind = 'concert' | 'indie'

export const EMPTY_EVENT_VALUES: EventFormValues = {
  title: '',
  description: '',
  venueName: '',
  address: '',
  eventDate: '',
  genreTags: [],
  coverImageUrl: '',
  externalTicketUrl: '',
  isFree: false,
}

/**
 * Istante ISO-8601 in UTC (suffisso `Z`) da un'ora locale del campo `datetime-local`. Il backend non accetta una data
 * senza fuso (`400` sul campo `eventDate`): si converte sempre (Review Focus 5).
 */
export function eventDateToIso(local: string): string {
  return new Date(local).toISOString()
}

/** Errore di un indirizzo facoltativo (copertina, biglietto): vuoto va bene, altrimenti solo `http`/`https`. */
function optionalUrlError(value: string): string | undefined {
  const url = value.trim()
  if (!url) return undefined
  if (url.length > URL_MAX) return `L'indirizzo può avere al massimo ${URL_MAX} caratteri.`
  return parseHttpUrl(url) ? undefined : 'Scrivi un indirizzo che inizia con http:// o https://.'
}

/**
 * Un errore per ogni campo sbagliato, con le regole del backend (i campi si contano dopo il trim). La data deve essere
 * dopo `now`: il backend la controlla di nuovo con il suo orologio.
 */
export function validateEvent(values: EventFormValues, kind: EventFormKind, now: Date = new Date()): EventErrors {
  const errors: EventErrors = {}
  const title = values.title.trim()
  if (!title) errors.title = 'Scrivi il titolo.'
  else if (title.length < TITLE_MIN) errors.title = `Il titolo deve avere almeno ${TITLE_MIN} caratteri.`
  else if (title.length > TITLE_MAX) errors.title = `Il titolo può avere al massimo ${TITLE_MAX} caratteri.`

  if (values.description.trim().length > DESCRIPTION_MAX) {
    errors.description = `La descrizione può avere al massimo ${DESCRIPTION_MAX} caratteri.`
  }

  const venueName = values.venueName.trim()
  if (!venueName) errors.venueName = 'Scrivi il nome del locale.'
  else if (venueName.length > VENUE_MAX) errors.venueName = `Il nome del locale può avere al massimo ${VENUE_MAX} caratteri.`

  const address = values.address.trim()
  if (!address) errors.address = "Scrivi l'indirizzo."
  else if (address.length > ADDRESS_MAX) errors.address = `L'indirizzo può avere al massimo ${ADDRESS_MAX} caratteri.`

  if (!values.eventDate) errors.eventDate = "Scegli la data e l'ora."
  else if (!(new Date(values.eventDate).getTime() > now.getTime())) errors.eventDate = 'Scegli una data futura.'

  const coverImageUrl = optionalUrlError(values.coverImageUrl)
  if (coverImageUrl) errors.coverImageUrl = coverImageUrl
  if (kind === 'concert') {
    const externalTicketUrl = optionalUrlError(values.externalTicketUrl)
    if (externalTicketUrl) errors.externalTicketUrl = externalTicketUrl
  }
  return errors
}

/** Campi comuni dei due corpi: testi senza spazi ai bordi, facoltativi vuoti omessi, data con offset. */
function commonFields(values: EventFormValues) {
  const description = values.description.trim()
  const coverImageUrl = values.coverImageUrl.trim()
  return {
    title: values.title.trim(),
    ...(description && { description }),
    venueName: values.venueName.trim(),
    address: values.address.trim(),
    eventDate: eventDateToIso(values.eventDate),
    genreTags: values.genreTags,
    ...(coverImageUrl && { coverImageUrl }),
  }
}

/** Corpo di `POST /api/official-concerts`. */
export function buildConcertRequest(values: EventFormValues): CreateConcertRequest {
  const externalTicketUrl = values.externalTicketUrl.trim()
  return { ...commonFields(values), ...(externalTicketUrl && { externalTicketUrl }) }
}

/** Corpo di `POST /api/indie-events`: «Pubblica» manda `PUBLISHED`, «Salva come bozza» `DRAFT`. */
export function buildIndieEventRequest(values: EventFormValues, status: IndieEventStatus): CreateIndieEventRequest {
  return { ...commonFields(values), isFree: values.isFree, status }
}

/** Stato di navigazione verso `/profilo` dopo una cancellazione dal dettaglio: serve all'avviso «Evento cancellato.». */
export type EventLocationState = { eventDeleted?: true }

/** Legge lo stato di navigazione ignorando tutto ciò che non è il segno della cancellazione. */
export function wasEventDeleted(state: unknown): boolean {
  return typeof state === 'object' && state !== null && (state as EventLocationState).eventDeleted === true
}

/** Chiave del campo del form per una chiave di errore del server (`genreTags[2]` → `genreTags`), o `undefined` se non c'è. */
function fieldOf(key: string): keyof EventFormValues | undefined {
  const field = key.replace(/\[\d+\]$/, '')
  return field in EMPTY_EVENT_VALUES ? (field as keyof EventFormValues) : undefined
}

/** Ultimo invio fallito: l'errore, se va mostrato in un avviso (nessun campo da evidenziare), e gli errori dei campi. */
type Failure = { error: unknown; alert: boolean; fields: EventErrors }

/**
 * Stato dei form di pubblicazione: valori, controlli del client dopo il primo invio ed errori dei campi del server
 * (`VALIDATION_ERROR`, `ADDRESS_NOT_FOUND`), che spariscono appena si cambia quel campo. Un errore senza campi (rete,
 * `GEOCODING_UNAVAILABLE`, `TOO_MANY_REQUESTS`) resta in `alertError` fino al prossimo invio.
 */
export function useEventFormState(kind: EventFormKind) {
  const [values, setValues] = useState<EventFormValues>(EMPTY_EVENT_VALUES)
  const [submitted, setSubmitted] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)
  // Invii falliti per errori dei campi: li usa `useFocusFirstInvalid` per portare il cursore sul primo campo sbagliato
  const [invalidAttempts, setInvalidAttempts] = useState(0)

  const errors: EventErrors = { ...failure?.fields, ...(submitted ? validateEvent(values, kind) : {}) }

  /** Aggiorna dei campi e toglie gli errori del server su quei campi. */
  function change(patch: Partial<EventFormValues>) {
    setValues((current) => ({ ...current, ...patch }))
    setFailure((current) => {
      if (!current) return current
      const fields = { ...current.fields }
      for (const key of Object.keys(patch) as (keyof EventFormValues)[]) delete fields[key]
      return { ...current, fields }
    })
  }

  /** Da chiamare all'invio: attiva i messaggi del client e dice se si può procedere. */
  function validate(): boolean {
    setSubmitted(true)
    setFailure(null)
    const valid = Object.keys(validateEvent(values, kind)).length === 0
    if (!valid) setInvalidAttempts((current) => current + 1)
    return valid
  }

  /** Registra l'errore di un invio fallito, separando i campi da evidenziare dall'avviso generale. */
  function fail(error: unknown) {
    const fields: EventErrors = {}
    for (const [key, message] of Object.entries(getFieldErrors(error))) {
      const field = fieldOf(key)
      if (field) fields[field] = message
    }
    setFailure({ error, alert: Object.keys(fields).length === 0, fields })
    if (Object.keys(fields).length > 0) setInvalidAttempts((current) => current + 1)
  }

  return { values, errors, change, validate, fail, invalidAttempts, alertError: failure?.alert ? failure.error : null }
}
