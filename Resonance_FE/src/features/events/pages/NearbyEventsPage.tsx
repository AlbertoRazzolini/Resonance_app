import { useState } from 'react'
import { Alert, Button, Nav } from 'react-bootstrap'
import { Link, useSearchParams } from 'react-router'
import { concertPath, indieEventPath } from '@/app/routes'
import { Map, MarkerLegend, type EventKind } from '@/components/map'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadMore } from '@/components/ui/LoadMore'
import { RadiusSelector } from '@/components/ui/RadiusSelector'
import { Skeleton, SkeletonLine } from '@/components/ui/Skeleton'
import {
  DEFAULT_RADIUS_KM,
  parseRadius,
  useSearchCenter,
  type CenterSource,
} from '@/hooks/useSearchCenter'
import { formatDistance, zoomForRadius } from '@/lib/format/distance'
import type { IndieEventResponse, OfficialConcertResponse } from '@/types/events'
import { useGetNearbyConcertsQuery, useGetNearbyIndieEventsQuery } from '../api/eventsApi'
import { EventCard } from '../components/EventCard'

/** Zoom iniziale della mappa: l'Italia intera dall'alto, finché i risultati non arrivano (decisione dello studente, 20 ottobre). */
const ITALY_ZOOM = 5

/** Titolo del blocco, secondo da dove viene il centro della ricerca. */
const SOURCE_TITLES: Record<CenterSource, string> = {
  default: 'Firenze e dintorni',
  profile: 'Vicino al tuo profilo',
  browser: 'Vicino a te',
}

type Item =
  | { kind: 'official'; event: OfficialConcertResponse }
  | { kind: 'indie'; event: IndieEventResponse }

/**
 * Eventi vicini (progettazione, sezioni 6.6 e 10.2), aperti anche a chi non ha la sessione: concerti ufficiali e indie
 * event in due schede, con la mappa accanto all'elenco. Scheda e raggio stanno nell'indirizzo (`?tipo=indie&raggio=25`),
 * così «Indietro» dal dettaglio li ritrova.
 */
export function Component() {
  const [searchParams, setSearchParams] = useSearchParams()
  const kind: EventKind = searchParams.get('tipo') === 'indie' ? 'indie' : 'official'
  const radius = parseRadius(searchParams.get('raggio'))
  const { center, source, positionStatus, requestPosition } = useSearchCenter()

  /** Indirizzo con la scheda e il raggio dati; i valori iniziali non si scrivono. */
  function searchFor(nextKind: EventKind, nextRadius: number) {
    const next = new URLSearchParams()
    if (nextKind === 'indie') next.set('tipo', 'indie')
    if (nextRadius !== DEFAULT_RADIUS_KM) next.set('raggio', String(nextRadius))
    return next
  }

  return (
    <>
      <h1>Eventi vicini</h1>

      {source === 'default' && (
        // `status`, non `alert`: è un'informazione fissa, non un errore da annunciare subito
        <Alert variant="secondary" role="status">
          Stai vedendo gli eventi vicino a Firenze. Usa la tua posizione per vedere quelli più vicini a te.
        </Alert>
      )}
      {source !== 'browser' && (
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          <Button
            variant="outline-light"
            size="sm"
            disabled={positionStatus === 'pending'}
            onClick={() => void requestPosition()}
          >
            {positionStatus === 'pending' ? 'Cerco la posizione…' : 'Usa la mia posizione'}
          </Button>
          {positionStatus === 'denied' && (
            <span role="alert" className="text-danger">
              Permesso negato: abilitalo dalle impostazioni del browser.
            </span>
          )}
          {positionStatus === 'unavailable' && (
            <span role="alert" className="text-danger">
              Non riesco a trovare la tua posizione.
            </span>
          )}
        </div>
      )}

      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
        <Nav as="nav" variant="pills" aria-label="Tipo di evento">
          <Nav.Item>
            <Nav.Link
              as={Link}
              to={{ search: searchFor('official', radius).toString() }}
              replace
              active={kind === 'official'}
            >
              Ufficiali
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link
              as={Link}
              to={{ search: searchFor('indie', radius).toString() }}
              replace
              active={kind === 'indie'}
            >
              Indie
            </Nav.Link>
          </Nav.Item>
        </Nav>
        <RadiusSelector
          value={radius}
          onChange={(next) => setSearchParams(searchFor(kind, next), { replace: true })}
        />
      </div>

      {/* Con una ricerca diversa si riparte dalla prima pagina: cambiando la chiave lo stato dei risultati si azzera */}
      <NearbyResults
        key={`${kind}|${center.latitude},${center.longitude}|${radius}`}
        kind={kind}
        center={center}
        radius={radius}
        title={SOURCE_TITLES[source]}
      />
    </>
  )
}

type NearbyResultsProps = {
  kind: EventKind
  center: { latitude: number; longitude: number }
  radius: number
  title: string
}

/** Risultati di una ricerca (scheda, centro e raggio fissi): conteggio, mappa, elenco a pagine. */
function NearbyResults({ kind, center, radius, title }: NearbyResultsProps) {
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const args = { lat: center.latitude, lng: center.longitude, radiusKm: radius, page }
  // Una sola delle due ricerche è attiva: l'altra resta spenta con `skip`
  const concerts = useGetNearbyConcertsQuery(args, { skip: kind !== 'official' })
  const indie = useGetNearbyIndieEventsQuery(args, { skip: kind !== 'indie' })
  const query = kind === 'official' ? concerts : indie

  const items: Item[] =
    kind === 'official'
      ? (concerts.data?.content ?? []).map((event) => ({ kind: 'official', event }))
      : (indie.data?.content ?? []).map((event) => ({ kind: 'indie', event }))
  const data = query.data
  const hasMore = data !== undefined && data.page + 1 < data.totalPages
  const zoom = query.isSuccess ? zoomForRadius(radius, center.latitude) : ITALY_ZOOM
  const selected = items.find((item) => item.event.id === selectedId)

  return (
    <section aria-label={title}>
      <h2 className="h4">{title}</h2>
      {data && (
        <p className="text-body-secondary">
          {data.totalElements === 1 ? '1 evento' : `${data.totalElements} eventi`} entro {radius} km
        </p>
      )}

      <div className="rs-nearby">
        <div className="rs-nearby__map">
          <MarkerLegend />
          <Map
            center={center}
            zoom={zoom}
            radiusKm={radius}
            label="Mappa degli eventi vicini"
            markers={items.map(({ kind: itemKind, event }) => ({
              id: event.id,
              kind: itemKind,
              latitude: event.latitude,
              longitude: event.longitude,
              label: event.title,
            }))}
            selectedId={selectedId}
            onMarkerClick={setSelectedId}
            onPopupClose={() => setSelectedId(null)}
            renderPopup={() =>
              selected && (
                <div className="rs-map-popup">
                  <strong>{selected.event.title}</strong>
                  {selected.event.distanceKm !== null && <span>{formatDistance(selected.event.distanceKm)}</span>}
                  <Link to={selected.kind === 'official' ? concertPath(selected.event.id) : indieEventPath(selected.event.id)}>
                    Dettagli
                  </Link>
                </div>
              )
            }
          />
        </div>

        <div className="rs-nearby__list">
          {query.isLoading && (
            <Skeleton>
              {[0, 1, 2].map((row) => (
                <div key={row} className="rs-event-card">
                  <SkeletonLine width={4} />
                  <SkeletonLine width={9} />
                  <SkeletonLine width={6} />
                </div>
              ))}
            </Skeleton>
          )}

          {query.isSuccess && items.length === 0 && (
            <EmptyState
              title={`Nessun ${kind === 'official' ? 'evento ufficiale' : 'indie event'} entro ${radius} km`}
              hint="Prova ad allargare il raggio."
            />
          )}

          {items.map((item) =>
            item.kind === 'official' ? (
              <EventCard key={item.event.id} kind="official" event={item.event} highlighted={item.event.id === selectedId} />
            ) : (
              <EventCard key={item.event.id} kind="indie" event={item.event} highlighted={item.event.id === selectedId} />
            ),
          )}

          {query.error && (
            <>
              <ErrorAlert error={query.error} />
              <Button variant="outline-light" size="sm" onClick={() => void query.refetch()}>
                Riprova
              </Button>
            </>
          )}

          <LoadMore hasMore={hasMore} loading={query.isFetching} onClick={() => setPage(page + 1)} />
        </div>
      </div>
    </section>
  )
}
