import { describe, expect, it } from 'vitest'
import { AUTH_MAGNET_LOOK, LANDING_MAGNET_LOOK, MAGNET_LOOK } from './magnetLook'

// Valori di Magnet scritti dallo studente: attrazione da 100 px, forza 9, inclinazione 15°, ingrandimento 1,15, molla 200/18.
describe('magnetLook', () => {
  it('attrae da 100 px su entrambi gli assi, con forza 9', () => {
    expect(MAGNET_LOOK.padding).toBe(100)
    expect(MAGNET_LOOK.axis).toBe('both')
    expect(MAGNET_LOOK.magnetStrength).toBe(9)
  })

  it('inclina di 15° e ingrandisce a 1,15 quando il cursore è vicino', () => {
    expect(MAGNET_LOOK.tilt).toBe(15)
    expect(MAGNET_LOOK.scale).toBe(1.15)
  })

  it('la molla ha rigidità 200 e smorzamento 18', () => {
    expect(MAGNET_LOOK.spring).toEqual({ stiffness: 200, damping: 18 })
  })

  it('non limita lo spostamento', () => {
    expect('maxOffset' in MAGNET_LOOK).toBe(false)
  })
})

// Sulla landing i pulsanti stanno vicini e il magnete pieno li faceva toccare: forza 30, inclinazione 5°, ingrandimento 1,04.
describe('LANDING_MAGNET_LOOK', () => {
  it('è più leggero: si sposta meno, inclina meno e ingrandisce meno', () => {
    expect(LANDING_MAGNET_LOOK.magnetStrength).toBe(30)
    expect(LANDING_MAGNET_LOOK.tilt).toBe(5)
    expect(LANDING_MAGNET_LOOK.scale).toBe(1.04)
    expect(LANDING_MAGNET_LOOK.magnetStrength).toBeGreaterThan(MAGNET_LOOK.magnetStrength)
    expect(LANDING_MAGNET_LOOK.tilt).toBeLessThan(MAGNET_LOOK.tilt)
    expect(LANDING_MAGNET_LOOK.scale).toBeLessThan(MAGNET_LOOK.scale)
  })

  it('tiene uguali distanza di attrazione, assi e molla', () => {
    expect(LANDING_MAGNET_LOOK.padding).toBe(MAGNET_LOOK.padding)
    expect(LANDING_MAGNET_LOOK.axis).toBe(MAGNET_LOOK.axis)
    expect(LANDING_MAGNET_LOOK.spring).toEqual(MAGNET_LOOK.spring)
  })
})

// Le card di autenticazione sono strette: il pulsante a tutta larghezza usciva dai bordi della card (segnalato dallo
// studente il 24 ottobre, forza alzata e ingrandimento abbassato di nuovo lo stesso giorno). Stessa inclinazione di
// MAGNET_LOOK, si sposta meno e ingrandisce meno.
describe('AUTH_MAGNET_LOOK', () => {
  it('si sposta meno di MAGNET_LOOK, con la stessa inclinazione e un ingrandimento minore', () => {
    expect(AUTH_MAGNET_LOOK.magnetStrength).toBe(24)
    expect(AUTH_MAGNET_LOOK.magnetStrength).toBeGreaterThan(MAGNET_LOOK.magnetStrength)
    expect(AUTH_MAGNET_LOOK.tilt).toBe(MAGNET_LOOK.tilt)
    expect(AUTH_MAGNET_LOOK.scale).toBe(1.08)
    expect(AUTH_MAGNET_LOOK.scale).toBeLessThan(MAGNET_LOOK.scale)
  })

  it('tiene uguali distanza di attrazione, assi e molla', () => {
    expect(AUTH_MAGNET_LOOK.padding).toBe(MAGNET_LOOK.padding)
    expect(AUTH_MAGNET_LOOK.axis).toBe(MAGNET_LOOK.axis)
    expect(AUTH_MAGNET_LOOK.spring).toEqual(MAGNET_LOOK.spring)
  })
})
