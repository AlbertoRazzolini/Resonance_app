/**
 * Indirizzo mostrato agli utenti sospesi per i ricorsi (progettazione, sezione 1.4; decisione 83). Il backend non
 * lo espone. Segnaposto: va sostituito con un indirizzo vero prima di una consegna reale.
 */
export const APPEAL_CONTACT = 'ricorsi@resonance.example'

/**
 * Indirizzo per le richieste sui dati personali, mostrato nell'informativa privacy. Segnaposto: va sostituito con un
 * indirizzo vero prima di una consegna reale.
 */
export const PRIVACY_CONTACT = 'privacy@resonance.example'

/**
 * Centro della ricerca degli eventi quando non si conosce la posizione dell'utente: Firenze (piano frontend, decisione
 * 78). Le ricerche vicine vogliono sempre un centro (progettazione, sezione 10.2).
 */
export const DEFAULT_SEARCH_CENTER = { latitude: 43.7696, longitude: 11.2558 }
