import { describe, expect, it } from 'vitest'
import { errorResponse } from '@/test/handlers/auth'
import { ERROR_MESSAGES } from './errorMessages'
import { getErrorMessage, getFieldErrors } from './getErrorMessage'

// Messaggi italiani decisi sul codice dell'errore (mai sul testo del backend, progettazione sezione 6.1) e
// errori dei campi solo per VALIDATION_ERROR e ADDRESS_NOT_FOUND.
const rtkError = (status: number, code: string, extra: Record<string, unknown> = {}) => ({
  status,
  data: { ...errorResponse(status, code), ...extra },
})

// Codici HTTP della tabella di progettazione, sezione 6.2 (TOKEN_INVALID solo WebSocket)
const DESIGN_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'ACCESS_DENIED',
  'NOT_FOUND',
  'METHOD_NOT_ALLOWED',
  'UNSUPPORTED_MEDIA_TYPE',
  'CONFLICT',
  'TOO_MANY_REQUESTS',
  'INTERNAL_ERROR',
  'EMAIL_ALREADY_REGISTERED',
  'DISPLAY_NAME_TAKEN',
  'ALREADY_VERIFIED',
  'CODE_INVALID',
  'CODE_EXPIRED',
  'WRONG_PASSWORD',
  'INVALID_CREDENTIALS',
  'EMAIL_NOT_VERIFIED',
  'ACCOUNT_SUSPENDED',
  'CSRF_HEADER_MISSING',
  'REFRESH_TOKEN_INVALID',
  'REFRESH_TOKEN_EXPIRED',
  'REFRESH_TOKEN_REUSED',
  'REFRESH_CONFLICT',
  'INSUFFICIENT_PLATFORM_LEVEL',
  'LAST_SUPERADMIN',
  'USER_NOT_VERIFIED',
  'USER_NOT_ACTIVE',
  'NOT_OWNER',
  'CONTENT_ALREADY_HIDDEN',
  'CONTENT_NOT_HIDDEN',
  'RESTORE_NOT_ALLOWED',
  'ADDRESS_NOT_FOUND',
  'GEOCODING_UNAVAILABLE',
  'EVENT_ALREADY_PUBLISHED',
  'EVENT_DATE_PAST',
  'COLLAB_CLOSED',
  'COLLAB_ALREADY_APPLIED',
  'CANNOT_APPLY_OWN_POST',
  'CANNOT_MESSAGE_SELF',
  'NOT_CONVERSATION_MEMBER',
  'NOT_FRIENDS',
  'CHAT_LOCKED',
  'CANNOT_FRIEND_SELF',
  'FRIEND_REQUEST_ALREADY_SENT',
  'FRIEND_REQUEST_ALREADY_RECEIVED',
  'ALREADY_FRIENDS',
  'FRIENDSHIP_UNAVAILABLE',
  'FRIEND_REQUEST_NOT_PENDING',
  'NOT_FRIENDSHIP_ADDRESSEE',
  'NOT_FRIENDSHIP_REQUESTER',
  'EVENT_CLOSED',
  'CANNOT_CONTACT_OWN_EVENT',
  'TOKEN_INVALID',
]

describe('getErrorMessage', () => {
  it('ha un testo per ogni codice della tabella di progettazione 6.2', () => {
    const missing = DESIGN_CODES.filter((code) => !ERROR_MESSAGES[code])
    expect(missing).toEqual([])
  })

  it('traduce il codice in un testo italiano', () => {
    expect(getErrorMessage(rtkError(401, 'INVALID_CREDENTIALS'))).toBe(
      'Email o password non corrette.',
    )
  })

  it('WRONG_PASSWORD è generico (non dice quale campo è sbagliato) e indica cosa fare se la password è dimenticata', () => {
    const message = getErrorMessage(rtkError(400, 'WRONG_PASSWORD'))
    expect(message).toMatch(/controlla il codice e la password/i)
    expect(message).toMatch(/registrati di nuovo con la stessa email/i)
  })

  it('decide sul codice, non sul messaggio del backend', () => {
    const error = rtkError(401, 'INVALID_CREDENTIALS', { message: 'Bad credentials' })
    expect(getErrorMessage(error)).not.toContain('Bad credentials')
  })

  it('con un codice sconosciuto ripiega sul messaggio del backend', () => {
    const error = rtkError(400, 'NEW_UNKNOWN_CODE', { message: 'Descrizione dal backend' })
    expect(getErrorMessage(error)).toBe('Descrizione dal backend')
  })

  it('con un codice sconosciuto e senza messaggio dà il testo generico', () => {
    const error = rtkError(400, 'NEW_UNKNOWN_CODE', { message: '' })
    expect(getErrorMessage(error)).toBe(ERROR_MESSAGES.INTERNAL_ERROR)
  })

  it('errore di rete (FETCH_ERROR): server non raggiungibile', () => {
    expect(getErrorMessage({ status: 'FETCH_ERROR', error: 'TypeError' })).toMatch(
      /non raggiungibile/i,
    )
  })

  it('timeout: il server non ha risposto in tempo', () => {
    expect(getErrorMessage({ status: 'TIMEOUT_ERROR', error: 'x' })).toMatch(/in tempo/i)
  })

  it.each([502, 503, 504])(
    'risposta %i non JSON (proxy o riavvio): server non raggiungibile',
    (originalStatus) => {
      const error = { status: 'PARSING_ERROR', originalStatus, data: '<html>', error: 'x' }
      expect(getErrorMessage(error)).toMatch(/non raggiungibile/i)
    },
  )

  it('un errore JavaScript qualunque dà il testo generico, senza il suo messaggio tecnico', () => {
    expect(getErrorMessage(new Error('Cannot read properties of undefined'))).toBe(
      ERROR_MESSAGES.INTERNAL_ERROR,
    )
    expect(getErrorMessage(undefined)).toBe(ERROR_MESSAGES.INTERNAL_ERROR)
  })
})

describe('getFieldErrors', () => {
  it('restituisce i campi di un VALIDATION_ERROR', () => {
    const error = rtkError(400, 'VALIDATION_ERROR', { fields: { email: 'Email non valida' } })
    expect(getFieldErrors(error)).toEqual({ email: 'Email non valida' })
  })

  it('restituisce il campo di un ADDRESS_NOT_FOUND', () => {
    const error = rtkError(400, 'ADDRESS_NOT_FOUND', {
      fields: { address: 'Indirizzo non trovato' },
    })
    expect(getFieldErrors(error)).toEqual({ address: 'Indirizzo non trovato' })
  })

  it('DISPLAY_NAME_TAKEN: il nome occupato è un errore del campo displayName, anche senza fields', () => {
    const error = rtkError(409, 'DISPLAY_NAME_TAKEN')
    expect(getFieldErrors(error)).toEqual({ displayName: 'Nome già utilizzato.' })
  })

  it('ignora i campi di altri codici', () => {
    const error = rtkError(409, 'EMAIL_ALREADY_REGISTERED', { fields: { email: 'x' } })
    expect(getFieldErrors(error)).toEqual({})
  })

  it('senza errore o con un errore di rete restituisce un oggetto vuoto', () => {
    expect(getFieldErrors(undefined)).toEqual({})
    expect(getFieldErrors({ status: 'FETCH_ERROR', error: 'x' })).toEqual({})
  })
})
