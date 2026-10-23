/**
 * Larghezza simulata della finestra per i test: jsdom non ha `matchMedia`. Capisce `min-width` e `max-width`
 * in px; di base 1280 (desktop), con `setViewportWidth(375)` il telefono.
 */
export const DEFAULT_VIEWPORT_WIDTH = 1280

let width = DEFAULT_VIEWPORT_WIDTH
// Di base il dispositivo ha un mouse (`hover: hover`, `pointer: fine`); con `setFinePointer(false)` è un touch
let finePointer = true
const listeners = new Set<() => void>()

function matches(query: string): boolean {
  // Le animazioni restano accese: senza questa riga ogni query senza larghezza risulterebbe vera, anche «riduci animazioni»
  if (/prefers-reduced-motion/.test(query)) return false
  if (/pointer:\s*fine|hover:\s*hover/.test(query)) return finePointer
  const min = /min-width:\s*([\d.]+)px/.exec(query)
  const max = /max-width:\s*([\d.]+)px/.exec(query)
  return (!min || width >= Number(min[1])) && (!max || width <= Number(max[1]))
}

/** Cambia la larghezza e avvisa chi ascolta le media query, come un ridimensionamento vero. */
export function setViewportWidth(next: number) {
  width = next
  listeners.forEach((listener) => listener())
}

/** Simula un dispositivo con il mouse (true, di base) o solo touch (false) per `(hover: hover) and (pointer: fine)`. */
export function setFinePointer(next: boolean) {
  finePointer = next
  listeners.forEach((listener) => listener())
}

/** Installa `window.matchMedia` sulla larghezza simulata. */
export function installMatchMedia() {
  window.matchMedia = (query: string) => {
    const wrapped = new Map<EventListenerOrEventListenerObject, () => void>()
    return {
      get matches() {
        return matches(query)
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        const call = () =>
          typeof listener === 'function' ? listener(new Event('change')) : undefined
        wrapped.set(listener, call)
        listeners.add(call)
      },
      removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        const call = wrapped.get(listener)
        if (call) listeners.delete(call)
      },
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    } as MediaQueryList
  }
}

/** Riporta la larghezza al valore di base, fra un test e l'altro. */
export function resetViewport() {
  width = DEFAULT_VIEWPORT_WIDTH
  finePointer = true
  listeners.clear()
}
