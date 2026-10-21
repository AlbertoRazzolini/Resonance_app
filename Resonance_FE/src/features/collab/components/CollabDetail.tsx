import { Link } from 'react-router'
import { ROUTES, userPath } from '@/app/routes'
import { UserText } from '@/components/ui/UserText'
import { selectCurrentUser } from '@/features/auth/authSlice'
import { useAppSelector } from '@/hooks/redux'
import { formatDate } from '@/lib/format/dates'
import type { CollabPostResponse } from '@/types/collab'
import { ApplyForm } from './ApplyForm'
import { CollabOwnerActions } from './CollabOwnerActions'

/**
 * Dettaglio di un annuncio collab (progettazione, sezione 6.7), anche se chiuso: in quel caso porta l'indicazione
 * «Chiuso». I testi scritti dall'autore passano da `UserText` (titolo e dati solo dall'escape di React). Sotto: le
 * azioni del proprietario, oppure il modulo di candidatura (annuncio aperto) o l'avviso che è chiuso; in fondo, per tutti,
 * «Torna su Collab» e «Torna alla home».
 */
export function CollabDetail({ post }: { post: CollabPostResponse }) {
  const currentUser = useAppSelector(selectCurrentUser)
  const isOwner = currentUser?.id === post.musician.id

  return (
    <article className="rs-event-detail rs-collab-detail">
      <Link to={ROUTES.collab}>Collab</Link>

      {!post.isOpen && (
        <p className="rs-event-detail__badges">
          <span className="rs-event-card__kind">Chiuso</span>
        </p>
      )}
      <h1>{post.title}</h1>

      <dl className="rs-event-detail__facts">
        <dt>Pubblicato da</dt>
        <dd>
          <Link to={userPath(post.musician.id)}>{post.musician.displayName}</Link>
        </dd>
        <dt>Cercasi</dt>
        <dd>{post.roleNeeded}</dd>
        {post.location && (
          <>
            <dt>Luogo</dt>
            <dd>{post.location}</dd>
          </>
        )}
        <dt>Pubblicato il</dt>
        <dd>
          <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
        </dd>
      </dl>

      {post.genreTags.length > 0 && (
        <ul className="rs-event-card__tags">
          {post.genreTags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      )}

      <div className="rs-event-detail__description">
        <UserText text={post.description} />
      </div>
      {isOwner && <CollabOwnerActions post={post} />}
      {/* Non ci si candida al proprio annuncio né a uno chiuso (la protezione vera è nel backend: 400 e 409) */}
      {!isOwner && post.isOpen && <ApplyForm post={post} />}
      {!isOwner && !post.isOpen && <p>L'annuncio è chiuso e non accetta più candidature.</p>}

      {/* Per tutti: dopo la pubblicazione si arriva qui, e questi pulsanti dicono che la creazione è finita */}
      <div className="rs-my-event__actions">
        <Link className="btn btn-outline-light btn-sm" to={ROUTES.collab}>
          Torna su Collab
        </Link>
        <Link className="btn btn-outline-light btn-sm" to={ROUTES.home}>
          Torna alla home
        </Link>
      </div>
    </article>
  )
}
