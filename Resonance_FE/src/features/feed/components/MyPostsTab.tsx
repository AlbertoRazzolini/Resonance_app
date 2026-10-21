import { useState } from 'react'
import { Alert } from 'react-bootstrap'
import { Link } from 'react-router'
import { ROUTES } from '@/app/routes'
import { EmptyState } from '@/components/ui/EmptyState'
import { PostPages } from './PostPages'

/**
 * Scheda «Post» dell'area personale (decisione 77, progettazione sezione 6.8): i propri post non nascosti da
 * `GET /api/feed-posts/mine`, dal più recente, con le stesse card del feed (like e «Cancella»). Dopo una cancellazione
 * l'elenco si rilegge (tag `MINE`) e un avviso dice com'è andata.
 */
export function MyPostsTab() {
  const [notice, setNotice] = useState<string | null>(null)
  return (
    <div className="rs-my-posts">
      {notice && (
        <Alert variant="success" role="status">
          {notice}
        </Alert>
      )}
      <PostPages
        source={{ kind: 'mine' }}
        emptyState={
          <EmptyState title="Non hai ancora scritto post.">
            <Link className="btn btn-primary" to={ROUTES.feed}>
              Vai al feed
            </Link>
          </EmptyState>
        }
        onDeleted={() => setNotice('Post cancellato.')}
      />
    </div>
  )
}
