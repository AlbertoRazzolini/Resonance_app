/** Chiave della memoria della scheda con l'istante dell'ultimo ricaricamento automatico. */
export const RELOAD_FLAG = 'rs-stale-chunk-reload'

/** Dopo un ricaricamento automatico, per questo tempo un nuovo errore non ne provoca un altro: niente cicli. */
export const RELOAD_GUARD_MS = 10_000

type Options = {
  /** Dove arriva l'evento `vite:preloadError` (la finestra). */
  target: EventTarget
  storage: Pick<Storage, 'getItem' | 'setItem'>
  reload: () => void
  now: () => number
}

/**
 * Dopo un deploy i file delle pagine cambiano nome: una scheda aperta prima non trova più il file della pagina e Vite
 * emette `vite:preloadError`. Qui l'app si ricarica una volta da sola, così chi ha il sito aperto non vede l'errore
 * (decisione dello studente, 25 ottobre). Un secondo errore entro `RELOAD_GUARD_MS` mostra l'errore invece di
 * ricaricare ancora; senza memoria della scheda non si ricarica. Restituisce la funzione che smette di ascoltare.
 */
export function installStaleChunkReload({ target, storage, reload, now }: Options): () => void {
  function onPreloadError(event: Event) {
    try {
      const last = Number(storage.getItem(RELOAD_FLAG))
      if (last && now() - last < RELOAD_GUARD_MS) return
      storage.setItem(RELOAD_FLAG, String(now()))
    } catch {
      return // memoria bloccata (finestra privata, dati del sito bloccati): meglio l'errore di un ciclo
    }
    event.preventDefault()
    reload()
  }

  target.addEventListener('vite:preloadError', onPreloadError)
  return () => target.removeEventListener('vite:preloadError', onPreloadError)
}
