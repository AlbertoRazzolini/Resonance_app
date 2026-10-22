import { describe, expect, it } from 'vitest'
import { buildSuspendRequest, isSuspensionValid, REASON_MAX, SUSPENSION_DAYS } from './suspensionForm'

// Regole del form di sospensione (progettazione, sezione 5.5): motivo da 1 a 500 caratteri senza spazi ai bordi, una
// durata scelta fra quelle fisse oppure indeterminata, e un corpo che porta al massimo una delle due forme di durata.
describe('SUSPENSION_DAYS', () => {
  it('offre le durate fisse approvate', () => {
    expect(SUSPENSION_DAYS).toEqual([1, 3, 7, 30, 90])
  })
})

describe('isSuspensionValid', () => {
  it('serve un motivo e una durata', () => {
    expect(isSuspensionValid({ reason: 'Spam', duration: 7 })).toBe(true)
    expect(isSuspensionValid({ reason: 'Spam', duration: 'indefinite' })).toBe(true)
  })

  it('rifiuta un motivo vuoto o di soli spazi', () => {
    expect(isSuspensionValid({ reason: '', duration: 7 })).toBe(false)
    expect(isSuspensionValid({ reason: '   ', duration: 7 })).toBe(false)
  })

  it('rifiuta un motivo oltre i 500 caratteri, ma accetta esattamente 500', () => {
    expect(isSuspensionValid({ reason: 'a'.repeat(REASON_MAX), duration: 7 })).toBe(true)
    expect(isSuspensionValid({ reason: 'a'.repeat(REASON_MAX + 1), duration: 7 })).toBe(false)
  })

  it('rifiuta la sospensione senza una durata scelta', () => {
    expect(isSuspensionValid({ reason: 'Spam', duration: null })).toBe(false)
  })
})

describe('buildSuspendRequest', () => {
  it('con una durata in giorni invia solo il motivo senza spazi ai bordi e i giorni', () => {
    expect(buildSuspendRequest({ reason: '  Spam ripetuto ', duration: 30 })).toEqual({
      reason: 'Spam ripetuto',
      durationDays: 30,
    })
  })

  it('con la durata indeterminata invia il solo motivo, senza giorni né data', () => {
    const request = buildSuspendRequest({ reason: 'Truffa', duration: 'indefinite' })
    expect(request).toEqual({ reason: 'Truffa' })
    expect(Object.keys(request)).toEqual(['reason'])
  })
})
