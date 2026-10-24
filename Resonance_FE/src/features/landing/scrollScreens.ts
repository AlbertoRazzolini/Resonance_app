/** Inizio e fine (in pixel dalla cima della pagina) di ogni schermata della landing, nell'ordine del documento. */
export interface ScreenLayout {
  tops: number[]
  bottoms: number[]
}

/** 1 = verso il basso, -1 = verso l'alto. */
export type Direction = 1 | -1

/** Margine (px) entro cui si è «all'inizio di una schermata». */
export const TOLERANCE = 12

const MIN_DURATION_MS = 550
const MAX_DURATION_MS = 950

/** Parte piano, accelera nel mezzo e frena in arrivo: lo scatto fra le schermate. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/** Durata dello scatto: proporzionale alla distanza, ma sempre fra 550 e 950 ms. */
export function durationFor(distance: number): number {
  return Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, distance * 0.8))
}

/** Indice della schermata in cui ci si trova: l'ultima già iniziata (con la tolleranza). */
export function currentScreen({ tops }: ScreenLayout, scrollY: number): number {
  let index = 0
  tops.forEach((top, i) => {
    if (top <= scrollY + TOLERANCE) index = i
  })
  return index
}

/** Inizio della schermata dopo quella corrente, senza condizioni (è ciò che fanno le frecce); null se è l'ultima. */
export function nextScreenTop(layout: ScreenLayout, scrollY: number): number | null {
  const index = currentScreen(layout, scrollY)
  return index + 1 < layout.tops.length ? layout.tops[index + 1] : null
}

/**
 * Dove deve portare un gesto nella direzione data, oppure null se la pagina deve scorrere da sola.
 * In giù: solo quando il fondo della schermata si vede già, altrimenti si scorre per leggerla tutta; l'ultima è libera.
 * In su: dall'inizio di una schermata si va alla precedente (al suo fondo, se è più alta dello schermo); a metà di una
 * schermata che sta nello schermo si torna al suo inizio, a metà di una più alta si scorre da soli.
 */
export function planScroll(
  layout: ScreenLayout,
  scrollY: number,
  viewportHeight: number,
  direction: Direction,
): number | null {
  const { tops, bottoms } = layout
  if (tops.length === 0) return null
  const index = currentScreen(layout, scrollY)

  if (direction === 1) {
    if (index >= tops.length - 1) return null
    if (scrollY + viewportHeight < bottoms[index] - TOLERANCE) return null
    return tops[index + 1]
  }

  if (scrollY > tops[index] + TOLERANCE) {
    const fits = bottoms[index] - tops[index] <= viewportHeight + TOLERANCE
    return fits ? tops[index] : null
  }
  if (index === 0) return null
  return Math.max(tops[index - 1], bottoms[index - 1] - viewportHeight)
}
