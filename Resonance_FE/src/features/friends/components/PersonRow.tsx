import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { userPath } from '@/app/routes'
import { Avatar } from '@/components/ui/Avatar'

type PersonRowProps = {
  id: string
  displayName: string
  avatarUrl: string | null
  city?: string | null
  /** Azioni e messaggi della riga (es. `FriendshipButton`): vanno a destra, sul telefono a capo. */
  children?: ReactNode
}

/**
 * Riga di una persona nella ricerca, negli elenchi e nella campanella: foto e nome aprono il profilo pubblico (così si
 * vede chi è prima di accettare), poi la città e le azioni. Il nome viene dal backend e React ne fa l'escape.
 */
export function PersonRow({ id, displayName, avatarUrl, city, children }: PersonRowProps) {
  return (
    <li className="rs-person">
      <Link className="rs-person__avatar" to={userPath(id)} tabIndex={-1} aria-hidden="true">
        <Avatar displayName={displayName} avatarUrl={avatarUrl} />
      </Link>
      <div className="rs-person__who">
        <Link className="rs-person__name" to={userPath(id)}>
          {displayName}
        </Link>
        {city && <p className="rs-person__city">{city}</p>}
      </div>
      {children}
    </li>
  )
}
