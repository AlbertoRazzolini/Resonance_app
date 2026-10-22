import { api } from '@/lib/api/apiSlice'
import { errorCode } from '@/lib/api/baseQuery'
import type { PageResponse } from '@/types/common'
import type {
  ContactResponse,
  CreateConcertRequest,
  CreateIndieEventRequest,
  IndieEventResponse,
  NearbyParams,
  OfficialConcertResponse,
} from '@/types/events'

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

/** Argomenti del contatto dell'organizzatore: l'evento e il messaggio (1–1800 caratteri). */
export type ContactArgs = { id: string; message: string }

/** Argomenti di una cancellazione: l'evento e il motivo facoltativo (massimo 500 caratteri). */
export type DeleteEventArgs = { id: string; reason?: string }

/** Vero per un 404 con codice `NOT_FOUND`: evento inesistente, nascosto o bozza di un altro (progettazione, sezione 6.6). */
export function isEventNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const { status, data } = error as { status?: unknown; data?: unknown }
  return status === 404 && errorCode(data) === 'NOT_FOUND'
}

/** `DELETE` del proprietario (progettazione, sezione 5.7): il motivo facoltativo va nel body solo se c'è. */
const deleteQuery = (basePath: string) => ({ id, reason }: DeleteEventArgs) => ({
  url: `${basePath}/${encodeURIComponent(id)}`,
  method: 'DELETE',
  ...(reason && { body: { reason } }),
})

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

    /**
     * `POST /api/official-concerts` (solo HOST): geocodifica l'indirizzo e può metterci fino a circa 15 s. Un concerto
     * nuovo cambia gli elenchi vicini e `/mine`.
     */
    createConcert: build.mutation<OfficialConcertResponse, CreateConcertRequest>({
      query: (body) => ({ url: '/api/official-concerts', method: 'POST', body }),
      invalidatesTags: [
        { type: 'Concert', id: 'LIST' },
        { type: 'Concert', id: 'MINE' },
      ],
    }),

    /**
     * `POST /api/indie-events` (solo MUSICIAN): con `status` `DRAFT` crea una bozza, con `PUBLISHED` pubblica; la
     * geocodifica è la stessa dei concerti. Cambia gli elenchi vicini e `/mine`.
     */
    createIndieEvent: build.mutation<IndieEventResponse, CreateIndieEventRequest>({
      query: (body) => ({ url: '/api/indie-events', method: 'POST', body }),
      invalidatesTags: [
        { type: 'IndieEvent', id: 'LIST' },
        { type: 'IndieEvent', id: 'MINE' },
      ],
    }),

    /** `GET /api/official-concerts/mine`: i miei concerti, passati compresi, dal più recente (decisione 77). Una pagina per voce di cache. */
    getMyConcerts: build.query<PageResponse<OfficialConcertResponse>, number>({
      query: (page) => ({ url: '/api/official-concerts/mine', params: { page } }),
      providesTags: (result) => [
        { type: 'Concert', id: 'MINE' },
        ...(result?.content ?? []).map(({ id }) => ({ type: 'Concert' as const, id })),
      ],
    }),

    /** `GET /api/indie-events/mine`: le mie bozze e i miei pubblicati, dal più recente (decisione 77). */
    getMyIndieEvents: build.query<PageResponse<IndieEventResponse>, number>({
      query: (page) => ({ url: '/api/indie-events/mine', params: { page } }),
      providesTags: (result) => [
        { type: 'IndieEvent', id: 'MINE' },
        ...(result?.content ?? []).map(({ id }) => ({ type: 'IndieEvent' as const, id })),
      ],
    }),

    /** `PATCH /api/indie-events/{id}/publish`: pubblica una bozza (400 `EVENT_DATE_PAST`, 409 `EVENT_ALREADY_PUBLISHED`). */
    publishIndieEvent: build.mutation<IndieEventResponse, string>({
      query: (id) => ({ url: `/api/indie-events/${encodeURIComponent(id)}/publish`, method: 'PATCH' }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'IndieEvent', id },
        { type: 'IndieEvent', id: 'LIST' },
        { type: 'IndieEvent', id: 'MINE' },
      ],
    }),

    /**
     * `POST /api/official-concerts/{id}/contact` (201): il messaggio diventa un messaggio in chat con l'organizzatore e
     * sblocca la conversazione fino all'inizio del concerto (decisione 69). 409 `EVENT_CLOSED`, 400 `CANNOT_CONTACT_OWN_EVENT`.
     */
    contactConcertHost: build.mutation<ContactResponse, ContactArgs>({
      query: ({ id, message }) => ({
        url: `/api/official-concerts/${encodeURIComponent(id)}/contact`,
        method: 'POST',
        body: { message },
      }),
      invalidatesTags: ['Chat'],
    }),

    /** `POST /api/indie-events/{id}/contact` (201): come per i concerti, verso il musicista che ha pubblicato l'evento. */
    contactIndieEventMusician: build.mutation<ContactResponse, ContactArgs>({
      query: ({ id, message }) => ({
        url: `/api/indie-events/${encodeURIComponent(id)}/contact`,
        method: 'POST',
        body: { message },
      }),
      invalidatesTags: ['Chat'],
    }),

    /** `DELETE /api/official-concerts/{id}` (204): cancellazione del proprietario, con motivo facoltativo. */
    deleteConcert: build.mutation<void, DeleteEventArgs>({
      query: deleteQuery('/api/official-concerts'),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Concert', id },
        { type: 'Concert', id: 'LIST' },
        { type: 'Concert', id: 'MINE' },
      ],
    }),

    /** `DELETE /api/indie-events/{id}` (204): cancellazione del proprietario, con motivo facoltativo. */
    deleteIndieEvent: build.mutation<void, DeleteEventArgs>({
      query: deleteQuery('/api/indie-events'),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'IndieEvent', id },
        { type: 'IndieEvent', id: 'LIST' },
        { type: 'IndieEvent', id: 'MINE' },
      ],
    }),
  }),
})

export const {
  useContactConcertHostMutation,
  useContactIndieEventMusicianMutation,
  useCreateConcertMutation,
  useCreateIndieEventMutation,
  useDeleteConcertMutation,
  useDeleteIndieEventMutation,
  useGetConcertQuery,
  useGetIndieEventQuery,
  useGetMyConcertsQuery,
  useGetMyIndieEventsQuery,
  useGetNearbyConcertsQuery,
  useGetNearbyIndieEventsQuery,
  usePublishIndieEventMutation,
} = eventsApi
