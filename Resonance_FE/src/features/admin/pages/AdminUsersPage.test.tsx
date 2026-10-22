import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/app/routes'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeAdminUser } from '@/test/fixtures/admin'
import { makePage } from '@/test/fixtures/events'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import {
  adminUsersFound,
  adminUsersRejected,
  reactivationSucceeds,
  suspensionRejected,
  suspensionSucceeds,
} from '@/test/handlers/admin'
import { server } from '@/test/server'
import type { Role } from '@/types/users'
import { Component as AdminUsersPage } from './AdminUsersPage'

// Elenco utenti dell'area admin: ricerca con attesa, filtro di stato, numeri di pagina che ripartono da 0 quando i filtri
// cambiano, stato vuoto ed errore con «Riprova».
function renderUsersAs(roles: Role[] = ['FAN', 'ADMIN']) {
  const store = makeStore()
  store.dispatch(sessionStarted(makeLoginResponse({ user: makeMe({ roles }) })))
  const router = createMemoryRouter([{ path: ROUTES.adminUsers, element: <AdminUsersPage /> }], {
    initialEntries: [ROUTES.adminUsers],
  })
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
  return { user: userEvent.setup(), store }
}

const renderUsers = (roles?: Role[]) => renderUsersAs(roles).user

/** La riga (o scheda) dell'utente con questo nome: dentro si cercano i suoi pulsanti. */
const rowOf = (name: string) => within(screen.getByText(name).closest('tr') as HTMLElement)

const marco = makeAdminUser()
const giulia = makeAdminUser({
  id: 'a0000000-0000-0000-0000-000000000002',
  email: 'giulia@example.com',
  displayName: 'Giulia Verdi',
  roles: ['FAN', 'MUSICIAN'],
  status: 'SUSPENDED',
  emailVerified: false,
})

const paramOf = (call: Request, name: string) => new URL(call.url).searchParams.get(name)

describe('AdminUsersPage · elenco', () => {
  it('mostra nome, email, ruoli e stato di ogni utente', async () => {
    server.use(adminUsersFound([makePage([marco, giulia])]))
    renderUsers()

    expect(await screen.findByText('Marco Rossi')).toBeInTheDocument()
    expect(screen.getByText('marco@example.com')).toBeInTheDocument()
    expect(screen.getByText('Giulia Verdi')).toBeInTheDocument()
    expect(screen.getByText('Musicista')).toBeInTheDocument()
    // Lo stato e «Non verificato» servono a colpo d'occhio, anche senza aprire l'utente
    expect(screen.getByText('Sospeso')).toBeInTheDocument()
    expect(screen.getByText('Non verificato')).toBeInTheDocument()
  })

  it('chiede la prima pagina senza ricerca né stato', async () => {
    const calls: Request[] = []
    server.use(adminUsersFound([makePage([marco])], calls))
    renderUsers()

    await screen.findByText('Marco Rossi')
    expect(calls).toHaveLength(1)
    expect(paramOf(calls[0], 'page')).toBe('0')
    expect(paramOf(calls[0], 'search')).toBeNull()
    expect(paramOf(calls[0], 'status')).toBeNull()
  })

  it('cerca solo dopo che si smette di scrivere, con il testo senza spazi ai bordi', async () => {
    const calls: Request[] = []
    server.use(adminUsersFound([makePage([marco])], calls))
    const user = renderUsers()
    await screen.findByText('Marco Rossi')

    await user.type(screen.getByRole('searchbox', { name: 'Cerca' }), ' mar ')

    await waitFor(() => expect(calls).toHaveLength(2))
    expect(paramOf(calls[1], 'search')).toBe('mar')
    expect(paramOf(calls[1], 'page')).toBe('0')
  })

  it('filtra per stato', async () => {
    const calls: Request[] = []
    server.use(adminUsersFound([makePage([marco])], calls))
    const user = renderUsers()
    await screen.findByText('Marco Rossi')

    await user.selectOptions(screen.getByRole('combobox', { name: 'Stato' }), 'Sospesi')

    await waitFor(() => expect(calls).toHaveLength(2))
    expect(paramOf(calls[1], 'status')).toBe('SUSPENDED')
  })

  it('passa alla pagina scelta e riparte dalla prima quando cambia il filtro', async () => {
    const calls: Request[] = []
    server.use(
      adminUsersFound(
        [makePage([marco], { page: 0, totalPages: 3 }), makePage([giulia], { page: 1, totalPages: 3 })],
        calls,
      ),
    )
    const user = renderUsers()
    await screen.findByText('Marco Rossi')

    await user.click(screen.getByRole('button', { name: 'Pagina 2' }))
    expect(await screen.findByText('Giulia Verdi')).toBeInTheDocument()
    expect(paramOf(calls[calls.length - 1], 'page')).toBe('1')

    await user.selectOptions(screen.getByRole('combobox', { name: 'Stato' }), 'Attivi')
    await waitFor(() => expect(paramOf(calls[calls.length - 1], 'status')).toBe('ACTIVE'))
    expect(paramOf(calls[calls.length - 1], 'page')).toBe('0')
  })

  it('mostra lo stato vuoto quando nessun utente corrisponde', async () => {
    server.use(adminUsersFound([makePage([])]))
    renderUsers()

    expect(await screen.findByText('Nessun utente trovato')).toBeInTheDocument()
  })

  it('mostra l errore del backend con «Riprova»', async () => {
    server.use(adminUsersRejected(500, 'INTERNAL_ERROR'))
    renderUsers()

    expect(await screen.findByRole('alert')).toHaveTextContent('Si è verificato un problema imprevisto')
    expect(screen.getByRole('button', { name: 'Riprova' })).toBeInTheDocument()
  })
})

describe('AdminUsersPage · dettagli della sospensione', () => {
  it('mostra scadenza e motivo di un utente sospeso a tempo', async () => {
    const suspended = makeAdminUser({
      status: 'SUSPENDED',
      suspensionReason: 'Spam ripetuto',
      suspendedUntil: '2026-11-30T21:59:59Z',
    })
    server.use(adminUsersFound([makePage([suspended])]))
    renderUsers()

    await screen.findByText('Marco Rossi')
    expect(screen.getByText(/Sospeso fino al/)).toBeInTheDocument()
    expect(screen.getByText('Motivo: Spam ripetuto')).toBeInTheDocument()
  })

  it('scrive «a tempo indeterminato» quando non c’è una scadenza', async () => {
    const suspended = makeAdminUser({ status: 'SUSPENDED', suspensionReason: 'Truffa', suspendedUntil: null })
    server.use(adminUsersFound([makePage([suspended])]))
    renderUsers()

    expect(await screen.findByText('Sospeso a tempo indeterminato')).toBeInTheDocument()
  })
})

describe('AdminUsersPage · sospensione e riattivazione', () => {
  it('sospende l’utente con motivo e durata, mostra la conferma e ricarica la riga', async () => {
    // L'elenco cambia dopo la sospensione: la riga si aggiorna perché l'elenco si rilegge
    let listed = marco
    const suspended = makeAdminUser({ status: 'SUSPENDED', suspensionReason: 'Spam', suspendedUntil: '2026-11-01T10:00:00Z' })
    const calls: Request[] = []
    server.use(
      http.get('*/api/admin/users', () => HttpResponse.json(makePage([listed]))),
      http.post('*/api/admin/users/:id/suspension', async ({ request }) => {
        calls.push(request.clone())
        listed = suspended
        return HttpResponse.json(suspended)
      }),
    )
    const { user, store } = renderUsersAs()
    await screen.findByText('Marco Rossi')

    await user.click(rowOf('Marco Rossi').getByRole('button', { name: /Sospendi/ }))
    await user.type(screen.getByLabelText('Motivo'), 'Spam')
    await user.click(screen.getByRole('radio', { name: '7 giorni' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sospendi' }))

    await waitFor(() => expect(calls).toHaveLength(1))
    expect(new URL(calls[0].url).pathname).toBe(`/api/admin/users/${marco.id}/suspension`)
    expect(await calls[0].json()).toEqual({ reason: 'Spam', durationDays: 7 })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(store.getState().confirmation.text).toBe('Account sospeso.')
    expect(await screen.findByText('Motivo: Spam')).toBeInTheDocument()
    expect(rowOf('Marco Rossi').getByRole('button', { name: /Riattiva/ })).toBeInTheDocument()
  })

  it('con un rifiuto del backend lascia la finestra aperta con l’errore e non conferma', async () => {
    server.use(adminUsersFound([makePage([marco])]), suspensionRejected(403, 'INSUFFICIENT_PLATFORM_LEVEL'))
    const { user, store } = renderUsersAs()
    await screen.findByText('Marco Rossi')

    await user.click(rowOf('Marco Rossi').getByRole('button', { name: /Sospendi/ }))
    await user.type(screen.getByLabelText('Motivo'), 'Spam')
    await user.click(screen.getByRole('radio', { name: 'Indeterminata' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sospendi' }))

    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('Puoi agire solo su account')
    expect(store.getState().confirmation.text).toBeNull()
  })

  it('riattiva un utente sospeso dopo la conferma', async () => {
    const suspended = makeAdminUser({ status: 'SUSPENDED', suspensionReason: 'Spam' })
    const calls: Request[] = []
    server.use(adminUsersFound([makePage([suspended])]), reactivationSucceeds(marco, calls))
    const { user, store } = renderUsersAs()
    await screen.findByText('Marco Rossi')

    await user.click(rowOf('Marco Rossi').getByRole('button', { name: /Riattiva/ }))
    expect(screen.getByRole('dialog', { name: 'Riattivare Marco Rossi?' })).toBeInTheDocument()
    expect(calls).toHaveLength(0)
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Riattiva' }))

    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].method).toBe('DELETE')
    expect(new URL(calls[0].url).pathname).toBe(`/api/admin/users/${marco.id}/suspension`)
    await waitFor(() => expect(store.getState().confirmation.text).toBe('Account riattivato.'))
  })

  it('«Annulla» nella conferma di riattivazione non chiama il backend', async () => {
    const suspended = makeAdminUser({ status: 'SUSPENDED', suspensionReason: 'Spam' })
    const calls: Request[] = []
    server.use(adminUsersFound([makePage([suspended])]), reactivationSucceeds(marco, calls))
    const { user } = renderUsersAs()
    await screen.findByText('Marco Rossi')

    await user.click(rowOf('Marco Rossi').getByRole('button', { name: /Riattiva/ }))
    await user.click(screen.getByRole('button', { name: 'Annulla' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(calls).toHaveLength(0)
  })
})

// Regola dei livelli (progettazione, sezione 5.6) applicata dall'interfaccia: sul bersaglio vietato il pulsante c'è ma è
// spento, con la spiegazione; il backend la ripete comunque con 403 INSUFFICIENT_PLATFORM_LEVEL.
describe('AdminUsersPage · livelli di piattaforma', () => {
  const HINT = 'Puoi agire solo su account con un ruolo inferiore al tuo, e mai sul tuo.'
  const admin = makeAdminUser({ id: 'a0000000-0000-0000-0000-0000000000a1', displayName: 'Altro Admin', roles: ['FAN', 'ADMIN'] })
  const superadmin = makeAdminUser({ id: 'a0000000-0000-0000-0000-0000000000a2', displayName: 'Capo Supremo', roles: ['FAN', 'SUPERADMIN'] })
  const itself = makeAdminUser({ id: makeMe().id, displayName: 'Io Stesso', roles: ['FAN', 'ADMIN'] })

  it('un ADMIN può sospendere un utente di community', async () => {
    server.use(adminUsersFound([makePage([marco])]))
    renderUsers(['FAN', 'ADMIN'])
    await screen.findByText('Marco Rossi')

    expect(rowOf('Marco Rossi').getByRole('button', { name: /Sospendi/ })).toBeEnabled()
  })

  it.each([['Altro Admin'], ['Capo Supremo'], ['Io Stesso']])(
    'un ADMIN non può agire su %s: pulsante spento con la spiegazione',
    async (name) => {
      server.use(adminUsersFound([makePage([admin, superadmin, itself])]))
      renderUsers(['FAN', 'ADMIN'])
      await screen.findByText(name)

      const row = rowOf(name)
      expect(row.getByRole('button', { name: /Sospendi/ })).toBeDisabled()
      expect(row.getByText(HINT)).toBeInTheDocument()
    },
  )

  it('un SUPERADMIN può sospendere un ADMIN ma non un altro SUPERADMIN né se stesso', async () => {
    const me = makeAdminUser({ id: makeMe().id, displayName: 'Io Stesso', roles: ['FAN', 'SUPERADMIN'] })
    server.use(adminUsersFound([makePage([admin, superadmin, me])]))
    renderUsers(['FAN', 'SUPERADMIN'])
    await screen.findByText('Altro Admin')

    expect(rowOf('Altro Admin').getByRole('button', { name: /Sospendi/ })).toBeEnabled()
    expect(rowOf('Capo Supremo').getByRole('button', { name: /Sospendi/ })).toBeDisabled()
    expect(rowOf('Io Stesso').getByRole('button', { name: /Sospendi/ })).toBeDisabled()
  })

  it('il bersaglio con il pulsante spento non apre nessuna finestra', async () => {
    server.use(adminUsersFound([makePage([admin])]), suspensionSucceeds(admin))
    const { user } = renderUsersAs(['FAN', 'ADMIN'])
    await screen.findByText('Altro Admin')

    await user.click(rowOf('Altro Admin').getByRole('button', { name: /Sospendi/ }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
