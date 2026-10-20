import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'

/**
 * true quando la pagina è scrollata fino in fondo (o non scorre affatto), false altrimenti. Si aggiorna con lo
 * scroll, il ridimensionamento, il cambio di pagina e il cambio di altezza del contenuto (liste che si caricano).
 * `margin` è la tolleranza in pixel dal fondo.
 */
export function useScrolledToBottom(margin = 8): boolean {
  const { pathname } = useLocation()
  const [atBottom, setAtBottom] = useState(true)

  useEffect(() => {
    const update = () => {
      const bottom = window.scrollY + window.innerHeight
      setAtBottom(bottom >= document.documentElement.scrollHeight - margin)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    // jsdom e i browser molto vecchi non hanno ResizeObserver: restano scroll e resize
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update)
    observer?.observe(document.body)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      observer?.disconnect()
    }
  }, [margin, pathname])

  return atBottom
}
