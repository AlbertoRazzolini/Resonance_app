import type { ReactNode } from 'react'
import type { Role } from '@/types/users'

/** Una scheda dell'area personale: `roles` vuoto = per tutti, altrimenti basta uno dei ruoli indicati. */
export type AreaTab = {
  key: string
  title: string
  roles?: Role[]
  element: ReactNode
}

/** Contenuto provvisorio: lo sostituisce la card che porta la scheda (FE-06 eventi, FE-07 post, FE-08 annunci). */
const COMING_SOON = <p className="text-body-secondary">Questa sezione arriva presto.</p>

/**
 * Registro delle schede dei contenuti dell'utente (decisione 77): ogni card successiva sostituisce `element` della
 * propria scheda. L'ordine è quello della pagina. I ruoli servono solo a mostrare o nascondere: l'elenco vero lo
 * restituisce il backend (`/mine`), che non richiede nessun ruolo.
 */
export const AREA_TABS: AreaTab[] = [
  { key: 'concerts', title: 'Concerti', roles: ['HOST'], element: COMING_SOON },
  { key: 'indie-events', title: 'Indie event', roles: ['MUSICIAN'], element: COMING_SOON },
  { key: 'collab', title: 'Annunci', roles: ['MUSICIAN'], element: COMING_SOON },
  { key: 'posts', title: 'Post', element: COMING_SOON },
]
