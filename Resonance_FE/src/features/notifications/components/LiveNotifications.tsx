import { useEffect, useRef } from 'react'
import { CloseButton, ToastContainer } from 'react-bootstrap'
import { Link, useLocation } from 'react-router'
import { chatPath } from '@/app/routes'
import { chatApi, receiveMessage } from '@/features/chat/api/chatApi'
import { ConfirmationBar } from '@/components/ui/ConfirmationBar'
import { UserText } from '@/components/ui/UserText'
import { useAppDispatch, useAppSelector, useAppStore } from '@/hooks/redux'
import { onStompReconnected, startStomp, stopStomp, subscribe } from '@/lib/stomp/client'
import { QUEUES } from '@/lib/stomp/destinations'
import type { ChatMessageResponse, LiveNotification } from '@/types/chat'
import { notificationPath, notificationText } from '../notificationInfo'
import {
  markRead,
  received,
  selectToasts,
  toastDismissed,
  type SessionNotification,
} from '../notificationsSlice'

/** Quanto resta in vista un toast prima di chiudersi da solo (scelta dello studente, FE-09b). */
const TOAST_VISIBLE_MS = 6000

/**
 * Un toast: il testo è il collegamento al bersaglio (steso su tutto il toast), con sotto l'anteprima da `UserText` per i
 * messaggi. Il clic segna letta la notifica e chiude il toast; la X lo chiude e la notifica resta nella campanella.
 * Usa le classi del toast di Bootstrap ma non il suo componente, che forza `role="alert"`: una notifica non è urgente e
 * come regione `status` i lettori di schermo la leggono senza interrompere.
 */
function NotificationToast({ notification }: { notification: SessionNotification }) {
  const dispatch = useAppDispatch()
  const { id } = notification

  useEffect(() => {
    const timer = setTimeout(() => dispatch(toastDismissed(id)), TOAST_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [id, dispatch])

  const dismiss = () => dispatch(toastDismissed(id))

  return (
    <div className="toast show rs-toast" role="status" aria-live="polite" aria-atomic="true">
      <div className="toast-body rs-toast__body">
        <Link
          className="rs-toast__title stretched-link"
          to={notificationPath(notification)}
          onClick={() => {
            dispatch(markRead(notification.id))
            dismiss()
          }}
        >
          {notificationText(notification)}
        </Link>
        {notification.preview && (
          <div className="rs-toast__preview">
            <UserText text={notification.preview} />
          </div>
        )}
        <CloseButton className="rs-toast__close" aria-label="Chiudi" onClick={dismiss} />
      </div>
    </div>
  )
}

/**
 * Tiene aperta la connessione STOMP finché la sessione è attiva (progettazione, sezione 7), mostra i toast delle
 * notifiche e le conferme delle azioni nello stesso riquadro fisso in alto a destra (toast: al massimo tre, 6 secondi) e porta in cache ciò che arriva: ogni messaggio aggiorna elenco e badge delle conversazioni (senza non letti se quella conversazione è
 * aperta); ogni notifica va alla campanella e ai toast, tranne un nuovo messaggio della conversazione già aperta; dopo
 * una riconnessione si ricaricano elenco e storico, perché i messaggi arrivati a connessione caduta non passano dal
 * WebSocket (sezione 7.6). Il rinnovo del token e le riconnessioni li gestisce il client.
 */
export function LiveNotifications() {
  const store = useAppStore()
  const toasts = useAppSelector(selectToasts)
  const isAuthenticated = useAppSelector((state) => state.auth.status === 'authenticated')
  const myId = useAppSelector((state) => state.auth.user?.id)
  // Pagina attuale in un ref: l'iscrizione resta la stessa anche cambiando pagina
  const { pathname } = useLocation()
  const pathRef = useRef(pathname)
  useEffect(() => {
    pathRef.current = pathname
  }, [pathname])

  useEffect(() => {
    if (!isAuthenticated) return
    startStomp(store)
    return () => stopStomp()
  }, [isAuthenticated, store])

  useEffect(() => {
    if (!isAuthenticated || !myId) return
    const stopMessages = subscribe<ChatMessageResponse>(QUEUES.messages, (message) => {
      const isOpen = pathRef.current === chatPath(message.conversationId)
      receiveMessage(store.dispatch, message, { myId, isOpen })
    })
    const stopNotifications = subscribe<LiveNotification>(QUEUES.notifications, (notification) => {
      if (!notification?.type) return
      const isOpenConversation =
        notification.type === 'NEW_MESSAGE' && pathRef.current === chatPath(notification.targetId)
      if (!isOpenConversation) store.dispatch(received(notification))
    })
    const stopReconnected = onStompReconnected(() => {
      store.dispatch(chatApi.util.invalidateTags(['Chat', 'Messages']))
    })
    return () => {
      stopMessages()
      stopNotifications()
      stopReconnected()
    }
  }, [isAuthenticated, myId, store])

  return (
    <ToastContainer position="top-end" containerPosition="fixed" className="rs-toasts">
      <ConfirmationBar />
      {toasts.map((notification) => (
        <NotificationToast key={notification.id} notification={notification} />
      ))}
    </ToastContainer>
  )
}
