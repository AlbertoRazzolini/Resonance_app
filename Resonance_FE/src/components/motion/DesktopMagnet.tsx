import type { ReactNode } from 'react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import Magnet from './Magnet'
import { MAGNET_LOOK } from './magnetLook'

/**
 * Effetto magnete solo dove c'è un mouse vero (`hover: hover` e `pointer: fine`): sul telefono e sul tablet col dito il
 * pulsante resta com'è, senza involucro (FE-12, decisione 107). Valori di `magnetLook.ts` (dati dallo studente).
 * `fullWidth` serve ai pulsanti dei moduli a tutta larghezza: senza, l'involucro si restringerebbe al contenuto.
 */
export default function DesktopMagnet({ children, fullWidth = false }: { children: ReactNode; fullWidth?: boolean }) {
  const hasMouse = useMediaQuery('(hover: hover) and (pointer: fine)')

  if (!hasMouse) return <>{children}</>

  return (
    <Magnet {...MAGNET_LOOK} wrapperClassName="rs-magnet" style={fullWidth ? { display: 'block' } : undefined}>
      {children}
    </Magnet>
  )
}
