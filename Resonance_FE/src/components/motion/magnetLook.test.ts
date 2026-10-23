import { describe, expect, it } from 'vitest'
import { MAGNET_LOOK } from './magnetLook'

// Valori di Magnet scritti dallo studente: attrazione da 100 px, forza 9, inclinazione 15°, ingrandimento 1,15, molla 200/18.
describe('magnetLook', () => {
  it('attrae da 100 px su entrambi gli assi, con forza 9', () => {
    expect(MAGNET_LOOK.padding).toBe(100)
    expect(MAGNET_LOOK.axis).toBe('both')
    expect(MAGNET_LOOK.magnetStrength).toBe(9)
  })

  it("inclina di 15° e ingrandisce a 1,15 quando il cursore è vicino", () => {
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
