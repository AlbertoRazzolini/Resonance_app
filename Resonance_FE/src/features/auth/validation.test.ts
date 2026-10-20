import { describe, expect, it } from 'vitest'
import {
  byteLength,
  validateForgot,
  validateRegister,
  validateReset,
  validateVerify,
  type RegisterValues,
  type VerifyValues,
} from './validation'

// Controlli del form di registrazione, con le stesse regole del backend (progettazione, sezioni 4.4 e 6.4; decisione 84):
// un solo messaggio per campo, il primo che non va (vuoto, emoji, caratteri invisibili, lunghezza).
const valid: RegisterValues = {
  displayName: 'Mario Rossi',
  email: 'mario@example.com',
  password: 'password-lunga',
}
const check = (overrides: Partial<RegisterValues>) => validateRegister({ ...valid, ...overrides })

describe('validateRegister · valori giusti', () => {
  it('con valori giusti non ha errori', () => {
    expect(validateRegister(valid)).toEqual({})
  })

  it('accetta lettere accentate, altre scritture e punteggiatura nel nome', () => {
    expect(check({ displayName: 'Zoë Società Già-Là!' }).displayName).toBeUndefined()
    expect(check({ displayName: '漢字 Привет' }).displayName).toBeUndefined()
    expect(check({ displayName: 'AC/DC' }).displayName).toBeUndefined()
  })
})

describe('validateRegister · nome', () => {
  it('vuoto o di soli spazi: chiede il nome', () => {
    expect(check({ displayName: '' }).displayName).toBe('Scrivi il nome visibile.')
    expect(check({ displayName: '    ' }).displayName).toBe('Scrivi il nome visibile.')
  })

  it('da 3 a 30 caratteri dopo aver tolto gli spazi ai lati (come il backend)', () => {
    const range = 'Il nome deve avere da 3 a 30 caratteri.'
    expect(check({ displayName: 'ab' }).displayName).toBe(range)
    expect(check({ displayName: '  ab  ' }).displayName).toBe(range)
    expect(check({ displayName: 'abc' }).displayName).toBeUndefined()
    expect(check({ displayName: '  abc  ' }).displayName).toBeUndefined()
    expect(check({ displayName: 'x'.repeat(30) }).displayName).toBeUndefined()
    expect(check({ displayName: 'x'.repeat(31) }).displayName).toBe(range)
  })

  it('con emoji: messaggio sulle emoji, anche se è anche troppo corto', () => {
    const emoji = 'Le emoji non sono ammesse nel nome.'
    expect(check({ displayName: 'Mario 🎸' }).displayName).toBe(emoji)
    expect(check({ displayName: '🎸' }).displayName).toBe(emoji)
    expect(check({ displayName: '👍🏽 Mario' }).displayName).toBe(emoji)
    expect(check({ displayName: '🇮🇹 Italia' }).displayName).toBe(emoji)
    expect(check({ displayName: 'Mario ©' }).displayName).toBe(emoji)
  })

  it('con caratteri invisibili: messaggio dedicato', () => {
    const invisible = 'Il nome non può contenere caratteri invisibili.'
    expect(check({ displayName: 'Mario\u200BRossi' }).displayName).toBe(invisible)
    expect(check({ displayName: 'Mario\u202Eoiram' }).displayName).toBe(invisible)
    expect(check({ displayName: 'Mario\nRossi' }).displayName).toBe(invisible)
  })
})

describe('validateRegister · email', () => {
  it("vuota o di soli spazi: chiede l'email", () => {
    expect(check({ email: '' }).email).toBe('Scrivi la tua email.')
    expect(check({ email: '   ' }).email).toBe('Scrivi la tua email.')
  })

  it('senza chiocciola, dominio o punto: non valida', () => {
    const invalid = 'Scrivi un indirizzo email valido.'
    expect(check({ email: 'mario' }).email).toBe(invalid)
    expect(check({ email: 'mario@' }).email).toBe(invalid)
    expect(check({ email: 'mario@example' }).email).toBe(invalid)
    expect(check({ email: 'mario @example.com' }).email).toBe(invalid)
  })

  it('accetta spazi ai lati (si tolgono) e al massimo 255 caratteri', () => {
    expect(check({ email: '  mario@example.com  ' }).email).toBeUndefined()
    const local = 'a'.repeat(255 - '@example.com'.length)
    expect(check({ email: `${local}@example.com` }).email).toBeUndefined()
    expect(check({ email: `${local}a@example.com` }).email).toBe(
      "L'email può avere al massimo 255 caratteri.",
    )
  })
})

describe('validateRegister · password', () => {
  it('vuota o di soli spazi: chiede la password (il backend rifiuta le password bianche)', () => {
    expect(check({ password: '' }).password).toBe('Scrivi la password.')
    expect(check({ password: ' '.repeat(8) }).password).toBe('Scrivi la password.')
  })

  it('gli spazi dentro e ai lati fanno parte della password e non si tolgono', () => {
    expect(check({ password: '  una frase lunga  ' }).password).toBeUndefined()
    expect(check({ password: ' 1234567' }).password).toBeUndefined()
  })

  it('da 8 caratteri: con 7 è troppo corta', () => {
    expect(check({ password: '1234567' }).password).toBe(
      'La password deve avere almeno 8 caratteri.',
    )
    expect(check({ password: '12345678' }).password).toBeUndefined()
  })

  it('al massimo 72 caratteri', () => {
    const tooLong =
      'La password è troppo lunga: al massimo 72 byte (le lettere accentate ne occupano di più).'
    expect(check({ password: 'a'.repeat(72) }).password).toBeUndefined()
    expect(check({ password: 'a'.repeat(73) }).password).toBe(tooLong)
  })

  it('al massimo 72 byte: 40 lettere "è" sono 40 caratteri ma 80 byte (come TextEncoder)', () => {
    // Review Focus 4: sotto i 72 caratteri ma oltre i 72 byte, il client la blocca come il backend
    const tooLong =
      'La password è troppo lunga: al massimo 72 byte (le lettere accentate ne occupano di più).'
    expect(byteLength('è'.repeat(40))).toBe(80)
    expect(check({ password: 'è'.repeat(40) }).password).toBe(tooLong)
    expect(check({ password: 'è'.repeat(36) }).password).toBeUndefined()
    expect(check({ password: 'è'.repeat(37) }).password).toBe(tooLong)
  })

  it('30 emoji (sotto 72 caratteri, 120 byte) sono bloccate: messaggio sulle emoji', () => {
    expect(check({ password: '😀'.repeat(30) }).password).toBe(
      'Le emoji non sono ammesse nella password.',
    )
    expect(check({ password: 'password-🎸-lunga' }).password).toBe(
      'Le emoji non sono ammesse nella password.',
    )
  })

  it("un'emoji vince sulla lunghezza: nessun messaggio doppio", () => {
    expect(check({ password: '🎸' }).password).toBe('Le emoji non sono ammesse nella password.')
  })

  it('cifre, # e * sono testo normale, non emoji', () => {
    expect(check({ password: '12345678#*' }).password).toBeUndefined()
  })
})

describe('validateRegister · più campi', () => {
  it('restituisce un errore per ogni campo sbagliato', () => {
    expect(validateRegister({ displayName: '', email: 'x', password: '' })).toEqual({
      displayName: 'Scrivi il nome visibile.',
      email: 'Scrivi un indirizzo email valido.',
      password: 'Scrivi la password.',
    })
  })
})

describe('validateVerify', () => {
  const ok: VerifyValues = {
    email: 'mario@example.com',
    code: '482019',
    password: 'password-lunga',
  }

  it('con valori giusti non ha errori', () => {
    expect(validateVerify(ok)).toEqual({})
  })

  it('il codice deve avere esattamente 6 cifre', () => {
    const message = 'Scrivi le 6 cifre del codice.'
    expect(validateVerify({ ...ok, code: '' }).code).toBe(message)
    expect(validateVerify({ ...ok, code: '48201' }).code).toBe(message)
    expect(validateVerify({ ...ok, code: '4820' + 'ab' }).code).toBe(message)
    expect(validateVerify({ ...ok, code: '482019' }).code).toBeUndefined()
  })

  it('email come nella registrazione: vuota o non valida', () => {
    expect(validateVerify({ ...ok, email: '  ' }).email).toBe('Scrivi la tua email.')
    expect(validateVerify({ ...ok, email: 'mario@' }).email).toBe(
      'Scrivi un indirizzo email valido.',
    )
  })

  it('la password deve esserci, ma non si applicano le regole di una nuova password', () => {
    expect(validateVerify({ ...ok, password: '' }).password).toBe('Scrivi la password.')
    expect(validateVerify({ ...ok, password: '   ' }).password).toBe('Scrivi la password.')
    // Il backend decide se è quella della registrazione (WRONG_PASSWORD): qui non si blocca niente
    expect(validateVerify({ ...ok, password: 'corta' }).password).toBeUndefined()
  })
})

describe('validateForgot', () => {
  it("chiede un'email scritta bene", () => {
    expect(validateForgot({ email: 'mario@example.com' })).toEqual({})
    expect(validateForgot({ email: '  ' }).email).toBe('Scrivi la tua email.')
    expect(validateForgot({ email: 'mario@' }).email).toBe('Scrivi un indirizzo email valido.')
  })
})

describe('validateReset', () => {
  const ok = { email: 'mario@example.com', code: '482019', newPassword: 'password-lunga' }

  it('con valori giusti non ha errori', () => {
    expect(validateReset(ok)).toEqual({})
  })

  it('il codice deve avere esattamente 6 cifre', () => {
    expect(validateReset({ ...ok, code: '4820' }).code).toBe('Scrivi le 6 cifre del codice.')
  })

  it('la nuova password segue le regole della registrazione, con gli stessi messaggi', () => {
    expect(validateReset({ ...ok, newPassword: '' }).newPassword).toBe('Scrivi la password.')
    expect(validateReset({ ...ok, newPassword: '1234567' }).newPassword).toBe(
      'La password deve avere almeno 8 caratteri.',
    )
    expect(validateReset({ ...ok, newPassword: 'password-🎸-lunga' }).newPassword).toBe(
      'Le emoji non sono ammesse nella password.',
    )
    expect(validateReset({ ...ok, newPassword: 'è'.repeat(40) }).newPassword).toBe(
      'La password è troppo lunga: al massimo 72 byte (le lettere accentate ne occupano di più).',
    )
  })
})
