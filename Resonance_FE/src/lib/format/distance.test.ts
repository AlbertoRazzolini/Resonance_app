import { describe, expect, it } from 'vitest'
import { circlePolygon, formatDistance, zoomForRadius } from './distance'

// Geometria sulla sfera per la mappa: il cerchio del raggio e lo zoom che lo contiene.
const FLORENCE = { latitude: 43.7696, longitude: 11.2558 }

/** Distanza di Haversine in km, scritta qui come oracolo indipendente dal codice provato. */
function haversineKm(a: { latitude: number; longitude: number }, b: [number, number]): number {
  const rad = (deg: number) => (deg * Math.PI) / 180
  const dLat = rad(b[1] - a.latitude)
  const dLng = rad(b[0] - a.longitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

describe('circlePolygon', () => {
  it('disegna un anello chiuso i cui punti stanno tutti al raggio dal centro', () => {
    const polygon = circlePolygon(FLORENCE, 25)
    const ring = polygon.geometry.coordinates[0]

    expect(ring[0]).toEqual(ring[ring.length - 1])
    for (const point of ring) {
      expect(haversineKm(FLORENCE, point as [number, number])).toBeCloseTo(25, 0)
    }
  })

  it('con il raggio più grande l\'anello è più largo', () => {
    const small = circlePolygon(FLORENCE, 5).geometry.coordinates[0]
    const large = circlePolygon(FLORENCE, 100).geometry.coordinates[0]

    expect(large[0][0] - FLORENCE.longitude).toBeGreaterThan(small[0][0] - FLORENCE.longitude)
  })
})

describe('zoomForRadius', () => {
  it('più il raggio è grande, più lo zoom è basso', () => {
    const zooms = [5, 15, 25, 50, 100].map((km) => zoomForRadius(km, FLORENCE.latitude))

    expect(zooms).toEqual([...zooms].sort((a, b) => b - a))
    expect(new Set(zooms).size).toBe(zooms.length)
  })

  it('a 15 km mostra la città e dintorni, a 100 km tutta la regione', () => {
    expect(zoomForRadius(15, FLORENCE.latitude)).toBeGreaterThan(9)
    expect(zoomForRadius(15, FLORENCE.latitude)).toBeLessThan(11)
    expect(zoomForRadius(100, FLORENCE.latitude)).toBeGreaterThan(6)
    expect(zoomForRadius(100, FLORENCE.latitude)).toBeLessThan(8)
  })
})

// Distanza mostrata nelle card, nel fumetto e nel dettaglio: in km con una cifra decimale e la virgola, in metri sotto 1 km.
describe('formatDistance', () => {
  it.each([
    [3.2, '3,2 km'],
    [12.44, '12,4 km'],
    [100, '100,0 km'],
    [1, '1,0 km'],
    [0.8, '800 m'],
    [0.0504, '50 m'],
    [0, '0 m'],
  ])('%s km si scrive "%s"', (km, expected) => {
    expect(formatDistance(km)).toBe(expected)
  })

  it('un valore appena sotto 1 km che si arrotonda a 1000 m diventa "1,0 km"', () => {
    expect(formatDistance(0.9996)).toBe('1,0 km')
  })
})
