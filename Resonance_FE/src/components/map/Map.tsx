import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { setWorkerUrl } from 'maplibre-gl'
import MapGL, { Layer, Marker, Popup, Source, NavigationControl, type MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
// Il worker di MapLibre (disegna le tessere) preparato da Vite come file a sé: sotto la CSP `script-src 'self'` un
// worker da `blob:` verrebbe bloccato (decisione 76)
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { circlePolygon } from '@/lib/format/distance'
import './map.css'
import { EventMarker, type EventKind } from './markers'

// MapLibre cerca il worker accanto al proprio file, ma Vite lo raccoglie altrove (sviluppo e build): gli si dice
// dov'è, altrimenti non arrivano le tessere e la mappa resta nera. Progettazione, sezione 4.3.
setWorkerUrl(workerUrl)

/** Stile scuro di OpenFreeMap (decisione 78): si accorda al tema nero e giallo. */
const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark'

/** Evento da mostrare sulla mappa. */
export type MapMarkerData = {
  id: string
  kind: EventKind
  latitude: number
  longitude: number
  /** Titolo dell'evento. */
  label: string
}

export type MapProps = {
  center: { latitude: number; longitude: number }
  /** Se cambia, la mappa si sposta con un'animazione. */
  zoom: number
  markers?: MapMarkerData[]
  /** Marker aperto: mostra il fumetto con `renderPopup`. */
  selectedId?: string | null
  onMarkerClick?: (id: string) => void
  /** Contenuto del fumetto del marker selezionato. */
  renderPopup?: (marker: MapMarkerData) => ReactNode
  onPopupClose?: () => void
  /** Cerchio del raggio di ricerca, centrato su `center`. */
  radiusKm?: number
  /** Descrizione della mappa per i lettori di schermo. */
  label?: string
}

/** Colore d'accento dai token, perché i livelli di MapLibre non leggono le custom properties del CSS. */
function accentColor(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--rs-color-accent').trim() || '#ffd60a'
}

/**
 * Mappa degli eventi su MapLibre GL e OpenFreeMap (decisione 78). Non si importa direttamente: `index.ts` la carica solo
 * quando serve, perché MapLibre pesa circa 250 kB. L'attribuzione resta sempre aperta, come chiede la licenza.
 */
export default function Map({
  center,
  zoom,
  markers = [],
  selectedId = null,
  onMarkerClick,
  renderPopup,
  onPopupClose,
  radiusKm,
  label = 'Mappa',
}: MapProps) {
  const mapRef = useRef<MapRef>(null)
  const [failed, setFailed] = useState(false)
  const accent = useMemo(() => accentColor(), [])
  const circle = useMemo(
    () => (radiusKm === undefined ? null : circlePolygon(center, radiusKm)),
    [center, radiusKm],
  )
  const selected = markers.find((marker) => marker.id === selectedId)

  // Il punto iniziale lo gestisce MapLibre; se poi cambia (nuovo centro o raggio) ci si sposta con un'animazione
  useEffect(() => {
    mapRef.current?.flyTo({ center: [center.longitude, center.latitude], zoom, duration: 800 })
  }, [center.latitude, center.longitude, zoom])

  return (
    <div role="region" aria-label={label} className="rs-map">
      <MapGL
        ref={mapRef}
        initialViewState={{ latitude: center.latitude, longitude: center.longitude, zoom }}
        mapStyle={MAP_STYLE_URL}
        style={{ width: '100%', height: '100%' }}
        attributionControl={{ compact: false }}
        onError={(event) => {
          // Il dettaglio va nella console: l'avviso nella mappa resta generico
          console.error('[Map] errore di MapLibre:', event.error)
          setFailed(true)
        }}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {circle && (
          <Source id="radius" type="geojson" data={circle}>
            <Layer id="radius-fill" type="fill" paint={{ 'fill-color': accent, 'fill-opacity': 0.08 }} />
            <Layer
              id="radius-line"
              type="line"
              paint={{ 'line-color': accent, 'line-width': 1.5, 'line-opacity': 0.7, 'line-dasharray': [2, 2] }}
            />
          </Source>
        )}

        {markers.map((marker) => (
          <Marker key={marker.id} latitude={marker.latitude} longitude={marker.longitude} anchor="center">
            <EventMarker
              kind={marker.kind}
              label={marker.label}
              selected={marker.id === selectedId}
              onSelect={() => onMarkerClick?.(marker.id)}
            />
          </Marker>
        ))}

        {selected && renderPopup && (
          <Popup
            latitude={selected.latitude}
            longitude={selected.longitude}
            anchor="bottom"
            offset={18}
            closeButton
            closeOnClick={false}
            onClose={onPopupClose}
          >
            {renderPopup(selected)}
          </Popup>
        )}
      </MapGL>

      {failed && (
        <div role="alert" className="rs-map__error">
          Parte della mappa non si è caricata. Controlla la connessione.
        </div>
      )}
    </div>
  )
}
