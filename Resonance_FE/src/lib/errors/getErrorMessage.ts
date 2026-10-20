import type { ErrorResponse } from '@/types/common'
import { ERROR_MESSAGES, NETWORK_ERROR_MESSAGE, TIMEOUT_ERROR_MESSAGE } from './errorMessages'

/** Codici per cui `ErrorResponse.fields` indica i campi del form da evidenziare (progettazione, sezione 6.1). */
const CODES_WITH_FIELDS = ['VALIDATION_ERROR', 'ADDRESS_NOT_FOUND']

/** Stati di un proxy o di Render che si sta riavviando: la risposta non viene dal backend (non è JSON). */
const GATEWAY_STATUSES = [502, 503, 504]

/** Estrae l'`ErrorResponse` del backend da un errore di RTK Query (`{status, data}`), se c'è. */
function backendError(error: unknown): ErrorResponse | undefined {
  if (
    typeof error !== 'object' ||
    error === null ||
    typeof (error as { status?: unknown }).status !== 'number'
  ) {
    return undefined
  }
  const data = (error as { data?: unknown }).data
  return typeof data === 'object' &&
    data !== null &&
    typeof (data as { code?: unknown }).code === 'string'
    ? (data as ErrorResponse)
    : undefined
}

/**
 * Messaggio italiano per l'utente da un errore qualunque (RTK Query o eccezione). Decide sul `code`
 * (progettazione, sezione 6.1); con un codice nuovo ripiega sul `message` del backend; un errore tecnico
 * non mostra mai il proprio testo.
 */
export function getErrorMessage(error: unknown): string {
  const response = backendError(error)
  if (response) {
    return ERROR_MESSAGES[response.code] ?? (response.message || ERROR_MESSAGES.INTERNAL_ERROR)
  }
  const status =
    typeof error === 'object' && error !== null ? (error as { status?: unknown }).status : undefined
  if (status === 'FETCH_ERROR') return NETWORK_ERROR_MESSAGE
  if (status === 'TIMEOUT_ERROR') return TIMEOUT_ERROR_MESSAGE
  if (status === 'PARSING_ERROR') {
    const original = (error as { originalStatus?: number }).originalStatus
    return original !== undefined && GATEWAY_STATUSES.includes(original)
      ? NETWORK_ERROR_MESSAGE
      : ERROR_MESSAGES.INTERNAL_ERROR
  }
  if (typeof status === 'number' && GATEWAY_STATUSES.includes(status)) return NETWORK_ERROR_MESSAGE
  return ERROR_MESSAGES.INTERNAL_ERROR
}

/** Codice dell'`ErrorResponse` del backend in un errore di RTK Query, se c'è: serve a decidere cosa mostrare (sezione 6.1). */
export function getErrorCode(error: unknown): string | undefined {
  return backendError(error)?.code
}

/** Errori dei singoli campi (`nome campo → messaggio`), solo per `VALIDATION_ERROR` e `ADDRESS_NOT_FOUND`. */
export function getFieldErrors(error: unknown): Record<string, string> {
  const response = backendError(error)
  return response && CODES_WITH_FIELDS.includes(response.code) ? { ...response.fields } : {}
}
