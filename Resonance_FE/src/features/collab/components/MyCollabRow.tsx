import { Button } from 'react-bootstrap'
import { Link } from 'react-router'
import { collabPath } from '@/app/routes'
import { formatDate } from '@/lib/format/dates'
import type { CollabPostResponse } from '@/types/collab'

type MyCollabRowProps = {
  post: CollabPostResponse
  /** Un'azione è in corso su qualche riga: i pulsanti sono spenti. */
  busy: boolean
  onClose: (post: CollabPostResponse) => void
  onDelete: (post: CollabPostResponse) => void
}

/**
 * Riga compatta di un annuncio dell'utente (decisione 77): data, stato «Aperto» o «Chiuso», titolo, ruolo cercato e le
 * azioni del proprietario. «Chiudi» c'è solo se l'annuncio è aperto (la chiusura non si annulla, decisione 60).
 */
export function MyCollabRow({ post, busy, onClose, onDelete }: MyCollabRowProps) {
  return (
    <article className="rs-my-event" aria-label={post.title}>
      <div className="rs-my-event__main">
        <p className="rs-event-card__meta">
          <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
          <span className="rs-event-card__kind">{post.isOpen ? 'Aperto' : 'Chiuso'}</span>
        </p>
        <h3 className="rs-my-event__title">{post.title}</h3>
        <p className="rs-event-card__venue">{post.roleNeeded}</p>
      </div>
      <div className="rs-my-event__actions">
        <Link className="btn btn-outline-light btn-sm" to={collabPath(post.id)}>
          Apri<span className="visually-hidden">: {post.title}</span>
        </Link>
        {post.isOpen && (
          <Button variant="outline-light" size="sm" disabled={busy} onClick={() => onClose(post)}>
            Chiudi<span className="visually-hidden">: {post.title}</span>
          </Button>
        )}
        <Button variant="outline-light" size="sm" disabled={busy} onClick={() => onDelete(post)}>
          Cancella<span className="visually-hidden">: {post.title}</span>
        </Button>
      </div>
    </article>
  )
}
