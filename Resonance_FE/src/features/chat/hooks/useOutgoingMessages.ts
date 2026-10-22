import { useCallback, useEffect, useRef, useState } from 'react'
import { selectCurrentUser } from '@/features/auth/authSlice'
import { useAppDispatch, useAppSelector } from '@/hooks/redux'
import { getErrorMessage } from '@/lib/errors/getErrorMessage'
import { send as sendStomp, subscribe } from '@/lib/stomp/client'
import { QUEUES, sendDestination } from '@/lib/stomp/destinations'
import { useStompStatus } from '@/lib/stomp/useStompStatus'
import type { ChatMessageResponse, WsError } from '@/types/chat'
import { chatApi } from '../api/chatApi'

/** Attesa dell'eco prima di mostrare il segnaposto «Invio…»: col server veloce non compare mai (scelta dello studente). */
const SHOW_AFTER_MS = 300
/** Attesa massima dell'eco: poi il messaggio si considera non partito e il testo torna nella casella. */
const GIVE_UP_AFTER_MS = 10_000

/** Testo mostrato quando un messaggio non parte per la connessione o per l'attesa scaduta. */
export const SEND_FAILED_TEXT = 'Messaggio non inviato: controlla la connessione e riprova.'

/** Errori della coda che gestisce il client STOMP (rinnovo del token, sospensione): la chat non li mostra. */
const CLIENT_HANDLED_CODES = ['TOKEN_INVALID', 'ACCOUNT_SUSPENDED']

type Outgoing = { key: number; text: string; visible: boolean }

/**
 * Messaggi in uscita di una conversazione (progettazione, sezione 7.5). Il messaggio vero compare quando il backend lo
 * rimanda su `/user/queue/messages`; fino ad allora un segnaposto «Invio…» (solo dopo 300 ms). Il testo torna a chi
 * scrive, con l'errore, se la coda risponde con un errore, se la connessione cade o se l'eco non arriva entro 10 s.
 * L'eco e gli errori non dicono a quale invio si riferiscono: vale il più vecchio in attesa (come in NoseY).
 */
export function useOutgoingMessages(conversationId: string, onRestore: (texts: string[]) => void) {
  const dispatch = useAppDispatch()
  const myId = useAppSelector(selectCurrentUser)?.id
  const status = useStompStatus()
  const [outgoing, setOutgoing] = useState<Outgoing[]>([])
  const [error, setError] = useState<string | null>(null)
  // Copia in un ref: i gestori di coda e di timer leggono sempre l'elenco aggiornato senza riregistrarsi
  const queue = useRef<Outgoing[]>([])
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>[]>())
  const counter = useRef(0)
  const restore = useRef(onRestore)
  useEffect(() => {
    restore.current = onRestore
  }, [onRestore])

  const commit = useCallback((next: Outgoing[]) => {
    queue.current = next
    setOutgoing(next)
  }, [])

  const forget = useCallback((keys: number[]) => {
    for (const key of keys) {
      timers.current.get(key)?.forEach(clearTimeout)
      timers.current.delete(key)
    }
    commit(queue.current.filter((entry) => !keys.includes(entry.key)))
  }, [commit])

  /** Toglie dall'attesa i messaggi indicati: il testo torna nella casella e compare `message`. */
  const fail = useCallback(
    (entries: Outgoing[], message: string) => {
      if (entries.length === 0) return
      forget(entries.map((entry) => entry.key))
      restore.current(entries.map((entry) => entry.text))
      setError(message)
    },
    [forget],
  )

  useEffect(() => {
    const stopMessages = subscribe<ChatMessageResponse>(QUEUES.messages, (message) => {
      if (message.conversationId !== conversationId || message.senderId !== myId) return
      const oldest = queue.current[0]
      if (oldest) forget([oldest.key])
    })
    const stopErrors = subscribe<WsError>(QUEUES.errors, ({ code, message }) => {
      const oldest = queue.current[0]
      if (!oldest || CLIENT_HANDLED_CODES.includes(code)) return
      // La chat è diventata di sola lettura: l'elenco ricaricato porta `canSend` falso
      if (code === 'CHAT_LOCKED') dispatch(chatApi.util.invalidateTags(['Chat']))
      fail([oldest], getErrorMessage({ status: 400, data: { code, message } }))
    })
    return () => {
      stopMessages()
      stopErrors()
    }
  }, [conversationId, myId, dispatch, forget, fail])

  // Connessione caduta con messaggi in attesa: l'eco non arriverà, o non si saprebbe se è partito
  useEffect(() => {
    if (status !== 'connected') fail([...queue.current], SEND_FAILED_TEXT)
  }, [status, fail])

  // Allo smontaggio i timer pendenti non devono toccare uno stato che non c'è più
  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((list) => list.forEach(clearTimeout))
      pending.clear()
    }
  }, [])

  /** Invia il testo: `false` se ora non si può (nessuna connessione), e allora il testo resta a chi scrive. */
  const send = useCallback(
    (text: string): boolean => {
      setError(null)
      if (!sendStomp(sendDestination(conversationId), { body: text })) {
        setError(SEND_FAILED_TEXT)
        return false
      }
      const entry: Outgoing = { key: ++counter.current, text, visible: false }
      commit([...queue.current, entry])
      const show = setTimeout(() => {
        commit(queue.current.map((e) => (e.key === entry.key ? { ...e, visible: true } : e)))
      }, SHOW_AFTER_MS)
      const giveUp = setTimeout(() => {
        const stuck = queue.current.find((e) => e.key === entry.key)
        if (stuck) fail([stuck], SEND_FAILED_TEXT)
      }, GIVE_UP_AFTER_MS)
      timers.current.set(entry.key, [show, giveUp])
      return true
    },
    [conversationId, commit, fail],
  )

  return { pending: outgoing.filter((entry) => entry.visible), error, send }
}
