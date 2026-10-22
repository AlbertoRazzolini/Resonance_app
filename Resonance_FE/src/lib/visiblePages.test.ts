import { describe, expect, it } from 'vitest'
import { visiblePages } from './visiblePages'

// Pagine visibili nei numeri di pagina: tutte se sono poche, altrimenti prima, ultima e vicine alla corrente con i puntini.
describe('visiblePages', () => {
  it('mostra tutte le pagine quando sono poche', () => {
    expect(visiblePages(0, 5)).toEqual([0, 1, 2, 3, 4])
  })

  it('tiene la prima, l ultima e le vicine alla corrente, con i puntini fra i salti', () => {
    expect(visiblePages(5, 12)).toEqual([0, null, 4, 5, 6, null, 11])
  })

  it('non mette puntini dove manca una sola pagina', () => {
    expect(visiblePages(3, 10)).toEqual([0, 1, 2, 3, 4, null, 9])
  })
})
