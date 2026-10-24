import { Suspense, lazy, useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { useMediaQuery } from '@/hooks/useMediaQuery'

// Caricato solo da desktop: telefono e tablet non pagano il peso degli anelli (decisione 108)
const MagicRings = lazy(() => import('@/components/motion/MagicRings'))

const DESKTOP = '(min-width: 1200px)'
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

/**
 * Anelli della landing dietro alle pagine dell'app, da 1200 px: fermi (disegnati una volta), con un'onda al cambio
 * di pagina. Stessi colori e forma della landing, tetto di 1,5 sui pixel per non pesare dietro a liste e mappa.
 */
export function AppRings() {
  const desktop = useMediaQuery(DESKTOP)
  const reducedMotion = useMediaQuery(REDUCED_MOTION)
  const { pathname } = useLocation()
  const burst = useRef<(() => void) | null>(null)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (!reducedMotion) burst.current?.()
  }, [pathname, reducedMotion])

  if (!desktop) return null

  return (
    <div className="rs-app-rings" aria-hidden="true">
      <Suspense fallback={null}>
        <MagicRings
          color="#ffd60a"
          colorTwo="#ff8a00"
          motion="breathe"
          ringCount={5}
          speed={0}
          lineThickness={1.5}
          glow={0.85}
          hoverScale={1.2}
          clickBurst={false}
          burstRef={burst}
          baseRadius={0.35}
          radiusStep={0.11}
          expansion={0.17}
          taper={1.25}
          opacity={0.45}
          followMouse={false}
          parallax={0}
          intro={false}
          maxDevicePixelRatio={1.5}
        />
      </Suspense>
    </div>
  )
}
