import { useEffect, useState } from 'react'

/** true quando la pagina è scrollata di più di `threshold` pixel dalla cima; si aggiorna con lo scroll. */
export function useScrolledPast(threshold: number): boolean {
  const [past, setPast] = useState(() => window.scrollY > threshold)

  useEffect(() => {
    const update = () => setPast(window.scrollY > threshold)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [threshold])

  return past
}
