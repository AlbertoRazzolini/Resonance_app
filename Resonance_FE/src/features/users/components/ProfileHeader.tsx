import type { ReactNode } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { UserText } from '@/components/ui/UserText'
import { ROLE_LABELS, type Role } from '@/types/users'

type ProfileHeaderProps = {
  displayName: string
  avatarUrl: string | null
  city: string | null
  bio: string | null
  roles: Role[]
  /** Pulsante dell'amicizia, subito sotto nome e città e sopra la bio (solo sul profilo di un altro utente). */
  friendship?: ReactNode
  /** Azioni sotto la bio (per il proprio profilo «Modifica profilo»). */
  children?: ReactNode
}

/**
 * Scheda di un profilo, uguale per il proprio e per quello pubblico: foto, nome, ruoli, città e bio. La bio è testo
 * passa da `UserText` (testo di React, mai HTML; gli indirizzi `http`/`https` hanno la conferma d'uscita).
 */
export function ProfileHeader({ displayName, avatarUrl, city, bio, roles, friendship, children }: ProfileHeaderProps) {
  return (
    <section className="rs-profile" aria-label="Profilo">
      <div className="rs-profile__head">
        <Avatar displayName={displayName} avatarUrl={avatarUrl} size="lg" />
        <div className="rs-profile__identity">
          <h1 className="rs-profile__name">{displayName}</h1>
          <ul className="rs-profile__roles" aria-label="Ruoli">
            {roles.map((role) => (
              <li key={role} className="badge rs-profile__role">
                {ROLE_LABELS[role]}
              </li>
            ))}
          </ul>
          {city && (
            <p className="rs-profile__city" data-testid="profile-city">
              {city}
            </p>
          )}
        </div>
      </div>
      {friendship}
      {bio && (
        <p className="rs-profile__bio" data-testid="profile-bio">
          <UserText text={bio} />
        </p>
      )}
      {children}
    </section>
  )
}
