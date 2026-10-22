import type { ModeratedType } from '@/types/admin'

/** Tipo di etichetta di cache dei contenuti pubblici che «Nascondi» e «Ripristina» cambiano. */
type ContentTag = 'Concert' | 'IndieEvent' | 'FeedPost' | 'CollabPost'

/**
 * I quattro tipi moderabili (progettazione, sezione 5.7), nell'ordine delle schede dei contenuti nascosti: il valore di
 * `?scheda=`, il nome della scheda, il segmento dell'URL del backend e l'etichetta di cache degli elenchi pubblici.
 */
export const MODERATED_TYPES: readonly { key: string; title: string; type: ModeratedType; tag: ContentTag }[] = [
  { key: 'concerti', title: 'Concerti', type: 'official-concerts', tag: 'Concert' },
  { key: 'indie', title: 'Indie', type: 'indie-events', tag: 'IndieEvent' },
  { key: 'post', title: 'Post', type: 'feed-posts', tag: 'FeedPost' },
  { key: 'annunci', title: 'Annunci', type: 'collab-posts', tag: 'CollabPost' },
]

/** Il tipo della scheda con questo valore di `?scheda=`, o `undefined` se è assente o sconosciuto. */
export function moderatedTypeFromKey(key: string | null) {
  return MODERATED_TYPES.find((entry) => entry.key === key)
}

/**
 * Cosa si rilegge dopo «Nascondi» o «Ripristina»: il contenuto, l'elenco pubblico, «i miei» dell'autore e l'elenco dei
 * nascosti di quel tipo, così nessuno vede più (o rivede) il contenuto senza ricaricare (decisione 78: niente polling).
 */
export function contentTags(type: ModeratedType, id: string) {
  const { tag } = MODERATED_TYPES.find((entry) => entry.type === type)!
  return [
    { type: tag, id },
    { type: tag, id: 'LIST' },
    { type: tag, id: 'MINE' },
    { type: 'HiddenContent' as const, id: type },
  ]
}
