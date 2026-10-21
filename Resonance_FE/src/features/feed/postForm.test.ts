import { describe, expect, it } from 'vitest'
import { buildPostRequest, IMAGE_URL_MAX, POST_BODY_MAX, validatePost } from './postForm'

// Controlli del modulo «Nuovo post» (gli stessi del backend: testo 1–2000, immagine http/https fino a 2048) e corpo della richiesta.
describe('validatePost · testo', () => {
  it('un testo vuoto o di soli spazi non va bene', () => {
    expect(validatePost({ body: '', imageUrl: '' }).body).toBe('Scrivi qualcosa (massimo 2000 caratteri).')
    expect(validatePost({ body: '   \n ', imageUrl: '' }).body).toBe('Scrivi qualcosa (massimo 2000 caratteri).')
  })

  it('2000 caratteri vanno bene, 2001 no', () => {
    expect(validatePost({ body: 'a'.repeat(POST_BODY_MAX), imageUrl: '' })).toEqual({})
    expect(validatePost({ body: 'a'.repeat(POST_BODY_MAX + 1), imageUrl: '' }).body).toBeDefined()
  })

  it('gli spazi ai bordi non contano nel limite', () => {
    expect(validatePost({ body: ` ${'a'.repeat(POST_BODY_MAX)} `, imageUrl: '' })).toEqual({})
  })
})

describe('validatePost · immagine', () => {
  const IMAGE_ERROR = 'Inserisci un indirizzo che inizi con http:// o https://.'

  it('senza immagine va bene', () => {
    expect(validatePost({ body: 'ciao', imageUrl: '' })).toEqual({})
    expect(validatePost({ body: 'ciao', imageUrl: '   ' })).toEqual({})
  })

  it.each(['https://example.com/a.png', 'http://example.com/a.png'])('%s va bene', (imageUrl) => {
    expect(validatePost({ body: 'ciao', imageUrl })).toEqual({})
  })

  it.each(['javascript:alert(1)', 'data:image/png;base64,AAAA', 'ftp://example.com/a.png', 'example.com/a.png', 'non un indirizzo'])(
    '%s non va bene',
    (imageUrl) => {
      expect(validatePost({ body: 'ciao', imageUrl }).imageUrl).toBe(IMAGE_ERROR)
    },
  )

  it('un indirizzo oltre 2048 caratteri non va bene', () => {
    const tooLong = `https://example.com/${'a'.repeat(IMAGE_URL_MAX)}`
    expect(validatePost({ body: 'ciao', imageUrl: tooLong }).imageUrl).toBe(IMAGE_ERROR)
  })

  it('segnala testo e immagine insieme', () => {
    expect(Object.keys(validatePost({ body: '', imageUrl: 'x' })).sort()).toEqual(['body', 'imageUrl'])
  })
})

describe('buildPostRequest', () => {
  it('manda il testo senza spazi ai bordi e niente di facoltativo se manca', () => {
    expect(buildPostRequest({ body: '  ciao  ', imageUrl: '' }, null)).toEqual({ body: 'ciao' })
  })

  it('aggiunge l\'immagine senza spazi ai bordi', () => {
    expect(buildPostRequest({ body: 'ciao', imageUrl: ' https://example.com/a.png ' }, null)).toEqual({
      body: 'ciao',
      imageUrl: 'https://example.com/a.png',
    })
  })

  it('aggiunge latitudine e longitudine insieme', () => {
    expect(buildPostRequest({ body: 'ciao', imageUrl: '' }, { latitude: 43.7, longitude: 11.2 })).toEqual({
      body: 'ciao',
      latitude: 43.7,
      longitude: 11.2,
    })
  })
})
