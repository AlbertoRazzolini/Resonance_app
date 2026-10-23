import { useState } from 'react'
import { Form } from 'react-bootstrap'
import { Link } from 'react-router'
import { chatPath, ROUTES } from '@/app/routes'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Skeleton, SkeletonLine } from '@/components/ui/Skeleton'
import { UserText } from '@/components/ui/UserText'
import { selectCurrentUser } from '@/features/auth/authSlice'
import { useAppSelector } from '@/hooks/redux'
import { formatChatListTime } from '@/lib/format/dates'
import type { ConversationResponse } from '@/types/chat'
import DesktopMagnet from '@/components/motion/DesktopMagnet'
import { useGetConversationsQuery } from '../api/chatApi'
import { filterConversations } from '../chatCache'
import { LockIcon } from './ChatIcons'

type RowProps = { conversation: ConversationResponse; active: boolean; myId: string | undefined }

/**
 * Una conversazione: nome (il collegamento, steso su tutta la riga), ora e ultimo messaggio da `UserText`, numero dei
 * non letti e, se non si può scrivere, «Chat bloccata» con il lucchetto (testo neutro, senza il motivo: decisione 66).
 * Il collegamento sta solo sul nome perché un indirizzo nell'anteprima è un pulsante e non può stare dentro un `<a>`.
 */
function ConversationRow({ conversation, active, myId }: RowProps) {
  const { id, otherUser, lastMessage, lastMessageAt, unreadCount, canSend } = conversation
  const classes = ['rs-conversation', unreadCount > 0 && 'rs-conversation--unread', !canSend && 'rs-conversation--locked']

  return (
    <li className={classes.filter(Boolean).join(' ')}>
      <Avatar displayName={otherUser.displayName} avatarUrl={otherUser.avatarUrl} />
      <div className="rs-conversation__body">
        <div className="rs-conversation__head">
          <Link
            className="rs-conversation__name stretched-link"
            to={chatPath(id)}
            aria-current={active ? 'page' : undefined}
          >
            {otherUser.displayName}
          </Link>
          {lastMessageAt && (
            <time className="rs-conversation__time" dateTime={lastMessageAt}>
              {formatChatListTime(lastMessageAt)}
            </time>
          )}
        </div>
        <div className="rs-conversation__preview">
          <span className="rs-conversation__text">
            {lastMessage ? (
              <>
                {lastMessage.senderId === myId ? 'Tu: ' : ''}
                <UserText text={lastMessage.body} />
              </>
            ) : (
              <em>Nessun messaggio ancora</em>
            )}
          </span>
          {unreadCount > 0 && (
            <>
              <span className="rs-conversation__unread" aria-hidden="true">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
              <span className="visually-hidden">{unreadCount} non letti</span>
            </>
          )}
        </div>
        {!canSend && (
          <span className="rs-conversation__locked">
            <LockIcon /> Chat bloccata
          </span>
        )}
      </div>
    </li>
  )
}

/**
 * Elenco delle conversazioni (progettazione, sezione 6.9), con la ricerca per nome sulle conversazioni già caricate.
 * Una sola chiamata (`size=100`) alimenta anche il badge dei messaggi; `activeId` è la conversazione aperta.
 */
export function ConversationList({ activeId }: { activeId?: string }) {
  const user = useAppSelector(selectCurrentUser)
  const { data, error, isLoading } = useGetConversationsQuery()
  const [query, setQuery] = useState('')
  const shown = data ? filterConversations(data, query) : []

  return (
    <section className="rs-conversations" aria-label="Conversazioni">
      <h1 className="rs-conversations__title">Messaggi</h1>
      <Form.Control
        type="search"
        className="rs-conversations__search"
        aria-label="Cerca nelle conversazioni"
        placeholder="Cerca nelle conversazioni"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {isLoading && (
        <Skeleton>
          {[0, 1, 2].map((row) => (
            <SkeletonLine key={row} width={10} />
          ))}
        </Skeleton>
      )}

      {error && <ErrorAlert error={error} />}

      {data && data.length === 0 && (
        <EmptyState title="Non hai ancora conversazioni.">
          <DesktopMagnet>
            <Link className="btn btn-outline-light" to={ROUTES.userSearch}>
              Cerca persone
            </Link>
          </DesktopMagnet>
        </EmptyState>
      )}

      {data && data.length > 0 && shown.length === 0 && <EmptyState title="Nessuna conversazione trovata." />}

      {shown.length > 0 && (
        <ul className="rs-conversation-list">
          {shown.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              active={conversation.id === activeId}
              myId={user?.id}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
