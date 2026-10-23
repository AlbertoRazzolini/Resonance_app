/**
 * Aspetto del bordo animato nell'applicazione (FE-12, decisione 107): giallo dell'accento (`--rs-color-accent`) per la
 * testa della stella e arancione per la coda, scelti sul tema scuro. Durata e coda scelte dallo studente; il raggio è
 * 8 px, come tutti i pulsanti (`--rs-radius-lg`). Il giallo ha un contrasto alto sullo sfondo scuro, quindi si vede
 * anche con una discromatopsia.
 */
export const STAR_BORDER_LOOK = {
  color: '#ffd60a',
  trailColor: '#ff8a00',
  duration: 8,
  direction: 'clockwise',
  stars: 1,
  trailLength: 0.7,
  thickness: 1,
  radius: 8,
  glow: 0.7,
  hover: 'none',
  sparkle: true,
  clickPulse: true,
  theme: 'dark',
} as const

/** Per i pulsanti grandi (Entra): stesso aspetto, giro più lento di 2 secondi (scelta dello studente). */
export const STAR_BORDER_LOOK_LARGE = { ...STAR_BORDER_LOOK, duration: STAR_BORDER_LOOK.duration + 2 } as const
