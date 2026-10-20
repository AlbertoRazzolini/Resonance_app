import { describe, expect, it } from 'vitest'
import { hostOf, parseHttpUrl } from './urls'

// Indirizzi esterni: solo http e https sono ammessi (progettazione, sezione 4.13); tutto il resto è inerte.
describe('parseHttpUrl', () => {
  it.each([
    'https://www.ticketone.it/evento/x',
    'http://example.com',
    'HTTPS://EXAMPLE.COM/path',
  ])('accetta %s', (value) => {
    expect(parseHttpUrl(value)).toBeInstanceOf(URL)
  })

  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    ' javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'ftp://example.com/file',
    'file:///etc/passwd',
    'mailto:a@example.com',
    '//example.com/protocol-relative',
    '/solo/percorso',
    'www.example.com',
    'non è un indirizzo',
    '',
  ])('rifiuta %s', (value) => {
    expect(parseHttpUrl(value)).toBeNull()
  })

  it('rifiuta un valore nullo o mancante', () => {
    expect(parseHttpUrl(null)).toBeNull()
    expect(parseHttpUrl(undefined)).toBeNull()
  })
})

describe('hostOf', () => {
  it('è il dominio dell\'indirizzo, senza percorso', () => {
    expect(hostOf(new URL('https://www.ticketone.it/evento/x?a=1'))).toBe('www.ticketone.it')
  })

  it('con utente e password nell\'indirizzo mostra il dominio vero, non il nome che precede la @', () => {
    expect(hostOf(new URL('https://www.banca.it@evil.example/login'))).toBe('evil.example')
  })
})
