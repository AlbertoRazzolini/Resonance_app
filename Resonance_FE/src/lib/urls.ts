/**
 * Indirizzo `http` o `https` dal testo dato, altrimenti `null`. Un indirizzo scritto da altri utenti (biglietti, copertine)
 * non si usa mai com'è: `javascript:`, `data:` e ogni altro schema sono rifiutati (progettazione, sezione 4.13).
 */
export function parseHttpUrl(value: string | null | undefined): URL | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

/**
 * Dominio a cui porta l'indirizzo, da mostrare nella conferma d'uscita. `hostname` è quello vero anche quando
 * l'indirizzo ha un utente davanti (`https://banca.it@sito-falso.it` porta a `sito-falso.it`).
 */
export function hostOf(url: URL): string {
  return url.hostname
}
