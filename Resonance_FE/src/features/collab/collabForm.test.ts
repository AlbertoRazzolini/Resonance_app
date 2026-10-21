import { describe, expect, it } from 'vitest'
import {
  buildCollabRequest,
  EMPTY_COLLAB_VALUES,
  validateApplication,
  validateCollab,
  wasCollabDeleted,
  type CollabFormValues,
} from './collabForm'

// Logica pura del modulo «Pubblica annuncio»: controlli come quelli del backend (progettazione, sezione 6.7: titolo
// 3–150, descrizione e ruolo obbligatori, luogo facoltativo) e corpo della richiesta con il luogo vuoto omesso; il
// messaggio di candidatura ha da 1 a 1800 caratteri.
const valid: CollabFormValues = {
  ...EMPTY_COLLAB_VALUES,
  title: 'Cercasi bassista',
  description: 'Progetto post-rock.',
  roleNeeded: 'Bassista',
}

describe('validateCollab', () => {
  it('un annuncio con i soli campi obbligatori non ha errori', () => {
    expect(validateCollab(valid)).toEqual({})
  })

  it('i campi obbligatori vuoti hanno ciascuno il suo messaggio', () => {
    expect(validateCollab(EMPTY_COLLAB_VALUES)).toEqual({
      title: 'Scrivi il titolo.',
      description: 'Scrivi la descrizione.',
      roleNeeded: 'Scrivi il ruolo cercato.',
    })
  })

  it('i campi di soli spazi contano come vuoti', () => {
    expect(validateCollab({ ...valid, title: '   ', description: ' \n ', roleNeeded: ' ' })).toEqual({
      title: 'Scrivi il titolo.',
      description: 'Scrivi la descrizione.',
      roleNeeded: 'Scrivi il ruolo cercato.',
    })
  })

  it('il titolo ha da 3 a 150 caratteri, contati dopo il trim', () => {
    expect(validateCollab({ ...valid, title: ' ab ' }).title).toBe('Il titolo deve avere almeno 3 caratteri.')
    expect(validateCollab({ ...valid, title: 'abc' })).toEqual({})
    expect(validateCollab({ ...valid, title: 'a'.repeat(150) })).toEqual({})
    expect(validateCollab({ ...valid, title: 'a'.repeat(151) }).title).toBe('Il titolo può avere al massimo 150 caratteri.')
  })

  it('descrizione al massimo 5000, ruolo 100 e luogo 150 caratteri', () => {
    expect(validateCollab({ ...valid, description: 'a'.repeat(5001) }).description).toBe(
      'La descrizione può avere al massimo 5000 caratteri.',
    )
    expect(validateCollab({ ...valid, roleNeeded: 'a'.repeat(101) }).roleNeeded).toBe(
      'Il ruolo cercato può avere al massimo 100 caratteri.',
    )
    expect(validateCollab({ ...valid, location: 'a'.repeat(151) }).location).toBe(
      'Il luogo può avere al massimo 150 caratteri.',
    )
    expect(validateCollab({ ...valid, description: 'a'.repeat(5000), roleNeeded: 'a'.repeat(100), location: 'a'.repeat(150) })).toEqual({})
  })
})

describe('buildCollabRequest', () => {
  it('toglie gli spazi ai bordi dei testi e tiene i generi come sono', () => {
    const body = buildCollabRequest({
      ...valid,
      title: '  Cercasi bassista ',
      description: ' Progetto post-rock. ',
      roleNeeded: ' Bassista ',
      genreTags: ['post-rock'],
    })

    expect(body).toEqual({
      title: 'Cercasi bassista',
      description: 'Progetto post-rock.',
      roleNeeded: 'Bassista',
      genreTags: ['post-rock'],
    })
  })

  it('omette il luogo se vuoto e lo manda se c\'è', () => {
    expect(buildCollabRequest({ ...valid, location: '   ' })).not.toHaveProperty('location')
    expect(buildCollabRequest({ ...valid, location: ' Milano ' })).toMatchObject({ location: 'Milano' })
  })
})

describe('wasCollabDeleted', () => {
  it('è vero solo con il segno della cancellazione', () => {
    expect(wasCollabDeleted({ collabDeleted: true })).toBe(true)
    expect(wasCollabDeleted({ collabDeleted: false })).toBe(false)
    expect(wasCollabDeleted({ eventDeleted: true })).toBe(false)
    expect(wasCollabDeleted(null)).toBe(false)
    expect(wasCollabDeleted(undefined)).toBe(false)
    expect(wasCollabDeleted('collabDeleted')).toBe(false)
  })
})

describe('validateApplication', () => {
  it('un messaggio scritto non ha errori', () => {
    expect(validateApplication('Suono il basso')).toBeUndefined()
  })

  it('vuoto o di soli spazi dà «Scrivi il messaggio.»', () => {
    expect(validateApplication('')).toBe('Scrivi il messaggio.')
    expect(validateApplication(' \n ')).toBe('Scrivi il messaggio.')
  })

  it('al massimo 1800 caratteri, contati dopo il trim', () => {
    expect(validateApplication('a'.repeat(1800))).toBeUndefined()
    expect(validateApplication(` ${'a'.repeat(1800)} `)).toBeUndefined()
    expect(validateApplication('a'.repeat(1801))).toBe('Il messaggio può avere al massimo 1800 caratteri.')
  })
})
