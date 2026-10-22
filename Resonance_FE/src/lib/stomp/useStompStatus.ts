import { useSyncExternalStore } from 'react'
import { getStompStatus, observeStompStatus, type StompStatus } from './client'

/** Stato della connessione STOMP, per l'indicatore della chat. */
export function useStompStatus(): StompStatus {
  return useSyncExternalStore(observeStompStatus, getStompStatus)
}
