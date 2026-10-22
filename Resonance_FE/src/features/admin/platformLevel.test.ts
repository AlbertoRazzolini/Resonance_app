import { describe, expect, it } from 'vitest'
import { canActOn, platformLevel } from './platformLevel'

// Regola dei livelli di piattaforma (progettazione, sezione 5.6): SUPERADMIN 2, ADMIN 1, solo community 0; si agisce solo
// su un livello inferiore e mai su se stessi.
describe('platformLevel', () => {
  it('dà 2 al SUPERADMIN, 1 all’ADMIN e 0 a chi ha solo ruoli di community', () => {
    expect(platformLevel(['FAN', 'SUPERADMIN'])).toBe(2)
    expect(platformLevel(['FAN', 'ADMIN'])).toBe(1)
    expect(platformLevel(['FAN', 'MUSICIAN', 'HOST'])).toBe(0)
  })

  it('con SUPERADMIN e ADMIN insieme vale il livello più alto', () => {
    expect(platformLevel(['ADMIN', 'SUPERADMIN'])).toBe(2)
  })
})

describe('canActOn', () => {
  const admin = { id: 'a', roles: ['FAN', 'ADMIN'] as const }
  const otherAdmin = { id: 'b', roles: ['FAN', 'ADMIN'] as const }
  const superadmin = { id: 's', roles: ['SUPERADMIN'] as const }
  const fan = { id: 'f', roles: ['FAN'] as const }

  it('un ADMIN agisce su un utente di community', () => {
    expect(canActOn(admin, fan)).toBe(true)
  })

  it('un ADMIN non agisce su un altro ADMIN, su un SUPERADMIN né su se stesso', () => {
    expect(canActOn(admin, otherAdmin)).toBe(false)
    expect(canActOn(admin, superadmin)).toBe(false)
    expect(canActOn(admin, admin)).toBe(false)
  })

  it('un SUPERADMIN agisce su un ADMIN ma non su un altro SUPERADMIN né su se stesso', () => {
    expect(canActOn(superadmin, admin)).toBe(true)
    expect(canActOn(superadmin, { id: 's2', roles: ['SUPERADMIN'] })).toBe(false)
    expect(canActOn(superadmin, superadmin)).toBe(false)
  })

  it('un utente di community non agisce su nessuno', () => {
    expect(canActOn(fan, { id: 'g', roles: ['FAN'] })).toBe(false)
  })
})
