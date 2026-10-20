import { describe, expect, it } from 'vitest'
import { makeMe } from '@/test/fixtures/users'
import {
  buildLocationPatch,
  buildProfilePatch,
  isHttpUrl,
  profileValues,
  validateProfile,
  wasProfileUpdated,
} from './profilePatch'

// Logica pura del form del profilo: valori di partenza, PATCH con i soli campi cambiati (stringa vuota per svuotare),
// controlli dei campi con le regole del backend (sezione 6.5) e coordinate sempre insieme e arrotondate.
const saved = profileValues(
  makeMe({ displayName: 'Mattia', bio: 'Suono la chitarra', city: 'Bologna', avatarUrl: 'https://x.it/a.png' }),
)

describe('profileValues', () => {
  it('parte dal profilo salvato e usa la stringa vuota per i campi nulli', () => {
    expect(profileValues(makeMe({ displayName: 'Mattia' }))).toEqual({
      displayName: 'Mattia',
      bio: '',
      city: '',
      avatarUrl: '',
    })
  })
})

describe('buildProfilePatch', () => {
  it('senza modifiche il PATCH è vuoto', () => {
    expect(buildProfilePatch(saved, saved)).toEqual({})
  })

  it('invia solo i campi cambiati', () => {
    expect(buildProfilePatch({ ...saved, city: 'Milano' }, saved)).toEqual({ city: 'Milano' })
  })

  it('toglie gli spazi ai lati e non considera cambiato un campo che differisce solo per quelli', () => {
    expect(buildProfilePatch({ ...saved, displayName: '  Mattia  ' }, saved)).toEqual({})
    expect(buildProfilePatch({ ...saved, bio: '  Nuova bio ' }, saved)).toEqual({ bio: 'Nuova bio' })
  })

  it('una stringa vuota svuota bio, città e foto (decisione 31)', () => {
    expect(buildProfilePatch({ ...saved, bio: '', city: '', avatarUrl: '' }, saved)).toEqual({
      bio: '',
      city: '',
      avatarUrl: '',
    })
  })

  it('un campo già vuoto e lasciato vuoto non si invia', () => {
    const empty = profileValues(makeMe())
    expect(buildProfilePatch({ ...empty, bio: '   ' }, empty)).toEqual({})
  })

  it('non invia mai il nome vuoto: il nome non si può svuotare', () => {
    expect(buildProfilePatch({ ...saved, displayName: '   ' }, saved)).toEqual({})
  })
})

describe('validateProfile', () => {
  it('con valori giusti non dà errori', () => {
    expect(validateProfile(saved)).toEqual({})
  })

  it('il nome segue le regole della registrazione: obbligatorio, 3-30 caratteri, niente emoji', () => {
    expect(validateProfile({ ...saved, displayName: '' }).displayName).toBe('Scrivi il nome visibile.')
    expect(validateProfile({ ...saved, displayName: 'Ab' }).displayName).toMatch(/da 3 a 30/)
    expect(validateProfile({ ...saved, displayName: 'Mattia 🎸' }).displayName).toBe(
      'Le emoji non sono ammesse nel nome.',
    )
  })

  it('la bio può avere al massimo 500 caratteri', () => {
    expect(validateProfile({ ...saved, bio: 'a'.repeat(500) }).bio).toBeUndefined()
    expect(validateProfile({ ...saved, bio: 'a'.repeat(501) }).bio).toBe(
      'La bio può avere al massimo 500 caratteri.',
    )
  })

  it('la città può avere al massimo 100 caratteri', () => {
    expect(validateProfile({ ...saved, city: 'a'.repeat(101) }).city).toBe(
      'La città può avere al massimo 100 caratteri.',
    )
  })

  it("l'indirizzo della foto deve essere http o https, al massimo 2048 caratteri; vuoto va bene", () => {
    expect(validateProfile({ ...saved, avatarUrl: '' }).avatarUrl).toBeUndefined()
    expect(validateProfile({ ...saved, avatarUrl: 'javascript:alert(1)' }).avatarUrl).toBe(
      'Scrivi un indirizzo che inizia con http:// o https://.',
    )
    expect(validateProfile({ ...saved, avatarUrl: 'ftp://x.it/a.png' }).avatarUrl).toBeDefined()
    expect(validateProfile({ ...saved, avatarUrl: 'https://x.it/' + 'a'.repeat(2048) }).avatarUrl).toBe(
      "L'indirizzo può avere al massimo 2048 caratteri.",
    )
  })

  it('conta i campi dopo il trim, come fa il backend', () => {
    expect(validateProfile({ ...saved, bio: ' ' + 'a'.repeat(500) + ' ' }).bio).toBeUndefined()
  })
})

describe('isHttpUrl', () => {
  it.each(['http://x.it', 'https://x.it/a.png?q=1'])('accetta %s', (url) => {
    expect(isHttpUrl(url)).toBe(true)
  })

  it.each(['javascript:alert(1)', 'data:image/png;base64,AAAA', 'ftp://x.it', '//x.it/a.png', 'x.it', ''])(
    'rifiuta %s',
    (url) => {
      expect(isHttpUrl(url)).toBe(false)
    },
  )
})

describe('wasProfileUpdated', () => {
  it('riconosce solo il segno del salvataggio', () => {
    expect(wasProfileUpdated({ profileUpdated: true })).toBe(true)
    expect(wasProfileUpdated({ profileUpdated: 'sì' })).toBe(false)
    expect(wasProfileUpdated({})).toBe(false)
    expect(wasProfileUpdated(null)).toBe(false)
    expect(wasProfileUpdated(undefined)).toBe(false)
  })
})

describe('buildLocationPatch', () => {
  it('invia sempre latitudine e longitudine insieme', () => {
    expect(buildLocationPatch({ latitude: 44.4949, longitude: 11.3426 })).toEqual({
      latitude: 44.49,
      longitude: 11.34,
    })
  })

  it('arrotonda a 2 decimali (circa 1 km), anche i valori negativi', () => {
    expect(buildLocationPatch({ latitude: -33.8688, longitude: 151.2093 })).toEqual({
      latitude: -33.87,
      longitude: 151.21,
    })
  })
})
