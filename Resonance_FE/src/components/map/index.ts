// Unico file barile del progetto (piano frontend, regole della struttura): serve al caricamento differito della mappa.
import { createElement, lazy, Suspense } from 'react'
import type { MapProps } from './Map'

// MapLibre pesa circa 250 kB: si scarica solo quando una pagina mostra davvero una mappa, non su tutte le pagine.
const LazyMap = lazy(() => import('./Map'))

/** Mappa degli eventi, caricata al primo uso. Uso: `<Map center zoom markers onMarkerClick />` da `@/components/map`. */
export function Map(props: MapProps) {
  return createElement(
    Suspense,
    { fallback: createElement('div', { className: 'rs-map rs-map--loading', role: 'status' }, 'Carico la mappa…') },
    createElement(LazyMap, props),
  )
}

export { MarkerLegend, type EventKind } from './markers'
export type { MapMarkerData, MapProps } from './Map'
