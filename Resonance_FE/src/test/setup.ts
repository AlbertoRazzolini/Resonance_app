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
