import { describe, expect, it } from 'vitest'
import { formatDate } from './dates'

// Formato breve delle date mostrate all'utente (es. la fine di una sospensione), in ora locale e in italiano.
describe('formatDate', () => {
  it('scrive giorno, mese abbreviato e anno', () => {
    // A mezzogiorno UTC il giorno è lo stesso in tutti i fusi orari (da -11 a +11)
    expect(formatDate('2026-10-30T12:00:00Z')).toBe('30 ott 2026')
  })

  it('non mette lo zero davanti ai giorni da 1 a 9', () => {
    expect(formatDate('2026-11-05T12:00:00Z')).toBe('5 nov 2026')
  })
})
