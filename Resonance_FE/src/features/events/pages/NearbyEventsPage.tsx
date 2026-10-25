import { useState } from 'react'
import { Alert, Button, Nav } from 'react-bootstrap'
import { Link, useSearchParams } from 'react-router'
import DesktopMagnet from '@/components/motion/DesktopMagnet'
import { EVENT_ACTION_MAGNET_LOOK } from '@/components/motion/magnetLook'
import { concertPath, indieEventPath, ROUTES } from '@/app/routes'
import { Map, MarkerLegend, type EventKind } from '@/components/map'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadMore } from '@/components/ui/LoadMore'
import { RadiusSelector } from '@/components/ui/RadiusSelector'
import { Skeleton, SkeletonLine } from '@/components/ui/Skeleton'
import { selectHasRole } from '@/features/auth/authSlice'
import { useAppSelector } from '@/hooks/redux'
import {
  DEFAULT_RADIUS_KM,
  parseRadius,
  useSearchCenter,
  type CenterSource,
} from '@/hooks/useSearchCenter'
import { formatDistance, zoomForRadius } from '@/lib/format/distance'
import { EventCard } from '../components/EventCard'
import { useNearbyEvents, type EventFilter } from '../hooks/useNearbyEvents'

/** Zoom iniziale della mappa: l'Italia intera dall'alto, finché i risultati non arrivano (decisione dello studente, 20 ottobre). */
const ITALY_ZOOM = 5

/** Titolo del blocco, secondo da dove viene il centro della ricerca. */
const SOURCE_TITLES: Record<CenterSource, string> = {
  default: 'Firenze e dintorni',
  profile: 'Vicino al tuo profilo',
  browser: 'Vicino a te',
}

/** Valore di `?tipo=` di ogni scheda; la scheda Eventi, quella iniziale, non scrive niente nell'indirizzo. */
const FILTER_PARAMS: Record<EventKind, string> = { official: 'ufficiali', indie: 'indie' }

/** Nome del tipo nel pulsante «Riprova», che con due errori deve dire a quale ricerca si riferisce. */
const KIND_LABELS: Record<EventKind, string> = { official: 'eventi ufficiali', indie: 'indie event' }

/** Avviso quando un tipo non si è caricato nella scheda Eventi: l'altro tipo resta visibile. */
const KIND_ERRORS: Record<EventKind, string> = {
  official: 'Gli eventi ufficiali non si sono caricati.',
  indie: 'Gli indie event non si sono caricati.',
}

/** Le schede nell'ordine in cui compaiono. */
const FILTER_TABS: { filter: EventFilter; label: string }[] = [
  { filter: 'all', label: 'Eventi' },
  { filter: 'official', label: 'Ufficiali' },
  { filter: 'indie', label: 'Indie' },
]

/** Testo del vuoto di ogni scheda. */
const EMPTY_TITLES: Record<EventFilter, string> = {
  all: 'Nessun evento',
  official: 'Nessun evento ufficiale',
  indie: 'Nessun indie event',
}

/** Scheda scritta nell'indirizzo; un valore sconosciuto apre la scheda Eventi. */
function parseFilter(value: string | null): EventFilter {
  return (Object.keys(FILTER_PARAMS) as EventKind[]).find((kind) => FILTER_PARAMS[kind] === value) ?? 'all'
}

/**
 * Eventi vicini (progettazione, sezioni 6.6 e 10.2), aperti anche a chi non ha la sessione: tre schede, Eventi (concerti
 * ufficiali e indie event insieme, quella iniziale), Ufficiali e Indie, con la mappa accanto all'elenco. Scheda e raggio
 * stanno nell'indirizzo (`?tipo=indie&raggio=25`), così «Indietro» dal dettaglio li ritrova.
 */
export function Component() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filter = parseFilter(searchParams.get('tipo'))
  const radius = parseRadius(searchParams.get('raggio'))
  const { center, source, positionStatus, requestPosition } = useSearchCenter()
  // Solo per mostrare i pulsanti: la protezione vera è nel router e nel backend
  const isHost = useAppSelector(selectHasRole('HOST'))
  const isMusician = useAppSelector(selectHasRole('MUSICIAN'))

  /** Indirizzo con la scheda e il raggio dati; i valori iniziali non si scrivono. */
  function searchFor(nextFilter: EventFilter, nextRadius: number) {
    const next = new URLSearchParams()
    if (nextFilter !== 'all') next.set('tipo', FILTER_PARAMS[nextFilter])
    if (nextRadius !== DEFAULT_RADIUS_KM) next.set('raggio', String(nextRadius))
    return next
  }

  return (
    <>
      <div className="rs-events-head">
        <h1>Eventi vicini</h1>
        {(isHost || isMusician) && (
          <div className="rs-events-head__actions">
            {isHost && (
              <DesktopMagnet look={EVENT_ACTION_MAGNET_LOOK}>
                <Link className="btn btn-primary" to={ROUTES.newConcert}>
                  Pubblica concerto
                </Link>
              </DesktopMagnet>
            )}
            {isMusician && (
              <DesktopMagnet look={EVENT_ACTION_MAGNET_LOOK}>
                <Link className="btn btn-primary" to={ROUTES.newIndieEvent}>
                  Pubblica indie event
                </Link>
              </DesktopMagnet>
            )}
          </div>
        )}
      </div>

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
        <Nav as="nav" variant="pills" className="rs-event-tabs" aria-label="Tipo di evento">
          {FILTER_TABS.map(({ filter: tab, label }) => (
            <Nav.Item key={tab}>
              <DesktopMagnet>
                <Nav.Link
                  as={Link}
                  to={{ search: searchFor(tab, radius).toString() }}
                  replace
                  active={filter === tab}
                  aria-current={filter === tab ? 'page' : undefined}
                >
                  {label}
                </Nav.Link>
              </DesktopMagnet>
            </Nav.Item>
          ))}
        </Nav>
        <RadiusSelector
          value={radius}
          onChange={(next) => setSearchParams(searchFor(filter, next), { replace: true })}
        />
      </div>

      {/* Con una ricerca diversa si riparte dalla prima pagina: cambiando la chiave lo stato dei risultati si azzera */}
      <NearbyResults
        key={`${filter}|${center.latitude},${center.longitude}|${radius}`}
        filter={filter}
        center={center}
        radius={radius}
        title={SOURCE_TITLES[source]}
      />
    </>
  )
}

type NearbyResultsProps = {
  filter: EventFilter
  center: { latitude: number; longitude: number }
  radius: number
  title: string
}

/** Risultati di una ricerca (scheda, centro e raggio fissi): conteggio, mappa, elenco a pagine. */
function NearbyResults({ filter, center, radius, title }: NearbyResultsProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { items, totalElements, hasMore, isLoading, isFetching, isSuccess, errors, loadMore } = useNearbyEvents(filter, {
    lat: center.latitude,
    lng: center.longitude,
    radiusKm: radius,
  })

  // La mappa si avvicina quando le ricerche hanno risposto e almeno una è riuscita
  const zoom = isSuccess && !isLoading ? zoomForRadius(radius, center.latitude) : ITALY_ZOOM
  const selected = items.find((item) => item.event.id === selectedId)
  // Con un tipo non caricato il totale sarebbe sottostimato: il conteggio si mostra solo se è completo
  const complete = isSuccess && !isLoading && errors.length === 0

  return (
    <section aria-label={title}>
      <h2 className="h4">{title}</h2>
      {complete && (
        <p className="text-body-secondary">
          {totalElements === 1 ? '1 evento' : `${totalElements} eventi`} entro {radius} km
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
          {isLoading && (
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

          {/* Gli avvisi stanno sopra le card: con un tipo non caricato l'elenco è lungo e in fondo non si vedrebbero */}
          {errors.map(({ kind, error, retry }) => (
            <div key={kind}>
              {filter === 'all' && <p className="mb-1">{KIND_ERRORS[kind]}</p>}
              <ErrorAlert error={error} />
              <Button
                variant="outline-light"
                size="sm"
                aria-label={filter === 'all' ? `Riprova: ${KIND_LABELS[kind]}` : undefined}
                onClick={retry}
              >
                Riprova
              </Button>
            </div>
          ))}

          {complete && items.length === 0 && (
            <EmptyState title={`${EMPTY_TITLES[filter]} entro ${radius} km`} hint="Prova ad allargare il raggio." />
          )}

          {items.map((item) =>
            item.kind === 'official' ? (
              <EventCard key={item.event.id} kind="official" event={item.event} highlighted={item.event.id === selectedId} />
            ) : (
              <EventCard key={item.event.id} kind="indie" event={item.event} highlighted={item.event.id === selectedId} />
            ),
          )}

          <LoadMore hasMore={hasMore} loading={isFetching} onClick={loadMore} />
        </div>
      </div>
    </section>
  )
}
