/** Raggio medio della Terra in km: lo stesso della formula di Haversine del backend (progettazione, sezione 10.3). */
const EARTH_RADIUS_KM = 6371

/** Metri per pixel a zoom 0 all'equatore, nelle tessere da 512 px di MapLibre. */
const METERS_PER_PIXEL_AT_ZOOM_0 = 78271.517

/** Metà lato, in pixel, dello spazio in cui deve entrare il cerchio del raggio (un telefono è largo circa 350). */
const FIT_HALF_EXTENT_PX = 150

type Point = { latitude: number; longitude: number }

/**
 * Poligono GeoJSON che approssima un cerchio sulla superficie terrestre (64 lati bastano a sembrare rotondo). Un grado
 * di longitudine si accorcia allontanandosi dall'equatore: per questo si divide per il coseno della latitudine.
 */
export function circlePolygon(center: Point, radiusKm: number, sides = 64) {
  const dLat = (radiusKm / EARTH_RADIUS_KM) * (180 / Math.PI)
  const dLng = dLat / Math.cos((center.latitude * Math.PI) / 180)
  const ring = Array.from({ length: sides + 1 }, (_, i) => {
    const angle = (i / sides) * 2 * Math.PI
    return [center.longitude + dLng * Math.cos(angle), center.latitude + dLat * Math.sin(angle)]
  })
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Polygon' as const, coordinates: [ring] },
  }
}

/** Zoom con cui un cerchio di raggio `radiusKm` entra nello spazio della mappa a quella latitudine. */
export function zoomForRadius(radiusKm: number, latitude: number): number {
  const metersPerPixel = (radiusKm * 1000) / FIT_HALF_EXTENT_PX
  const cosLatitude = Math.cos((latitude * Math.PI) / 180)
  return Math.log2((METERS_PER_PIXEL_AT_ZOOM_0 * cosLatitude) / metersPerPixel)
}

const KM = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** Distanza da mostrare: in km con una cifra decimale e la virgola ("3,2 km"), in metri sotto il chilometro ("800 m"). */
export function formatDistance(km: number): string {
  const meters = Math.round(km * 1000)
  return meters < 1000 ? `${meters} m` : `${KM.format(km)} km`
}
