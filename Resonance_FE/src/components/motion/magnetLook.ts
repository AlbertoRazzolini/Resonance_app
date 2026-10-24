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

/**
 * Magnete più leggero per la landing (FE-12, decisione 108), su scelta dello studente: i pulsanti stanno vicini e con i
 * valori pieni, e poi con quelli intermedi (forza 14, 8°, 1,08), quello attratto toccava il vicino. Forza 30 (al massimo
 * circa 7 px di spostamento), inclinazione 5°, ingrandimento 1,04; distanza, assi e molla restano quelli di `MAGNET_LOOK`.
 */
export const LANDING_MAGNET_LOOK = {
  ...MAGNET_LOOK,
  magnetStrength: 30,
  tilt: 5,
  scale: 1.04,
} as const

/**
 * Magnete più leggero per le card di autenticazione (registrazione, verifica, accesso, password dimenticata e
 * reset), su segnalazione dello studente il 24 ottobre: la card è stretta e il pulsante a tutta larghezza usciva
 * dai suoi bordi. Forza 24 (quasi il triplo di MAGNET_LOOK, meno spostamento) e ingrandimento 1,08 invece di 1,15
 * (alzata e abbassato di nuovo lo stesso giorno); inclinazione invariata.
 */
export const AUTH_MAGNET_LOOK = {
  ...MAGNET_LOOK,
  magnetStrength: 24,
  scale: 1.08,
} as const
