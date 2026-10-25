import { describe, expect, it, vi } from 'vitest'
import { installStaleChunkReload, RELOAD_FLAG, RELOAD_GUARD_MS } from './reloadOnStaleChunk'

// Dopo un deploy i file delle pagine cambiano nome: una scheda aperta prima non trova più il file e Vite emette
// `vite:preloadError`. L'app si ricarica una volta da sola; un secondo errore subito dopo non ricarica di nuovo (niente cicli).
function setup(now = 1_000_000) {
  const target = new EventTarget()
  const store = new Map<string, string>()
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  }
  const reload = vi.fn()
  const clock = { now }
  installStaleChunkReload({ target, storage, reload, now: () => clock.now })
  const fire = () => {
    const event = new Event('vite:preloadError', { cancelable: true })
    target.dispatchEvent(event)
    return event
  }
  return { fire, reload, store, clock }
}

describe('installStaleChunkReload', () => {
  it('al primo errore di un file di pagina ricarica e annulla la schermata di errore', () => {
    const { fire, reload } = setup()

    const event = fire()

    expect(reload).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('ricorda l\'istante del ricaricamento', () => {
    const { fire, store } = setup(5000)

    fire()

    expect(store.get(RELOAD_FLAG)).toBe('5000')
  })

  it('un secondo errore subito dopo non ricarica di nuovo, così non si va in ciclo', () => {
    const { fire, reload, clock } = setup()
    fire()

    clock.now += RELOAD_GUARD_MS - 1
    const event = fire()

    expect(reload).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(false)
  })

  it('passato il tempo di guardia, un nuovo deploy può ricaricare ancora', () => {
    const { fire, reload, clock } = setup()
    fire()

    clock.now += RELOAD_GUARD_MS + 1
    fire()

    expect(reload).toHaveBeenCalledTimes(2)
  })

  it('se la memoria della scheda non è disponibile non ricarica: meglio l\'errore di un ciclo', () => {
    const target = new EventTarget()
    const reload = vi.fn()
    const storage = {
      getItem: () => {
        throw new Error('bloccata')
      },
      setItem: () => {
        throw new Error('bloccata')
      },
    }
    installStaleChunkReload({ target, storage, reload, now: () => 1 })

    const event = new Event('vite:preloadError', { cancelable: true })
    target.dispatchEvent(event)

    expect(reload).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('smettendo di ascoltare con la funzione restituita, non ricarica più', () => {
    const target = new EventTarget()
    const reload = vi.fn()
    const storage = { getItem: () => null, setItem: () => undefined }
    const stop = installStaleChunkReload({ target, storage, reload, now: () => 1 })

    stop()
    target.dispatchEvent(new Event('vite:preloadError', { cancelable: true }))

    expect(reload).not.toHaveBeenCalled()
  })
})
