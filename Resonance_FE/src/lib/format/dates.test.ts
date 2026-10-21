import { describe, expect, it } from 'vitest'
import { formatDate, formatEventDate, formatEventDateLong } from './dates'

// Un istante costruito dall'ora locale del computer: l'ora scritta resta la stessa in qualunque fuso orario.
const localInstant = (y: number, month: number, d: number, h: number, min: number) =>
  new Date(y, month - 1, d, h, min).toISOString()

// Formato breve delle date mostrate all'utente (es. la fine di una sospensione), in ora locale e in italiano.
describe('formatDate', () => {
  it('scrive giorno, mese e anno in numeri, separati da una barra', () => {
    // A mezzogiorno UTC il giorno è lo stesso in tutti i fusi orari (da -11 a +11)
    expect(formatDate('2026-10-30T12:00:00Z')).toBe('30/10/2026')
  })

  it('mette lo zero davanti a giorni e mesi da 1 a 9', () => {
    expect(formatDate('2026-11-05T12:00:00Z')).toBe('05/11/2026')
  })
})

// Data degli eventi, come nel mock-up: giorno della settimana e ora, sempre nell'ora locale del browser.
describe('formatEventDate', () => {
  it('scrive giorno della settimana, giorno, mese abbreviato e ora separati da un punto', () => {
    // 23 ottobre 2026 è un venerdì
    expect(formatEventDate(localInstant(2026, 10, 23, 21, 30))).toBe('ven 23 ott · 21:30')
  })

  it('l\'ora ha sempre due cifre, anche a notte fonda', () => {
    expect(formatEventDate(localInstant(2026, 10, 24, 0, 5))).toBe('sab 24 ott · 00:05')
  })
})

describe('formatEventDateLong', () => {
  it('nel dettaglio scrive giorno e mese per esteso e l\'anno', () => {
    expect(formatEventDateLong(localInstant(2026, 10, 23, 21, 30))).toBe('venerdì 23 ottobre 2026 · 21:30')
  })
})
