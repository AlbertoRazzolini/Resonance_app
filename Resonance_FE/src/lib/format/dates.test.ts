import { describe, expect, it } from 'vitest'
import {
  formatChatDay,
  formatChatListTime,
  formatClock,
  formatDate,
  formatEventDate,
  formatEventDateLong,
  isSameDay,
} from './dates'

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

// Orari della chat: «adesso» si passa a parte, così i test non dipendono dal giorno in cui girano.
describe('orari della chat', () => {
  // Giovedì 22 ottobre 2026, ore 15:00
  const now = new Date(2026, 9, 22, 15, 0)

  describe('formatClock', () => {
    it('scrive ore e minuti con due cifre', () => {
      expect(formatClock(localInstant(2026, 10, 22, 8, 5))).toBe('08:05')
    })
  })

  describe('isSameDay', () => {
    it('vale per due istanti dello stesso giorno di calendario, anche lontani fra loro', () => {
      expect(isSameDay(localInstant(2026, 10, 22, 0, 1), localInstant(2026, 10, 22, 23, 59))).toBe(true)
    })

    it('non vale a cavallo della mezzanotte', () => {
      expect(isSameDay(localInstant(2026, 10, 22, 23, 59), localInstant(2026, 10, 23, 0, 1))).toBe(false)
    })
  })

  describe('formatChatListTime', () => {
    it('oggi scrive l’ora', () => {
      expect(formatChatListTime(localInstant(2026, 10, 22, 9, 30), now)).toBe('09:30')
    })

    it('ieri scrive «Ieri»', () => {
      expect(formatChatListTime(localInstant(2026, 10, 21, 23, 0), now)).toBe('Ieri')
    })

    it('negli ultimi sei giorni scrive il giorno della settimana abbreviato', () => {
      // Lunedì 19 ottobre
      expect(formatChatListTime(localInstant(2026, 10, 19, 12, 0), now)).toBe('lun')
    })

    it('prima di una settimana scrive giorno e mese', () => {
      expect(formatChatListTime(localInstant(2026, 10, 4, 12, 0), now)).toBe('4 ott')
    })

    it('in un altro anno aggiunge l’anno', () => {
      expect(formatChatListTime(localInstant(2025, 12, 31, 12, 0), now)).toBe('31 dic 2025')
    })
  })

  describe('formatChatDay', () => {
    it('oggi scrive «Oggi»', () => {
      expect(formatChatDay(localInstant(2026, 10, 22, 1, 0), now)).toBe('Oggi')
    })

    it('ieri scrive «Ieri»', () => {
      expect(formatChatDay(localInstant(2026, 10, 21, 22, 0), now)).toBe('Ieri')
    })

    it('un altro giorno scrive il giorno per esteso', () => {
      expect(formatChatDay(localInstant(2026, 10, 18, 12, 0), now)).toBe('domenica 18 ottobre')
    })

    it('in un altro anno aggiunge l’anno', () => {
      expect(formatChatDay(localInstant(2025, 12, 31, 12, 0), now)).toBe('mercoledì 31 dicembre 2025')
    })
  })
})
