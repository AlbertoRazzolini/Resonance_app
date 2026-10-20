import { describe, expect, it } from 'vitest'
import {
  addGenre,
  buildConcertRequest,
  buildIndieEventRequest,
  EMPTY_EVENT_VALUES,
  eventDateToIso,
  validateEvent,
  wasEventDeleted,
  type EventFormValues,
} from './eventForm'

// Logica pura dei form di pubblicazione: data con offset (Review Focus 5), generi normalizzati, controlli come quelli
// del backend (progettazione, sezione 6.6), corpi delle richieste con i campi vuoti omessi.
const NOW = new Date(2026, 9, 20, 12, 0)

const valid: EventFormValues = {
  ...EMPTY_EVENT_VALUES,
  title: 'Serata rock',
  venueName: 'Viper Theatre',
  address: 'Via Pistoiese 309, Firenze',
  eventDate: '2026-10-21T21:00',
}

describe('eventDateToIso', () => {
  it("manda l'istante con offset, mai la data senza fuso del campo", () => {
    const iso = eventDateToIso('2026-10-21T21:00')

    expect(iso).toBe(new Date(2026, 9, 21, 21, 0).toISOString())
    expect(iso).toMatch(/Z$|[+-]\d{2}:\d{2}$/)
    expect(iso).not.toBe('2026-10-21T21:00')
  })
})

describe('addGenre', () => {
  it('toglie gli spazi e scrive in minuscolo', () => {
    expect(addGenre([], '  Post-Punk ').tags).toEqual(['post-punk'])
  })

  it('un genere già presente (anche con maiuscole diverse) non si aggiunge due volte', () => {
    expect(addGenre(['rock'], 'ROCK').tags).toEqual(['rock'])
  })

  it('un testo vuoto o di soli spazi non aggiunge niente e non è un errore', () => {
    expect(addGenre(['rock'], '   ')).toEqual({ tags: ['rock'] })
  })

  it('oltre 30 caratteri è rifiutato con un messaggio', () => {
    const result = addGenre([], 'a'.repeat(31))

    expect(result.tags).toEqual([])
    expect(result.error).toBe('Un genere può avere al massimo 30 caratteri.')
  })

  it("con 10 generi non ne entra un altro", () => {
    const ten = Array.from({ length: 10 }, (_, index) => `g${index}`)

    const result = addGenre(ten, 'undicesimo')

    expect(result.tags).toEqual(ten)
    expect(result.error).toBe('Puoi indicare al massimo 10 generi.')
  })
})

describe('validateEvent', () => {
  it('un evento completo e futuro non ha errori', () => {
    expect(validateEvent(valid, 'concert', NOW)).toEqual({})
  })

  it('i campi obbligatori vuoti hanno ciascuno il suo messaggio', () => {
    const errors = validateEvent(EMPTY_EVENT_VALUES, 'concert', NOW)

    expect(errors).toEqual({
      title: 'Scrivi il titolo.',
      venueName: 'Scrivi il nome del locale.',
      address: "Scrivi l'indirizzo.",
      eventDate: "Scegli la data e l'ora.",
    })
  })

  it('il titolo ha almeno 3 caratteri dopo il trim e al massimo 150', () => {
    expect(validateEvent({ ...valid, title: ' ab ' }, 'concert', NOW).title).toBe(
      'Il titolo deve avere almeno 3 caratteri.',
    )
    expect(validateEvent({ ...valid, title: 'a'.repeat(151) }, 'concert', NOW).title).toBe(
      'Il titolo può avere al massimo 150 caratteri.',
    )
  })

  it('descrizione, locale e indirizzo rispettano i limiti del backend', () => {
    const errors = validateEvent(
      { ...valid, description: 'a'.repeat(5001), venueName: 'a'.repeat(151), address: 'a'.repeat(256) },
      'concert',
      NOW,
    )

    expect(Object.keys(errors).sort()).toEqual(['address', 'description', 'venueName'])
  })

  it("una data passata o uguale a adesso è rifiutata", () => {
    expect(validateEvent({ ...valid, eventDate: '2026-10-19T21:00' }, 'concert', NOW).eventDate).toBe(
      'Scegli una data futura.',
    )
    expect(validateEvent({ ...valid, eventDate: '2026-10-20T12:00' }, 'concert', NOW).eventDate).toBe(
      'Scegli una data futura.',
    )
  })

  it('copertina e biglietto solo http o https', () => {
    const errors = validateEvent(
      { ...valid, coverImageUrl: 'javascript:alert(1)', externalTicketUrl: 'ftp://x.it/b' },
      'concert',
      NOW,
    )

    expect(errors.coverImageUrl).toBe('Scrivi un indirizzo che inizia con http:// o https://.')
    expect(errors.externalTicketUrl).toBe('Scrivi un indirizzo che inizia con http:// o https://.')
  })

  it("nell'indie event il biglietto non esiste e non si controlla", () => {
    expect(validateEvent({ ...valid, externalTicketUrl: 'non-un-indirizzo' }, 'indie', NOW)).toEqual({})
  })
})

describe('buildConcertRequest', () => {
  it('toglie gli spazi, omette i campi facoltativi vuoti e converte la data', () => {
    const request = buildConcertRequest({ ...valid, title: '  Serata rock  ', genreTags: ['rock'] })

    expect(request).toEqual({
      title: 'Serata rock',
      venueName: 'Viper Theatre',
      address: 'Via Pistoiese 309, Firenze',
      eventDate: new Date(2026, 9, 21, 21, 0).toISOString(),
      genreTags: ['rock'],
    })
    expect('description' in request).toBe(false)
    expect('coverImageUrl' in request).toBe(false)
    expect('externalTicketUrl' in request).toBe(false)
  })

  it('porta descrizione, copertina e biglietto quando ci sono', () => {
    const request = buildConcertRequest({
      ...valid,
      description: ' Porte alle 21 ',
      coverImageUrl: ' https://x.it/c.jpg ',
      externalTicketUrl: 'https://x.it/b',
    })

    expect(request).toMatchObject({
      description: 'Porte alle 21',
      coverImageUrl: 'https://x.it/c.jpg',
      externalTicketUrl: 'https://x.it/b',
    })
  })
})

describe('buildIndieEventRequest', () => {
  it('aggiunge isFree e lo stato richiesto, senza biglietto', () => {
    const request = buildIndieEventRequest({ ...valid, isFree: true, externalTicketUrl: 'https://x.it/b' }, 'DRAFT')

    expect(request.isFree).toBe(true)
    expect(request.status).toBe('DRAFT')
    expect('externalTicketUrl' in request).toBe(false)
  })

  it('«Pubblica» manda lo stato PUBLISHED', () => {
    expect(buildIndieEventRequest(valid, 'PUBLISHED').status).toBe('PUBLISHED')
  })
})

describe('wasEventDeleted', () => {
  it('riconosce solo il segno della cancellazione', () => {
    expect(wasEventDeleted({ eventDeleted: true })).toBe(true)
    expect(wasEventDeleted({ eventDeleted: 'sì' })).toBe(false)
    expect(wasEventDeleted(null)).toBe(false)
    expect(wasEventDeleted(undefined)).toBe(false)
  })
})
