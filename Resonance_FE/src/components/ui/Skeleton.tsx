import { useEffect, useState, type ReactNode } from 'react'
import { Placeholder } from 'react-bootstrap'

/** Attesa prima di mostrare lo scheletro: un caricamento più veloce non lo fa nemmeno comparire (niente lampi). */
const SHOW_DELAY_MS = 200

/**
 * Scheletro di caricamento: mostra `children` (le forme del contenuto in arrivo, di solito `SkeletonLine`) solo dopo
 * 200 ms. Per i lettori di schermo è una regione occupata con il testo "Caricamento in corso". L'animazione si ferma da
 * sola con `prefers-reduced-motion` (regola globale in `index.css`).
 */
export function Skeleton({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null
  return (
    <div role="status" aria-busy="true">
      <span className="visually-hidden">Caricamento in corso</span>
      <div aria-hidden="true">{children}</div>
    </div>
  )
}

/** Una riga dello scheletro; `width` è la larghezza in colonne di Bootstrap (da 1 a 12). */
export function SkeletonLine({ width = 12 }: { width?: number }) {
  return (
    <Placeholder as="p" animation="glow" className="mb-2">
      <Placeholder xs={width} />
    </Placeholder>
  )
}
