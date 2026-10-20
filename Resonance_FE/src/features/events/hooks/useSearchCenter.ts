import { useMemo } from 'react'
import { DEFAULT_SEARCH_CENTER } from '@/config'
import { selectCurrentUser } from '@/features/auth/authSlice'
import { useAppSelector } from '@/hooks/redux'
import { useBrowserPosition } from '@/hooks/useBrowserPosition'

/** Livelli del raggio di ricerca in km (decisione 78): pochi valori, così ognuno resta in cache. */
export const RADIUS_LEVELS = [5, 15, 25, 50, 100] as const

/** Raggio iniziale in km. */
export const DEFAULT_RADIUS_KM = 15

/** Da dove viene il centro della ricerca. */
export type CenterSource = 'browser' | 'profile' | 'default'

/** Raggio dal testo dell'indirizzo (`?raggio=25`): solo uno dei livelli, altrimenti quello iniziale. */
export function parseRadius(value: string | null): number {
  return RADIUS_LEVELS.find((level) => String(level) === value) ?? DEFAULT_RADIUS_KM
}

/**
 * Centro della ricerca degli eventi: la posizione del browser, ma solo dopo che l'utente la ha chiesta con il pulsante
 * (decisione 30); altrimenti le coordinate del profilo; altrimenti Firenze. La posizione del browser resta nella
 * pagina: uscendo si perde, e il browser la rida subito dalla sua cache.
 */
export function useSearchCenter() {
  const user = useAppSelector(selectCurrentUser)
  const { status, position, request } = useBrowserPosition()

  const profileLatitude = user?.latitude ?? null
  const profileLongitude = user?.longitude ?? null

  const { center, source } = useMemo<{ center: typeof DEFAULT_SEARCH_CENTER; source: CenterSource }>(() => {
    if (position) return { center: position, source: 'browser' }
    if (profileLatitude !== null && profileLongitude !== null) {
      return { center: { latitude: profileLatitude, longitude: profileLongitude }, source: 'profile' }
    }
    return { center: DEFAULT_SEARCH_CENTER, source: 'default' }
  }, [position, profileLatitude, profileLongitude])

  return { center, source, positionStatus: status, requestPosition: request }
}
