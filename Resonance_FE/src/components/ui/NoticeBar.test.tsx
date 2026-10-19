import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { noticeShown, type NoticeKind } from '@/lib/notices/noticeSlice'
import { makeLoginResponse } from '@/test/fixtures/users'
import { refreshRejected, refreshSucceeds } from '@/test/handlers/auth'
import { server } from '@/test/server'
import { NoticeBar } from './NoticeBar'

// Barra degli avvisi di sistema: il testo giusto per ogni avviso, Riprova solo per "server non raggiungibile".
function renderBar(kind: NoticeKind | null) {
  const store = makeStore()
  if (kind) store.dispatch(noticeShown(kind))
  render(
    <Provider store={store}>
      <NoticeBar />
    </Provider>,
  )
  return store
}

describe('NoticeBar', () => {
  it('senza avvisi non disegna nulla', () => {
    renderBar(null)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('serverUnreachable mostra il messaggio e il pulsante Riprova', () => {
    renderBar('serverUnreachable')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Non riesco a contattare il server: la tua sessione potrebbe essere ancora attiva.',
    )
    expect(screen.getByRole('button', { name: 'Riprova' })).toBeInTheDocument()
  })

  it('logoutIncomplete mostra il messaggio, senza Riprova', () => {
    renderBar('logoutIncomplete')
    expect(screen.getByRole('alert')).toHaveTextContent('Sei uscito da questo dispositivo')
    expect(screen.queryByRole('button', { name: 'Riprova' })).not.toBeInTheDocument()
  })

  it("il pulsante Chiudi toglie l'avviso", async () => {
    const store = renderBar('logoutIncomplete')
    await userEvent.click(screen.getByRole('button', { name: 'Chiudi' }))
    expect(store.getState().notice.current).toBeNull()
  })

  it("Riprova con il server di nuovo raggiungibile riprende la sessione e toglie l'avviso", async () => {
    server.use(refreshSucceeds(makeLoginResponse({ accessToken: 'ripreso' })))
    const store = renderBar('serverUnreachable')

    await userEvent.click(screen.getByRole('button', { name: 'Riprova' }))

    await waitFor(() => expect(store.getState().notice.current).toBeNull())
    expect(store.getState().auth).toMatchObject({ status: 'authenticated', accessToken: 'ripreso' })
  })

  it("Riprova con la sessione davvero scaduta (401) toglie l'avviso e resta anonimo", async () => {
    server.use(refreshRejected(401, 'REFRESH_TOKEN_INVALID'))
    const store = renderBar('serverUnreachable')

    await userEvent.click(screen.getByRole('button', { name: 'Riprova' }))

    await waitFor(() => expect(store.getState().notice.current).toBeNull())
    expect(store.getState().auth.status).toBe('anonymous')
  })

  it("Riprova con il server ancora irraggiungibile lascia l'avviso", async () => {
    server.use(refreshRejected(500, 'INTERNAL_ERROR'))
    const store = renderBar('serverUnreachable')

    await userEvent.click(screen.getByRole('button', { name: 'Riprova' }))

    await screen.findByRole('button', { name: 'Riprova' })
    expect(store.getState().notice.current).toBe('serverUnreachable')
  })
})
