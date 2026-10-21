import { describe, expect, it } from 'vitest'
import { addGenre } from './genres'

// Regole dei generi di eventi e annunci (progettazione, sezioni 6.6 e 6.7): senza spazi ai bordi, in minuscolo, senza
// doppioni, al massimo 30 caratteri ciascuno e 10 in tutto.
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

  it('con 10 generi non ne entra un altro', () => {
    const ten = Array.from({ length: 10 }, (_, index) => `g${index}`)

    const result = addGenre(ten, 'undicesimo')

    expect(result.tags).toEqual(ten)
    expect(result.error).toBe('Puoi indicare al massimo 10 generi.')
  })
})
