import { api } from '@/lib/api/apiSlice'
import { errorCode } from '@/lib/api/baseQuery'
import type { PageResponse } from '@/types/common'
import type { IndieEventResponse, NearbyParams, OfficialConcertResponse } from '@/types/events'

/**
 * Chiave della cache di una ricerca vicina: endpoint, centro e raggio, non la pagina (le pagine si accodano nella stessa
 * voce). Con una chiave personalizzata RTK Query non aggiunge il nome dell'endpoint: senza, concerti e indie event con
 * lo stesso centro e raggio si scambierebbero i risultati.
 */
const nearbyCacheKey = ({ endpointName, queryArgs }: { endpointName: string; queryArgs: NearbyParams }) =>
  `${endpointName}(${queryArgs.lat},${queryArgs.lng},${queryArgs.radiusKm})`

/** "Carica altri": la pagina nuova si accoda alle precedenti; la pagina 0 (nuova ricerca o ricarica) sostituisce tutto. */
function mergePages<T>(current: PageResponse<T>, incoming: PageResponse<T>) {
  if (incoming.page === 0) return incoming
  current.content.push(...incoming.content)
  current.page = incoming.page
  current.totalPages = incoming.totalPages
  current.totalElements = incoming.totalElements
}

/** Si richiede la pagina solo quando cambia: stessi parametri e stessa pagina restano in cache. */
const pageChanged = ({ currentArg, previousArg }: { currentArg?: NearbyParams; previousArg?: NearbyParams }) =>
  currentArg?.page !== previousArg?.page

/** Vero per un 404 con codice `NOT_FOUND`: evento inesistente, nascosto o bozza di un altro (progettazione, sezione 6.6). */
export function isEventNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const { status, data } = error as { status?: unknown; data?: unknown }
  return status === 404 && errorCode(data) === 'NOT_FOUND'
}

/** Endpoint degli eventi (progettazione, sezione 6.6): ricerche nelle vicinanze, accesso libero, e dettagli. */
export const eventsApi = api.injectEndpoints({
  endpoints: (build) => ({
    /** `GET /api/official-concerts/nearby`: concerti futuri non nascosti, dal più vicino. */
    getNearbyConcerts: build.query<PageResponse<OfficialConcertResponse>, NearbyParams>({
      query: ({ lat, lng, radiusKm, page }) => ({
        url: '/api/official-concerts/nearby',
        params: { lat, lng, radiusKm, page },
      }),
      serializeQueryArgs: nearbyCacheKey,
      merge: mergePages,
      forceRefetch: pageChanged,
      providesTags: (result) => [
        { type: 'Concert', id: 'LIST' },
        ...(result?.content ?? []).map(({ id }) => ({ type: 'Concert' as const, id })),
      ],
    }),

    /** `GET /api/indie-events/nearby`: indie event pubblicati, futuri e non nascosti, dal più vicino. */
    getNearbyIndieEvents: build.query<PageResponse<IndieEventResponse>, NearbyParams>({
      query: ({ lat, lng, radiusKm, page }) => ({
        url: '/api/indie-events/nearby',
        params: { lat, lng, radiusKm, page },
      }),
      serializeQueryArgs: nearbyCacheKey,
      merge: mergePages,
      forceRefetch: pageChanged,
      providesTags: (result) => [
        { type: 'IndieEvent', id: 'LIST' },
        ...(result?.content ?? []).map(({ id }) => ({ type: 'IndieEvent' as const, id })),
      ],
    }),

    /** `GET /api/official-concerts/{id}`: un concerto nascosto dà 404. */
    getConcert: build.query<OfficialConcertResponse, string>({
      query: (id) => `/api/official-concerts/${encodeURIComponent(id)}`,
      providesTags: (_result, _error, id) => [{ type: 'Concert', id }],
    }),

    /** `GET /api/indie-events/{id}`: una bozza è visibile solo al proprietario, per gli altri è 404. */
    getIndieEvent: build.query<IndieEventResponse, string>({
      query: (id) => `/api/indie-events/${encodeURIComponent(id)}`,
      providesTags: (_result, _error, id) => [{ type: 'IndieEvent', id }],
    }),
  }),
})

export const {
  useGetConcertQuery,
  useGetIndieEventQuery,
  useGetNearbyConcertsQuery,
  useGetNearbyIndieEventsQuery,
} = eventsApi
