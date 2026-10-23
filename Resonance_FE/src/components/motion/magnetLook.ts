/**
 * Valori di Magnet nell'applicazione (FE-12, decisione 107), scritti dallo studente: il pulsante reagisce al cursore da
 * 100 px di distanza su entrambi gli assi; la forza 9 divide la distanza per 9 (più è alta, meno si sposta), mentre
 * l'inclinazione di 15° e l'ingrandimento a 1,15 rendono l'effetto visibile; molla con rigidità 200 e smorzamento 18.
 */
export const MAGNET_LOOK = {
  padding: 100,
  axis: 'both',
  magnetStrength: 9,
  tilt: 15,
  scale: 1.15,
  spring: { stiffness: 200, damping: 18 },
} as const
