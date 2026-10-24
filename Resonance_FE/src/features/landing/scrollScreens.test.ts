import { describe, expect, it } from 'vitest'
import {
  durationFor,
  easeInOutCubic,
  nextScreenTop,
  planScroll,
  type ScreenLayout,
} from './scrollScreens'

// Regole dello scatto fra le schermate della landing: dove porta un gesto, quanto dura e come accelera. Lavorano su
// numeri semplici (inizio e fine di ogni schermata), senza browser.

const VIEWPORT = 800

/** Quattro schermate alte quanto lo schermo: 0-800, 800-1600, 1600-2400, 2400-3200. */
const FITTING: ScreenLayout = {
  tops: [0, 800, 1600, 2400],
  bottoms: [800, 1600, 2400, 3200],
}

/** La prima schermata (0-1200) e la seconda (1200-2400) sono più alte dello schermo da 800. */
const TALL: ScreenLayout = {
  tops: [0, 1200, 2400],
  bottoms: [1200, 2400, 3200],
}

describe('planScroll verso il basso', () => {
  it('dalla prima schermata porta all inizio della seconda', () => {
    expect(planScroll(FITTING, 0, VIEWPORT, 1)).toBe(800)
  })

  it('da una schermata più alta dello schermo lascia scorrere finché il fondo non si vede', () => {
    expect(planScroll(TALL, 0, VIEWPORT, 1)).toBeNull()
    expect(planScroll(TALL, 300, VIEWPORT, 1)).toBeNull()
  })

  it('da una schermata più alta dello schermo scatta quando il fondo si vede', () => {
    // 1200 - 800 = 400: da qui il fondo della prima schermata è a filo con lo schermo
    expect(planScroll(TALL, 400, VIEWPORT, 1)).toBe(1200)
  })

  it("dall'ultima schermata la pagina scorre libera, fino al footer", () => {
    expect(planScroll(FITTING, 2400, VIEWPORT, 1)).toBeNull()
    expect(planScroll(FITTING, 2900, VIEWPORT, 1)).toBeNull()
  })

  it('senza schermate non intercetta nulla', () => {
    expect(planScroll({ tops: [], bottoms: [] }, 0, VIEWPORT, 1)).toBeNull()
  })
})

describe('planScroll verso l alto', () => {
  it("dall'inizio di una schermata porta all'inizio della precedente", () => {
    expect(planScroll(FITTING, 800, VIEWPORT, -1)).toBe(0)
    expect(planScroll(FITTING, 2400, VIEWPORT, -1)).toBe(1600)
  })

  it("un po' prima o dopo l'inizio (tolleranza) conta come l'inizio", () => {
    expect(planScroll(FITTING, 805, VIEWPORT, -1)).toBe(0)
    expect(planScroll(FITTING, 795, VIEWPORT, -1)).toBe(0)
  })

  it("a metà di una schermata che sta nello schermo torna all'inizio di quella schermata", () => {
    expect(planScroll(FITTING, 1000, VIEWPORT, -1)).toBe(800)
  })

  it("dal footer (sotto l'ultima schermata) torna all'inizio dell'ultima", () => {
    expect(planScroll(FITTING, 2450, VIEWPORT, -1)).toBe(2400)
  })

  it('a metà di una schermata più alta dello schermo lascia scorrere', () => {
    expect(planScroll(TALL, 1500, VIEWPORT, -1)).toBeNull()
  })

  it('dall inizio di una schermata porta al fondo della precedente se questa è più alta dello schermo', () => {
    // la prima finisce a 1200: per vederne il fondo con uno schermo da 800 si parte da 400
    expect(planScroll(TALL, 1200, VIEWPORT, -1)).toBe(400)
  })

  it('in cima alla pagina non fa niente', () => {
    expect(planScroll(FITTING, 0, VIEWPORT, -1)).toBeNull()
  })
})

describe('nextScreenTop', () => {
  it('dà l inizio della schermata successiva anche se il fondo della corrente non si vede', () => {
    expect(nextScreenTop(TALL, 0)).toBe(1200)
  })

  it("non c'è una successiva dopo l'ultima", () => {
    expect(nextScreenTop(FITTING, 2400)).toBeNull()
  })
})

describe('easeInOutCubic', () => {
  it('parte da 0, arriva a 1 e non torna indietro', () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
    let previous = 0
    for (let step = 1; step <= 20; step++) {
      const value = easeInOutCubic(step / 20)
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
  })

  it('parte piano, accelera nel mezzo e frena in arrivo', () => {
    expect(easeInOutCubic(0.25)).toBeLessThan(0.25)
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 5)
    expect(easeInOutCubic(0.75)).toBeGreaterThan(0.75)
  })
})

describe('durationFor', () => {
  it('cresce con la distanza ma resta fra 550 e 950 ms', () => {
    expect(durationFor(100)).toBe(550)
    expect(durationFor(800)).toBe(640)
    expect(durationFor(5000)).toBe(950)
  })
})
