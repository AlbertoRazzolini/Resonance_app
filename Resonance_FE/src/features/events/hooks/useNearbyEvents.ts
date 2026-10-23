import { useState } from 'react'
import type { EventKind } from '@/components/map'
import type { IndieEventResponse, OfficialConcertResponse } from '@/types/events'
import { useGetNearbyConcertsQuery, useGetNearbyIndieEventsQuery } from '../api/eventsApi'

/** Scheda scelta: tutti gli eventi, solo i concerti ufficiali o solo gli indie event. */
export type EventFilter = 'all' | EventKind

/** Un evento dell'elenco, col tipo accanto: i due DTO hanno campi diversi (host o musicista, biglietto o gratuito). */
export type NearbyItem =
  | { kind: 'official'; event: OfficialConcertResponse }
  | { kind: 'indie'; event: IndieEventResponse }

/** Una ricerca fallita: il tipo che non si è caricato, l'errore e il modo di rifarla. */
export type NearbyError = { kind: EventKind; error: unknown; retry: () => void }

type Search = { lat: number; lng: number; radiusKm: number }

/** Distanza per l'ordinamento: gli eventi senza distanza vanno in fondo. */
const byDistance = (a: NearbyItem, b: NearbyItem) =>
  (a.event.distanceKm ?? Infinity) - (b.event.distanceKm ?? Infinity) || 0

/**
 * Eventi nel raggio (progettazione, sezione 10.2): per «tutti» due ricerche in parallelo, concerti e indie event, unite
 * in un solo elenco dal più vicino; per un tipo solo, l'altra ricerca resta spenta. Ogni tipo ha la sua pagina: «Carica
 * altri» chiede la successiva solo dei tipi che ne hanno ancora. Se un tipo fallisce l'altro resta visibile.
 * Una ricerca diversa (centro, raggio o scheda) richiede un componente nuovo: lo stato delle pagine riparte da zero.
 */
export function useNearbyEvents(filter: EventFilter, { lat, lng, radiusKm }: Search) {
  const [pages, setPages] = useState({ official: 0, indie: 0 })
  const concerts = useGetNearbyConcertsQuery({ lat, lng, radiusKm, page: pages.official }, { skip: filter === 'indie' })
  const indie = useGetNearbyIndieEventsQuery({ lat, lng, radiusKm, page: pages.indie }, { skip: filter === 'official' })

  const active = [
    ...(filter !== 'indie' ? [{ kind: 'official' as const, query: concerts }] : []),
    ...(filter !== 'official' ? [{ kind: 'indie' as const, query: indie }] : []),
  ]
  const hasMoreOf = (kind: EventKind) => {
    const data = (kind === 'official' ? concerts : indie).data
    return data !== undefined && data.page + 1 < data.totalPages
  }

  // `sort` è stabile: a pari distanza restano prima i concerti
  const items: NearbyItem[] = [
    ...(filter !== 'indie' ? (concerts.data?.content ?? []).map((event) => ({ kind: 'official' as const, event })) : []),
    ...(filter !== 'official' ? (indie.data?.content ?? []).map((event) => ({ kind: 'indie' as const, event })) : []),
  ].sort(byDistance)

  return {
    items,
    totalElements: active.reduce((sum, { query }) => sum + (query.data?.totalElements ?? 0), 0),
    hasMore: active.some(({ kind }) => hasMoreOf(kind)),
    isLoading: active.some(({ query }) => query.isLoading),
    isFetching: active.some(({ query }) => query.isFetching),
    /** Vero se almeno una ricerca è riuscita: la mappa si avvicina anche con un solo tipo caricato. */
    isSuccess: active.some(({ query }) => query.isSuccess),
    errors: active.flatMap(({ kind, query }): NearbyError[] =>
      query.error ? [{ kind, error: query.error, retry: () => void query.refetch() }] : [],
    ),
    loadMore: () =>
      setPages((current) => ({
        official: filter !== 'indie' && hasMoreOf('official') ? current.official + 1 : current.official,
        indie: filter !== 'official' && hasMoreOf('indie') ? current.indie + 1 : current.indie,
      })),
  }
}
