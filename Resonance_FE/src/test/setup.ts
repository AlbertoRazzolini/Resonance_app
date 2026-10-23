import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'
import { server } from './server'
import { installMatchMedia, resetViewport } from './viewport'

// jsdom non ha IntersectionObserver, che la libreria delle icone animate (motion) usa al montaggio: finto che
// non osserva niente.
class NoopIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
globalThis.IntersectionObserver = NoopIntersectionObserver as unknown as typeof IntersectionObserver

// jsdom non implementa il canvas: getContext scriverebbe un errore a ogni montaggio del bordo animato (StarBorder).
// Senza contesto il componente resta un semplice pulsante o collegamento.
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext

// Setup comune dei test: matcher di jest-dom, MSW e finestra simulata (matchMedia). Una richiesta senza handler
// fa fallire il test.
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
beforeEach(() => installMatchMedia())
afterEach(() => {
  cleanup()
  server.resetHandlers()
  resetViewport()
})
afterAll(() => server.close())
