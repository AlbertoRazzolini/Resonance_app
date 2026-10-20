import { useCallback, useState } from 'react'

/** Dove si è nella richiesta della posizione: `denied` è il permesso negato, `unavailable` ogni altro motivo. */
export type PositionStatus = 'idle' | 'pending' | 'granted' | 'denied' | 'unavailable'

/** Posizione del browser, in gradi. */
export type BrowserPosition = { latitude: number; longitude: number }

/**
 * Posizione del browser, chiesta solo quando l'utente lo decide con un pulsante (progettazione, decisione 30): senza
 * consenso non parte nessuna richiesta. `request()` risponde con la posizione, o con `null` se il browser non la dà;
 * lo stato dice perché. Non salva niente: dove metterla (profilo, ricerca) lo decide chi la chiama.
 */
export function useBrowserPosition() {
  const [status, setStatus] = useState<PositionStatus>('idle')
  const [position, setPosition] = useState<BrowserPosition | null>(null)

  const request = useCallback((): Promise<BrowserPosition | null> => {
    if (!('geolocation' in navigator)) {
      setStatus('unavailable')
      return Promise.resolve(null)
    }
    setStatus('pending')
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          const found = { latitude: coords.latitude, longitude: coords.longitude }
          setPosition(found)
          setStatus('granted')
          resolve(found)
        },
        (error) => {
          setPosition(null)
          setStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable')
          resolve(null)
        },
        // Una posizione non precisa basta (si arrotonda a circa 1 km) e consuma meno batteria sul telefono
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
      )
    })
  }, [])

  return { status, position, request }
}
