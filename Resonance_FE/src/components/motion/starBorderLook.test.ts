import { describe, expect, it } from 'vitest'
import { STAR_BORDER_LOOK, STAR_BORDER_LOOK_LARGE } from './starBorderLook'

// Aspetto del bordo animato: i pulsanti grandi (Entra) fanno il giro 2 secondi più lenti di quelli piccoli (Accedi).
describe('starBorderLook', () => {
  it('i pulsanti piccoli fanno il giro in 8 secondi', () => {
    expect(STAR_BORDER_LOOK.duration).toBe(8)
  })

  it('gli angoli sono a 8 px, come tutti i pulsanti (--rs-radius-lg)', () => {
    expect(STAR_BORDER_LOOK.radius).toBe(8)
  })

  it('i pulsanti grandi sono più lenti di 2 secondi e per il resto uguali', () => {
    expect(STAR_BORDER_LOOK_LARGE.duration).toBe(STAR_BORDER_LOOK.duration + 2)
    expect({ ...STAR_BORDER_LOOK_LARGE, duration: STAR_BORDER_LOOK.duration }).toEqual(STAR_BORDER_LOOK)
  })
})
