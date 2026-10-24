import type { EventKind } from './markers'

/**
 * Disegno dell'icona di ogni tipo di evento (viewBox 24x24), condiviso dai segnaposto della mappa vera e dalla mappa
 * di esempio della landing. Due forme diverse, così i tipi si distinguono anche senza vedere il colore (stella e nota).
 */
export const ICON_PATHS: Record<EventKind, string> = {
  official:
    'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  indie: 'M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z',
}
