import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeAdminUser } from '@/test/fixtures/admin'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import { adminGranted, adminGrantRejected, adminRevoked } from '@/test/handlers/admin'
import { server } from '@/test/server'
import type { AdminUserResponse } from '@/types/admin'
import type { Role } from '@/types/users'
import { AdminRoleButton } from './AdminRoleButton'

// Nomina e revoca dell'ADMIN (progettazione, sezione 5.4): solo il SUPERADMIN, mai su un SUPERADMIN né su se stesso;
// «Rendi admin» è spento se l'utente non è verificato o è sospeso (decisione 54: una sospensione scaduta conta come
// attiva), «Togli admin» è sempre attivo; ogni azione chiede conferma.
function renderButton(user: AdminUserResponse, roles: Role[] = ['FAN', 'SUPERADMIN']) {
  const store = makeStore()
  store.dispatch(sessionStarted(makeLoginResponse({ user: makeMe({ roles }) })))
  render(
    <Provider store={store}>
      <AdminRoleButton user={user} />
    </Provider>,
  )
  return { user: userEvent.setup(), store }
}

const fan = makeAdminUser({ displayName: 'Marco Rossi' })
const admin = makeAdminUser({ displayName: 'Altro Admin', roles: ['FAN', 'ADMIN'] })

describe('AdminRoleButton · chi lo vede', () => {
  it('un ADMIN non vede nessun pulsante', () => {
    renderButton(fan, ['FAN', 'ADMIN'])
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('un SUPERADMIN vede «Rendi admin» su un utente di community e «Togli admin» su un ADMIN', () => {
    renderButton(fan)
    expect(screen.getByRole('button', { name: /Rendi admin/ })).toBeEnabled()
  })

  it('un SUPERADMIN vede «Togli admin» su un ADMIN', () => {
    renderButton(admin)
    expect(screen.getByRole('button', { name: /Togli admin/ })).toBeEnabled()
  })

  it('un SUPERADMIN non vede il pulsante su un altro SUPERADMIN né su se stesso', () => {
    const { store } = renderButton(makeAdminUser({ roles: ['FAN', 'SUPERADMIN'] }))
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(store.getState().auth.user?.roles).toContain('SUPERADMIN')
  })

  it('non c’è il pulsante su se stessi', () => {
    renderButton(makeAdminUser({ id: makeMe().id, roles: ['FAN'] }))
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('AdminRoleButton · «Rendi admin» spento', () => {
  it('con l’email non verificata spiega perché', () => {
    renderButton(makeAdminUser({ emailVerified: false }))

    expect(screen.getByRole('button', { name: /Rendi admin/ })).toBeDisabled()
    expect(screen.getByText('Email non ancora verificata')).toBeInTheDocument()
  })

  it('la frase sta sotto il pulsante, nello stesso gruppo', () => {
    renderButton(makeAdminUser({ emailVerified: false }))

    const button = screen.getByRole('button', { name: /Rendi admin/ })
    const hint = screen.getByText('Email non ancora verificata')
    expect(button.parentElement).toHaveClass('rs-admin-action')
    expect(button.parentElement).toContainElement(hint)
    expect(button.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('con un account sospeso spiega di riattivarlo prima', () => {
    renderButton(makeAdminUser({ status: 'SUSPENDED', suspendedUntil: null }))

    expect(screen.getByRole('button', { name: /Rendi admin/ })).toBeDisabled()
    expect(screen.getByText('Account sospeso: riattivalo prima')).toBeInTheDocument()
  })

  it('con una sospensione già scaduta il pulsante è attivo (decisione 54)', () => {
    renderButton(makeAdminUser({ status: 'SUSPENDED', suspendedUntil: '2020-01-01T00:00:00Z' }))

    expect(screen.getByRole('button', { name: /Rendi admin/ })).toBeEnabled()
  })

  it('«Togli admin» resta attivo anche se l’ADMIN è sospeso o non verificato', () => {
    renderButton(makeAdminUser({ roles: ['FAN', 'ADMIN'], status: 'SUSPENDED', emailVerified: false }))

    expect(screen.getByRole('button', { name: /Togli admin/ })).toBeEnabled()
  })
})

describe('AdminRoleButton · azioni', () => {
  it('nomina dopo la conferma e mostra l’avviso', async () => {
    const calls: Request[] = []
    server.use(adminGranted(admin, calls))
    const { user, store } = renderButton(fan)

    await user.click(screen.getByRole('button', { name: /Rendi admin/ }))
    const dialog = screen.getByRole('dialog', { name: 'Rendere admin Marco Rossi?' })
    expect(within(dialog).getByText('Marco Rossi potrà sospendere gli utenti e nascondere i contenuti.')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
    await user.click(within(dialog).getByRole('button', { name: 'Rendi admin' }))

    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].method).toBe('POST')
    expect(new URL(calls[0].url).pathname).toBe(`/api/superadmin/users/${fan.id}/admin`)
    await waitFor(() => expect(store.getState().confirmation.text).toBe('Ruolo admin assegnato.'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('revoca dopo la conferma e mostra l’avviso', async () => {
    const calls: Request[] = []
    server.use(adminRevoked(fan, calls))
    const { user, store } = renderButton(admin)

    await user.click(screen.getByRole('button', { name: /Togli admin/ }))
    const dialog = screen.getByRole('dialog', { name: 'Togliere il ruolo admin a Altro Admin?' })
    expect(
      within(dialog).getByText('Altro Admin non potrà più sospendere gli utenti né nascondere i contenuti.'),
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Togli admin' }))

    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].method).toBe('DELETE')
    expect(new URL(calls[0].url).pathname).toBe(`/api/superadmin/users/${admin.id}/admin`)
    await waitFor(() => expect(store.getState().confirmation.text).toBe('Ruolo admin revocato.'))
  })

  it('«Annulla» non chiama il backend', async () => {
    const calls: Request[] = []
    server.use(adminGranted(admin, calls))
    const { user } = renderButton(fan)

    await user.click(screen.getByRole('button', { name: /Rendi admin/ }))
    await user.click(screen.getByRole('button', { name: 'Annulla' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(calls).toHaveLength(0)
  })

  it('con un rifiuto del backend mostra l’errore nella finestra e non conferma', async () => {
    server.use(adminGrantRejected(409, 'USER_NOT_VERIFIED'))
    const { user, store } = renderButton(fan)

    await user.click(screen.getByRole('button', { name: /Rendi admin/ }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Rendi admin' }))

    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent(
      "L'utente non ha ancora verificato l'email.",
    )
    expect(store.getState().confirmation.text).toBeNull()
  })
})
