import { describe, expect, it } from 'vitest'
import { PIXEL_BUDGET, maxPixelRatio } from './pixelBudget'

// Tetto sui pixel dello sfondo animato: sugli schermi grandi la risoluzione scende, su quelli piccoli resta intera.

describe('maxPixelRatio', () => {
  it('su uno schermo molto largo scende sotto 1, per restare nel limite di pixel', () => {
    const ratio = maxPixelRatio(2552, 1300, 2)

    expect(ratio).toBeCloseTo(0.78, 2)
    expect(2552 * 1300 * ratio * ratio).toBeLessThanOrEqual(PIXEL_BUDGET + 1)
  })

  it('su un portatile da 1366x768 non limita un dispositivo con pixel normali (1)', () => {
    expect(maxPixelRatio(1366, 768, 2)).toBeGreaterThan(1)
  })

  it('non supera mai il massimo richiesto', () => {
    expect(maxPixelRatio(320, 568, 1.5)).toBe(1.5)
    expect(maxPixelRatio(1024, 768, 2)).toBeLessThanOrEqual(2)
  })

  it('non scende sotto 0,5, nemmeno su uno schermo enorme', () => {
    expect(maxPixelRatio(7680, 4320, 2)).toBe(0.5)
  })

  it('con una misura nulla usa il massimo richiesto', () => {
    expect(maxPixelRatio(0, 0, 2)).toBe(2)
  })
})
