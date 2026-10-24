/** Pixel che lo sfondo animato può calcolare a ogni fotogramma: circa 2 milioni (sotto, nessun intoppo misurato). */
export const PIXEL_BUDGET = 2_000_000

/** La risoluzione non scende mai sotto metà: più in basso gli anelli sarebbero troppo sfocati. */
const MIN_RATIO = 0.5

/**
 * Risoluzione massima dello sfondo animato per una finestra di quelle dimensioni (CSS px): quella che tiene i pixel
 * calcolati entro `PIXEL_BUDGET`, mai sopra `ceiling`. Gli schermi grandi scendono (2552x1300 → circa 0,78), i piccoli
 * non cambiano: un dispositivo con pixel normali (1) resta intero finché il tetto è sopra 1.
 */
export function maxPixelRatio(width: number, height: number, ceiling: number): number {
  const area = width * height
  if (area <= 0) return ceiling
  return Math.max(MIN_RATIO, Math.min(ceiling, Math.sqrt(PIXEL_BUDGET / area)))
}
