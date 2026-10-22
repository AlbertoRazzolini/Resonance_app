import { Client, type IFrame, type IMessage, type StompSubscription } from '@stomp/stompjs'
import { sessionEnded } from '@/features/auth/authSlice'
import { refreshSession } from '@/lib/api/apiSlice'
import { onTokenRefreshed, type SessionApi } from '@/lib/api/baseQuery'
import type { AuthState } from '@/features/auth/authSlice'
import { QUEUES, type Queue } from './destinations'

/** Stato della connessione, per l'indicatore sopra la casella di scrittura della chat. */
export type StompStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting'

/** Attesa fra due tentativi di connessione (progettazione, sezione 7.9). */
const RECONNECT_DELAY_MS = 5000

/** Corpo dei messaggi di `/user/queue/errors` (progettazione, sezione 7.4). */
type WsError = { code: string; message: string }

let client: Client | null = null
let status: StompStatus = 'idle'
/** true dopo la prima connessione riuscita: da lì in poi ogni connessione è una riconnessione. */
let hasConnected = false
let stopTokenListener: (() => void) | null = null
let removeErrorHandler: (() => void) | null = null

const queueListeners: Record<Queue, Set<(body: unknown) => void>> = {
  [QUEUES.messages]: new Set(),
  [QUEUES.notifications]: new Set(),
  [QUEUES.errors]: new Set(),
}
const statusListeners = new Set<() => void>()
const reconnectedListeners = new Set<() => void>()

function setStatus(next: StompStatus) {
  if (next === status) return
  status = next
  statusListeners.forEach((listener) => listener())
}

/** Indirizzo del WebSocket: la stessa origine della pagina (progettazione, sezione 7.1; in sviluppo lo inoltra il proxy di Vite). */
function brokerUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws`
}

/** Iscrive il client a una coda: ogni messaggio, già letto come JSON, va a tutti gli ascoltatori della coda. */
function openQueue(connection: Client, queue: Queue): StompSubscription {
  return connection.subscribe(queue, (message: IMessage) => {
    let body: unknown
    try {
      body = JSON.parse(message.body)
    } catch {
      return // il backend manda sempre DTO in JSON: un corpo diverso si ignora
    }
    queueListeners[queue].forEach((listener) => listener(body))
  })
}

/**
 * Reazione a un errore di sessione del WebSocket, da un frame ERROR (al CONNECT) o dalla coda errori (dopo un SEND).
 * `TOKEN_INVALID`: si rinnova il token, e il rinnovo riapre la connessione. `ACCOUNT_SUSPENDED`: il refresh porta i
 * dettagli della sospensione (403) e chiude la sessione; se non risponde si chiude comunque, senza motivo
 * (progettazione, sezioni 7.2, 7.5 e 7.8).
 */
async function handleSessionError(store: SessionApi, code: string | undefined) {
  if (code !== 'TOKEN_INVALID' && code !== 'ACCOUNT_SUSPENDED') return
  const outcome = await refreshSession(store)
  if (outcome === 'ended') {
    stopStomp()
  } else if (outcome === 'failed' && code === 'ACCOUNT_SUSPENDED') {
    store.dispatch(sessionEnded({ suspension: { suspensionReason: '', suspendedUntil: null } }))
    stopStomp()
  }
}

/**
 * Apre l'unica connessione STOMP dell'app, finché la sessione è attiva (progettazione, sezione 7). A ogni tentativo il
 * token si legge dallo store (`beforeConnect`), alle riconnessioni stompjs ripete la CONNECT e qui si rifanno le
 * SUBSCRIBE; dopo ogni refresh la connessione si riapre perché il SEND non trovi un token scaduto (sezione 7.7).
 */
export function startStomp(store: SessionApi) {
  stopStomp()
  hasConnected = false

  const connection = new Client({
    brokerURL: brokerUrl(),
    reconnectDelay: RECONNECT_DELAY_MS,
    beforeConnect: (current) => {
      const { accessToken } = (store.getState() as { auth: AuthState }).auth
      current.connectHeaders = { Authorization: `Bearer ${accessToken}` }
    },
    onConnect: () => {
      setStatus('connected')
      for (const queue of Object.values(QUEUES)) openQueue(connection, queue)
      if (hasConnected) reconnectedListeners.forEach((listener) => listener())
      hasConnected = true
    },
    onWebSocketClose: () => {
      if (connection.active) setStatus(hasConnected ? 'reconnecting' : 'connecting')
    },
    onStompError: (frame: IFrame) => {
      void handleSessionError(store, frame.headers.message)
    },
  })
  client = connection

  const errors = queueListeners[QUEUES.errors]
  const onError = (body: unknown) => void handleSessionError(store, (body as Partial<WsError>).code)
  errors.add(onError)
  removeErrorHandler = () => errors.delete(onError)
  stopTokenListener = onTokenRefreshed(() => connection.forceDisconnect())

  setStatus('connecting')
  connection.activate()
}

/** Chiude la connessione e smette di riprovare (uscita, sospensione, sessione scaduta). */
export function stopStomp() {
  stopTokenListener?.()
  removeErrorHandler?.()
  stopTokenListener = null
  removeErrorHandler = null
  void client?.deactivate()
  client = null
  hasConnected = false
  setStatus('idle')
}

/**
 * Riceve i messaggi di una coda, già letti come JSON. Si può chiamare anche prima della connessione: la coda si
 * iscrive a ogni connessione. Restituisce la funzione che annulla.
 */
export function subscribe<T>(queue: Queue, callback: (body: T) => void): () => void {
  const listener = callback as (body: unknown) => void
  queueListeners[queue].add(listener)
  return () => {
    queueListeners[queue].delete(listener)
  }
}

/** SEND verso `/app/**` con il corpo in JSON; `false` se ora non c'è connessione (il messaggio non parte). */
export function send(destination: string, body: unknown): boolean {
  if (!client?.connected) return false
  client.publish({ destination, body: JSON.stringify(body) })
  return true
}

/**
 * Registra un ascoltatore chiamato a ogni riconnessione, non alla prima connessione: ciò che è arrivato mentre la
 * connessione era caduta non passa dal WebSocket e va riletto via REST (progettazione, sezione 7.6).
 */
export function onStompReconnected(listener: () => void): () => void {
  reconnectedListeners.add(listener)
  return () => {
    reconnectedListeners.delete(listener)
  }
}

/** Stato attuale e osservatori, per `useStompStatus`. */
export const getStompStatus = () => status
export function observeStompStatus(listener: () => void) {
  statusListeners.add(listener)
  return () => {
    statusListeners.delete(listener)
  }
}
