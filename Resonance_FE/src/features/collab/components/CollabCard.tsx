import { Link } from 'react-router'
import { collabPath, userPath } from '@/app/routes'
import { Avatar } from '@/components/ui/Avatar'
import { UserText } from '@/components/ui/UserText'
import { HideContentButton } from '@/features/admin/components/HideContentButton'
import { formatDate } from '@/lib/format/dates'
import type { CollabPostResponse } from '@/types/collab'

/**
 * Annuncio nella bacheca (progettazione, sezione 6.7): autore con il link al profilo, luogo e data, ruolo cercato,
 * titolo, descrizione troncata con CSS, generi, «Nascondi» per gli admin (sezione 5.7) e «Candidati / Scrivi» verso il
 * dettaglio, dove sta il modulo. La
 * bacheca elenca solo annunci aperti, quindi qui non c'è un caso «chiuso». Il testo degli utenti passa dall'escape di React.
 */
export function CollabCard({ post }: { post: CollabPostResponse }) {
  return (
    <article className="rs-collab-card" aria-label={post.title}>
      <header className="rs-post__head">
        <Avatar displayName={post.musician.displayName} avatarUrl={post.musician.avatarUrl} />
        <div className="rs-post__who">
          <Link className="rs-post__author" to={userPath(post.musician.id)}>
            {post.musician.displayName}
          </Link>
          <p className="rs-collab-card__meta">
            {post.location && <span className="rs-collab-card__location">{post.location}</span>}
            <time className="rs-post__date" dateTime={post.createdAt}>
              {formatDate(post.createdAt)}
            </time>
          </p>
        </div>
      </header>

      <p className="rs-collab-card__role">
        <span className="rs-event-card__kind">{post.roleNeeded}</span>
      </p>
      <h2 className="rs-event-card__title">{post.title}</h2>
      <p className="rs-collab-card__description">
        <UserText text={post.description} />
      </p>

      <div className="rs-event-card__bottom">
        <ul className="rs-event-card__tags">
          {post.genreTags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
        <div className="rs-event-card__actions">
          <HideContentButton type="collab-posts" id={post.id} authorId={post.musician.id} name={post.title} />
          <Link className="btn btn-primary btn-sm" to={collabPath(post.id)}>
            Candidati / Scrivi<span className="visually-hidden">: {post.title}</span>
          </Link>
        </div>
      </div>
    </article>
  )
}
