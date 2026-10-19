import { useEffect, useState } from 'react'

/**
 * true finché la media query vale, e si aggiorna quando cambia (finestra ridimensionata, telefono
 * ruotato). Es. useMediaQuery('(min-width: 768px)').
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mediaQuery = window.matchMedia(query)
    const update = () => setMatches(mediaQuery.matches)
    update()
    mediaQuery.addEventListener('change', update)
    return () => mediaQuery.removeEventListener('change', update)
  }, [query])

  return matches
}
