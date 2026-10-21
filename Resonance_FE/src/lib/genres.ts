/** Lunghezza massima di un genere e numero massimo di generi: le regole del backend per eventi e annunci. */
export const GENRE_MAX = 30
export const GENRES_MAX = 10

/**
 * Aggiunge un genere alla lista: senza spazi ai bordi e in minuscolo, come il backend. Il vuoto e un genere già presente
 * non cambiano niente; un genere troppo lungo o l'undicesimo tornano con un messaggio.
 */
export function addGenre(tags: string[], raw: string): { tags: string[]; error?: string } {
  const tag = raw.trim().toLowerCase()
  if (!tag || tags.includes(tag)) return { tags }
  if (tag.length > GENRE_MAX) return { tags, error: `Un genere può avere al massimo ${GENRE_MAX} caratteri.` }
  if (tags.length >= GENRES_MAX) return { tags, error: `Puoi indicare al massimo ${GENRES_MAX} generi.` }
  return { tags: [...tags, tag] }
}
