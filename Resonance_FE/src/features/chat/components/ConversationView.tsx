import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button } from 'react-bootstrap'
import { Link } from 'react-router'
import { ROUTES, userPath } from '@/app/routes'
import { Avatar } from '@/components/ui/Avatar'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Skeleton, SkeletonLine } from '@/components/ui/Skeleton'
import { UserText } from '@/components/ui/UserText'
import { selectCurrentUser } from '@/features/auth/authSlice'
import { useAppDispatch, useAppSelector } from '@/hooks/redux'
import { formatChatDay, formatClock, isSameDay } from '@/lib/format/dates'
import { subscribe } from '@/lib/stomp/client'
import { QUEUES } from '@/lib/stomp/destinations'
import { useStompStatus } from '@/lib/stomp/useStompStatus'
import type { ChatMessageResponse } from '@/types/chat'
import {
  receiveHistoryMessage,
  useGetConversationsQuery,
  useGetMessagesQuery,
  useLazyGetOlderMessagesQuery,
  useMarkConversationReadMutation,
} from '../api/chatApi'
import { useOutgoingMessages } from '../hooks/useOutgoingMessages'
import { BackIcon, LockIcon, ReadTick, SentTick } from './ChatIcons'
import { MessageComposer } from './MessageComposer'

/** Distanza dal fondo (px) entro cui si considera di essere «in fondo»: lì un messaggio nuovo fa scorrere. */
const BOTTOM_THRESHOLD_PX = 80

/** Errore finto di «non trovato», per riusare il testo di `NOT_FOUND` quando la conversazione non è nell'elenco. */
const NOT_FOUND_ERROR = { status: 404, data: { code: 'NOT_FOUND', message: '' } }

/** Un messaggio: bolla con il testo da `UserText`, ora sotto e, se è mio, la spunta «inviato» o «letto». */
function MessageItem({ message, own, otherName }: { message: ChatMessageResponse; own: boolean; otherName: string }) {
  return (
    <li className={`rs-message ${own ? 'rs-message--own' : 'rs-message--other'}`}>
      <span className="visually-hidden">{own ? 'Tu:' : `${otherName}:`}</span>
      <div className="rs-message__bubble">
        <UserText text={message.body} />
      </div>
      <div className="rs-message__meta">
        <time dateTime={message.sentAt}>{formatClock(message.sentAt)}</time>
        {own &&
          (message.readAt ? (
            <span className="rs-message__ticks rs-message__ticks--read" data-testid="ticks-read">
              <ReadTick />
              <span className="visually-hidden">Letto</span>
            </span>
          ) : (
            <span className="rs-message__ticks rs-message__ticks--sent" data-testid="ticks-sent">
              <SentTick />
              <span className="visually-hidden">Inviato</span>
            </span>
          ))}
      </div>
    </li>
  )
}

/**
 * Una conversazione (progettazione, sezioni 6.9 e 7): intestazione con la persona, storico a cursore (30 messaggi per
 * volta, «Messaggi precedenti» in cima), messaggi nuovi da STOMP senza doppioni, lettura segnata all'apertura e a ogni
 * messaggio dell'altro, casella di scrittura. Va montata con `key={conversationId}`: cambiando conversazione riparte
 * da capo, scorrimento compreso.
 */
export function ConversationView({ conversationId }: { conversationId: string }) {
  const dispatch = useAppDispatch()
  const myId = useAppSelector(selectCurrentUser)?.id
  const status = useStompStatus()
  const list = useGetConversationsQuery()
  const history = useGetMessagesQuery(conversationId)
  const [loadOlder, older] = useLazyGetOlderMessagesQuery()
  const [markRead] = useMarkConversationReadMutation()
  const [draft, setDraft] = useState('')

  const conversation = list.data?.find((candidate) => candidate.id === conversationId)
  const unread = conversation?.unreadCount ?? 0

  // Un messaggio che non è partito torna nella casella, davanti a quanto è stato scritto nel frattempo
  const restore = useCallback(
    (texts: string[]) => setDraft((current) => [...texts, current].filter(Boolean).join('\n')),
    [],
  )
  const outgoing = useOutgoingMessages(conversationId, restore)

  // Le pagine vanno dal più recente al più vecchio: a video servono al contrario
  const messages = useMemo(() => history.data?.messages.toReversed() ?? [], [history.data])

  // Aperta la conversazione con messaggi non letti: si segna letta (e l'elenco azzera il numero)
  useEffect(() => {
    if (unread > 0) void markRead(conversationId)
  }, [conversationId, unread, markRead])

  // Messaggi di questa conversazione dalla coda: entrano nello storico; se sono dell'altro (e non già visti) si segna letto
  useEffect(
    () =>
      subscribe<ChatMessageResponse>(QUEUES.messages, (message) => {
        if (message.conversationId !== conversationId) return
        const duplicate = receiveHistoryMessage(dispatch, message)
        if (!duplicate && message.senderId !== myId) void markRead(conversationId)
      }),
    [conversationId, myId, dispatch, markRead],
  )

  // ---------- Scorrimento ----------
  const scroller = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)
  /** Distanza dal fondo prima di caricare i precedenti, da ripristinare quando arrivano. */
  const distanceFromBottom = useRef<number | null>(null)
  const firstId = useRef<string | undefined>(undefined)
  const lastId = useRef<string | undefined>(undefined)

  useLayoutEffect(() => {
    const element = scroller.current
    const first = messages[0]
    const last = messages.at(-1)
    if (!element || !first || !last) return
    if (first.id !== firstId.current && distanceFromBottom.current !== null) {
      // Arrivati i messaggi precedenti: resta fermo quello che si stava leggendo
      element.scrollTop = element.scrollHeight - distanceFromBottom.current
      distanceFromBottom.current = null
    } else if (last.id !== lastId.current && (!lastId.current || atBottom.current || last.senderId === myId)) {
      // Apertura della conversazione o messaggio nuovo: giù, ma solo se si era già in fondo (o l'ho scritto io)
      element.scrollTop = element.scrollHeight
    }
    firstId.current = first.id
    lastId.current = last.id
  }, [messages, myId])

  // Il segnaposto «Invio…» compare in fondo: se si era in fondo, ci si resta
  const pendingCount = outgoing.pending.length
  useLayoutEffect(() => {
    const element = scroller.current
    if (element && pendingCount > 0) element.scrollTop = element.scrollHeight
  }, [pendingCount])

  function onScroll() {
    const element = scroller.current
    if (element) {
      atBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < BOTTOM_THRESHOLD_PX
    }
  }

  function showOlder() {
    const oldest = history.data?.messages.at(-1)
    if (!oldest) return
    const element = scroller.current
    if (element) distanceFromBottom.current = element.scrollHeight - element.scrollTop
    void loadOlder({ conversationId, before: oldest.id })
  }

  function submit() {
    if (outgoing.send(draft.trim())) setDraft('')
  }

  if (list.isLoading || history.isLoading) {
    return (
      <Skeleton>
        {[0, 1, 2, 3].map((row) => (
          <SkeletonLine key={row} width={row % 2 ? 6 : 9} />
        ))}
      </Skeleton>
    )
  }
  if (list.error) return <ErrorAlert error={list.error} />
  if (!conversation) return <ErrorAlert error={NOT_FOUND_ERROR} />
  if (history.error && !history.data) return <ErrorAlert error={history.error} />

  const { otherUser, canSend } = conversation
  const name = otherUser.displayName

  return (
    <section className="rs-conversation-view" aria-label={`Conversazione con ${name}`}>
      <header className="rs-conversation-view__header">
        <Link to={ROUTES.chat} className="rs-conversation-view__back" aria-label="Torna alle conversazioni">
          <BackIcon />
        </Link>
        <Avatar displayName={name} avatarUrl={otherUser.avatarUrl} />
        <div className="rs-conversation-view__who">
          <Link to={userPath(otherUser.id)} className="rs-conversation-view__name">
            {name}
          </Link>
          {!canSend && (
            <span className="rs-conversation__locked">
              <LockIcon /> Chat bloccata
            </span>
          )}
        </div>
      </header>

      <div ref={scroller} onScroll={onScroll} className="rs-conversation-view__messages">
        {history.data?.hasMore && (
          <div className="rs-conversation-view__older">
            <Button variant="outline-light" size="sm" disabled={older.isFetching} onClick={showOlder}>
              Messaggi precedenti
            </Button>
          </div>
        )}
        {older.isError && <ErrorAlert error={older.error} />}

        {messages.length === 0 && canSend && outgoing.pending.length === 0 && (
          <p className="rs-field-hint">Nessun messaggio: scrivi il primo.</p>
        )}

        <ol className="rs-message-list" aria-label={`Messaggi con ${name}`}>
          {messages.map((message, index) => {
            const previous = messages[index - 1]
            const newDay = !previous || !isSameDay(previous.sentAt, message.sentAt)
            return (
              <Fragment key={message.id}>
                {newDay && (
                  <li className="rs-chat-day" aria-hidden="true">
                    <span>{formatChatDay(message.sentAt)}</span>
                  </li>
                )}
                <MessageItem message={message} own={message.senderId === myId} otherName={name} />
              </Fragment>
            )
          })}
          {outgoing.pending.map((entry) => (
            <li key={entry.key} className="rs-message rs-message--own rs-message--pending">
              <span className="visually-hidden">Tu:</span>
              <div className="rs-message__bubble">
                <UserText text={entry.text} />
              </div>
              <div className="rs-message__meta">Invio…</div>
            </li>
          ))}
        </ol>
      </div>

      <MessageComposer
        name={name}
        value={draft}
        onChange={setDraft}
        onSubmit={submit}
        status={status}
        canSend={canSend}
        error={outgoing.error}
      />
    </section>
  )
}
