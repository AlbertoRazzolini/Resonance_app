import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { StrictMode } from 'react'
import { Provider } from 'react-redux'
import { describe, expect, it, vi } from 'vitest'
import { makeStore } from '@/app/store'
import { useAppSelector } from '@/hooks/redux'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import { refreshRejected, refreshSucceeds } from '@/test/handlers/auth'
import { server } from '@/test/server'
import { SessionBootstrap } from './SessionBootstrap'

// Avvio della sessione: un refresh all'apertura, schermata di caricamento finché non risponde e mai
// l'interfaccia anonima per un istante (Review Focus 3); server irraggiungibile = anonimo con avviso.
function Probe({ seen }: { seen: string[] }) {
  const status = useAppSelector((state) => state.auth.status)
  const name = useAppSelector((state) => state.auth.user?.displayName)
  seen.push(status)
  return <p>{status === 'authenticated' ? `Ciao ${name}` : 'Anonimo'}</p>
}

function renderApp(seen: string[], strict = false) {
  const store = makeStore()
  const tree = (
    <Provider store={store}>
      <SessionBootstrap>
        <Probe seen={seen} />
      </SessionBootstrap>
    </Provider>
  )
  render(strict ? <StrictMode>{tree}</StrictMode> : tree)
  return store
}

describe('SessionBootstrap', () => {
  it("con il refresh riuscito mostra subito l'utente, senza passare dallo stato anonimo", async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    server.use(
      http.post('*/api/auth/refresh', async () => {
        await gate
        return HttpResponse.json(makeLoginResponse({ user: makeMe({ displayName: 'Marta' }) }))
      }),
    )
    const seen: string[] = []
    renderApp(seen)

    // Finché il refresh non risponde: solo il caricamento, nessun figlio
    expect(screen.getByRole('status')).toHaveTextContent('Caricamento')
    expect(seen).toEqual([])

    release()
    expect(await screen.findByText('Ciao Marta')).toBeInTheDocument()
    expect(seen).not.toContain('unknown')
    expect(seen).not.toContain('anonymous')
  })

  it('senza cookie (401 REFRESH_TOKEN_INVALID) diventa anonimo senza errori in console né avvisi', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    server.use(refreshRejected(401, 'REFRESH_TOKEN_INVALID'))
    const seen: string[] = []
    const store = renderApp(seen)

    expect(await screen.findByText('Anonimo')).toBeInTheDocument()
    expect(store.getState().auth.status).toBe('anonymous')
    expect(store.getState().notice.current).toBeNull()
    expect(seen).toEqual(['anonymous'])
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it("con il server irraggiungibile diventa anonimo e mostra l'avviso con Riprova", async () => {
    server.use(http.post('*/api/auth/refresh', () => HttpResponse.error()))
    const store = renderApp([])
    expect(await screen.findByText('Anonimo')).toBeInTheDocument()
    expect(store.getState().notice.current).toBe('serverUnreachable')
  })

  it("con un errore 500 all'avvio diventa anonimo e mostra l'avviso con Riprova", async () => {
    server.use(refreshRejected(500, 'INTERNAL_ERROR'))
    const store = renderApp([])
    expect(await screen.findByText('Anonimo')).toBeInTheDocument()
    expect(store.getState().notice.current).toBe('serverUnreachable')
  })

  it('con account sospeso (403) diventa anonimo e conserva i dettagli, senza avviso', async () => {
    const details = { suspensionReason: 'Spam', suspendedUntil: '2026-12-01T00:00:00Z' }
    server.use(refreshRejected(403, 'ACCOUNT_SUSPENDED', [], details))
    const store = renderApp([])
    expect(await screen.findByText('Anonimo')).toBeInTheDocument()
    expect(store.getState().auth.suspension).toEqual(details)
    expect(store.getState().notice.current).toBeNull()
  })

  it("in StrictMode fa un solo refresh anche se l'effetto parte due volte", async () => {
    const calls: Request[] = []
    server.use(refreshSucceeds(makeLoginResponse(), calls))
    renderApp([], true)
    expect(await screen.findByText(/Ciao/)).toBeInTheDocument()
    expect(calls).toHaveLength(1)
  })
})
