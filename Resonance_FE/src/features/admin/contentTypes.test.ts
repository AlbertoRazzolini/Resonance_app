import { describe, expect, it } from 'vitest'
import { contentTags, MODERATED_TYPES, moderatedTypeFromKey } from './contentTypes'

// I quattro tipi moderabili (progettazione, sezione 5.7): schede dell'elenco dei nascosti e cosa si rilegge dopo
// «Nascondi» e «Ripristina», perché gli elenchi pubblici non mostrino più (o mostrino di nuovo) il contenuto.
describe('MODERATED_TYPES', () => {
  it('ha i quattro tipi nell’ordine delle schede, con i segmenti dell’URL del backend', () => {
    expect(MODERATED_TYPES.map((entry) => [entry.key, entry.title, entry.type])).toEqual([
      ['concerti', 'Concerti', 'official-concerts'],
      ['indie', 'Indie', 'indie-events'],
      ['post', 'Post', 'feed-posts'],
      ['annunci', 'Annunci', 'collab-posts'],
    ])
  })
})

describe('moderatedTypeFromKey', () => {
  it('trova il tipo dal valore di ?scheda=', () => {
    expect(moderatedTypeFromKey('post')?.type).toBe('feed-posts')
  })

  it('con un valore sconosciuto o assente non trova niente', () => {
    expect(moderatedTypeFromKey('altro')).toBeUndefined()
    expect(moderatedTypeFromKey(null)).toBeUndefined()
  })
})

describe('contentTags', () => {
  it.each([
    ['official-concerts', 'Concert'],
    ['indie-events', 'IndieEvent'],
    ['feed-posts', 'FeedPost'],
    ['collab-posts', 'CollabPost'],
  ] as const)('%s invalida il contenuto, l’elenco pubblico e «i miei» e rilegge i nascosti', (type, tag) => {
    expect(contentTags(type, 'x1')).toEqual([
      { type: tag, id: 'x1' },
      { type: tag, id: 'LIST' },
      { type: tag, id: 'MINE' },
      { type: 'HiddenContent', id: type },
    ])
  })
})
