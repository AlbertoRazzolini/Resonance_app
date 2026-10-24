import { Suspense, lazy, useEffect, useState, type RefObject } from 'react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { maxPixelRatio } from '../pixelBudget'

// Caricato solo sulla landing: il resto dell'app non paga il peso degli anelli (decisione 108)
const MagicRings = lazy(() => import('@/components/motion/MagicRings'))

/** Da tablet (768 px) gli anelli si muovono; sotto restano fermi, disegnati una volta sola. */
const TABLET = '(min-width: 768px)'
const DESKTOP = '(min-width: 1200px)'
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

/** Dimensioni della finestra, aggiornate al ridimensionamento. */
function useWindowSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight })
  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return size
}

/**
 * Sfondo animato della landing: anelli gialli e arancio (WebGL2, componente MagicRings) dietro alla pagina. Da tablet in
 * su si muovono, sul telefono e con «riduci animazioni» restano fermi. La risoluzione ha un tetto sui pixel totali, così
 * gli schermi grandi non pesano (progettazione, sezione sulla landing). `burstRef` riceve la funzione che fa partire
 * l'onda: la landing la chiama a ogni scatto di scroll, il clic non ne fa partire.
 */
export function LandingRings({ burstRef }: { burstRef: RefObject<(() => void) | null> }) {
  const tablet = useMediaQuery(TABLET)
  const desktop = useMediaQuery(DESKTOP)
  const reducedMotion = useMediaQuery(REDUCED_MOTION)
  const { width, height } = useWindowSize()
  const moving = tablet && !reducedMotion

  return (
    <div className="rs-landing__rings" aria-hidden="true">
      <Suspense fallback={null}>
        <MagicRings
          key={moving ? 'moving' : 'still'}
          color="#ffd60a"
          colorTwo="#ff8a00"
          motion="breathe"
          ringCount={5}
          speed={moving ? 0.35 : 0}
          lineThickness={1.5}
          glow={0.85}
          hoverScale={1.2}
          clickBurst={false}
          burstRef={burstRef}
          baseRadius={0.35}
          radiusStep={0.11}
          expansion={0.17}
          taper={1.25}
          opacity={0.45}
          followMouse={false}
          parallax={0.05}
          intro={moving}
          maxDevicePixelRatio={maxPixelRatio(width, height, desktop ? 2 : 1.5)}
        />
      </Suspense>
    </div>
  )
}
