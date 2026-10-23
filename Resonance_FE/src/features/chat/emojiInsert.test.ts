import { describe, expect, it } from 'vitest'
import { insertAtSelection } from './emojiInsert'

// Inserimento di un testo nel punto del cursore o al posto della selezione, con un tetto di lunghezza.
describe('insertAtSelection', () => {
  it('inserisce nel punto del cursore e mette il cursore dopo il testo', () => {
    expect(insertAtSelection('Ciao Anna', 4, 4, '🎸', 2000)).toEqual({ value: 'Ciao🎸 Anna', caret: 4 + '🎸'.length })
  })

  it('sostituisce la selezione', () => {
    expect(insertAtSelection('Ciao Anna', 5, 9, '🎸', 2000)).toEqual({ value: 'Ciao 🎸', caret: 5 + '🎸'.length })
  })

  it('con la selezione al contrario (fine prima dell’inizio) la tratta come ordinata', () => {
    expect(insertAtSelection('Ciao Anna', 9, 5, '🎸', 2000)).toEqual({ value: 'Ciao 🎸', caret: 5 + '🎸'.length })
  })

  it('inserisce in un testo vuoto', () => {
    expect(insertAtSelection('', 0, 0, '🎸', 2000)).toEqual({ value: '🎸', caret: '🎸'.length })
  })

  it('conta le unità UTF-16 come fa il contatore: una bandiera sono 4 unità', () => {
    expect(insertAtSelection('abc', 3, 3, '🇮🇹', 7)).toEqual({ value: 'abc🇮🇹', caret: 7 })
    expect(insertAtSelection('abc', 3, 3, '🇮🇹', 6)).toBeNull()
  })

  it('con il testo già al limite non inserisce', () => {
    expect(insertAtSelection('a'.repeat(2000), 5, 5, '🎸', 2000)).toBeNull()
  })

  it('sostituendo una selezione, il limite si conta sul testo risultante', () => {
    expect(insertAtSelection('a'.repeat(2000), 0, 10, '🎸', 2000)).toEqual({
      value: '🎸' + 'a'.repeat(1990),
      caret: '🎸'.length,
    })
  })

  it('un cursore fuori dal testo viene riportato nei limiti', () => {
    expect(insertAtSelection('ab', 10, 10, '🎸', 2000)).toEqual({ value: 'ab🎸', caret: 2 + '🎸'.length })
  })
})
