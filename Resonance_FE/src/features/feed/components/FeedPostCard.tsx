import { useState } from 'react'
import { Button } from 'react-bootstrap'
import { Link, useLocation, useNavigate } from 'react-router'
import { ROUTES, userPath } from '@/app/routes'
import type { LoginRedirectState } from '@/components/guards/RequireAuth'
import { Avatar } from '@/components/ui/Avatar'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { UserText } from '@/components/ui/UserText'
import { HideContentButton } from '@/features/admin/components/HideContentButton'
import { selectCurrentUser } from '@/features/auth/authSlice'
import { useAppSelector } from '@/hooks/redux'
import { formatDate } from '@/lib/format/dates'
import { formatDistance } from '@/lib/format/distance'
import { parseHttpUrl } from '@/lib/urls'
import type { FeedPostResponse } from '@/types/feed'
import { useDeletePostMutation, useLikePostMutation } from '../api/feedApi'

type FeedPostCardProps = {
  post: FeedPostResponse
  /** Il post è stato cancellato: chi lo mostra scrive l'avviso («Post cancellato.»). */
  onDeleted?: () => void
}

/** Immagine del post: solo se l'indirizzo è http/https, senza `Referer`, e sparisce senza lasciare un buco se non si carica. */
function PostImage({ imageUrl }: { imageUrl: string | null }) {
  // Si ricorda l'indirizzo che ha fallito, non un booleano: un indirizzo nuovo riprova da solo
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const url = parseHttpUrl(imageUrl)
  if (!url || imageUrl === failedUrl) return null

  return (
    <img
      className="rs-post__image"
      src={url.href}
      alt="Immagine allegata al post"
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailedUrl(imageUrl)}
    />
  )
}

/**
 * Un post del feed (progettazione, sezione 6.8), uguale nel feed e nella scheda «Post»: autore con il link al profilo,
 * data breve, distanza se il feed è filtrato, testo da `UserText`, immagine, «Mi piace», «Nascondi» per gli admin (sezione
 * 5.7) e, solo sui propri post, «Cancella» con conferma senza motivo. Un anonimo che clicca «Mi piace» va all'accesso e poi torna qui. Il like è
 * ottimistico (lo stato sta nella cache di RTK Query, vedi `likePost`); con un errore l'avviso resta sotto il post.
 */
export function FeedPostCard({ post, onDeleted }: FeedPostCardProps) {
  const user = useAppSelector(selectCurrentUser)
  const navigate = useNavigate()
  const { pathname, search, hash } = useLocation()
  const [likePost, liking] = useLikePostMutation()
  const [deletePost, deleting] = useDeletePostMutation()
  const [confirming, setConfirming] = useState(false)
  const [actionError, setActionError] = useState<unknown>(null)
  const isOwner = user?.id === post.author.id

  async function handleLike() {
    if (!user) {
      const state: LoginRedirectState = { from: pathname + search + hash, loginRequired: true }
      navigate(ROUTES.login, { state })
      return
    }
    setActionError(null)
    try {
      await likePost({ id: post.id, liked: !post.likedByMe }).unwrap()
    } catch (error) {
      setActionError(error)
    }
  }

  async function handleDelete() {
    setActionError(null)
    try {
      await deletePost(post.id).unwrap()
      onDeleted?.()
    } catch (error) {
      setActionError(error)
    }
    setConfirming(false)
  }

  return (
    <article className="rs-post" aria-label={`Post di ${post.author.displayName}`}>
      <header className="rs-post__head">
        <Avatar displayName={post.author.displayName} avatarUrl={post.author.avatarUrl} />
        <div className="rs-post__who">
          <Link className="rs-post__author" to={userPath(post.author.id)}>
            {post.author.displayName}
          </Link>
          <time className="rs-post__date" dateTime={post.createdAt}>
            {formatDate(post.createdAt)}
          </time>
        </div>
        {post.distanceKm !== null && <span className="rs-event-card__distance">{formatDistance(post.distanceKm)}</span>}
      </header>

      <p className="rs-post__body">
        <UserText text={post.body} />
      </p>
      <PostImage imageUrl={post.imageUrl} />

      <div className="rs-post__actions">
        <Button
          variant="outline-light"
          size="sm"
          className={`rs-post__like${post.likedByMe ? ' rs-post__like--on' : ''}`}
          disabled={liking.isLoading}
          aria-label={post.likedByMe ? 'Togli il mi piace' : 'Mi piace'}
          onClick={() => void handleLike()}
        >
          <span aria-hidden="true">{post.likedByMe ? '♥' : '♡'}</span> <span>{post.likesCount}</span>
        </Button>
        {isOwner && (
          <Button variant="outline-light" size="sm" disabled={deleting.isLoading} onClick={() => setConfirming(true)}>
            Cancella<span className="visually-hidden"> il post</span>
          </Button>
        )}
        <HideContentButton type="feed-posts" id={post.id} authorId={post.author.id} name={`post di ${post.author.displayName}`} />
      </div>
      <ErrorAlert error={actionError} />

      <ConfirmDialog
        show={confirming}
        title="Cancellare il post?"
        body="Il post non sarà più visibile a nessuno. L'operazione non si può annullare."
        confirmLabel="Cancella post"
        busy={deleting.isLoading}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirming(false)}
      />
    </article>
  )
}
