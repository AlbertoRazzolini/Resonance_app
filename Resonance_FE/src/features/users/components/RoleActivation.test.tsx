import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/app/routes'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import { roleActivated, roleActivationRejected } from '@/test/handlers/users'
import { server } from '@/test/server'
import type { Role } from '@/types/users'
import { RoleActivation } from './RoleActivation'

// Attivazione di MUSICIAN e HOST: ogni ruolo spiega cosa sblocca e non si può disattivare; il pulsante c'è solo finché
// il ruolo manca (poi resta il collegamento a ciò che si può pubblicare).
function renderActivation(roles: Role[]) {
  const store = makeStore()
  store.dispatch(sessionStarted(makeLoginResponse({ user: makeMe({ roles }) })))
  render(
    <Provider store={store}>
      <MemoryRouter>
        <RoleActivation />
      </MemoryRouter>
    </Provider>,
  )
  return { store, user: userEvent.setup() }
}

describe('RoleActivation', () => {
  it('a un FAN offre entrambi i ruoli, con la spiegazione e l\'avviso che non si disattivano', () => {
    renderActivation(['FAN'])

    expect(screen.getByRole('heading', { name: 'Musicista' })).toBeInTheDocument()
    expect(
      screen.getByText('Pubblica indie event e annunci per cercare altri musicisti.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Diventa musicista' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Host' })).toBeInTheDocument()
    expect(screen.getByText('Pubblica i concerti del tuo locale.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Diventa host' })).toBeInTheDocument()
    expect(screen.getAllByText('Non si può disattivare.')).toHaveLength(2)
  })

  it('con il ruolo di musicista nasconde il suo pulsante e mostra il collegamento a ciò che si può pubblicare', () => {
    renderActivation(['FAN', 'MUSICIAN'])

    expect(screen.queryByRole('button', { name: 'Diventa musicista' })).not.toBeInTheDocument()
    expect(screen.getByText('Sei musicista')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pubblica un indie event' })).toHaveAttribute(
      'href',
      ROUTES.newIndieEvent,
    )
    expect(screen.getByRole('button', { name: 'Diventa host' })).toBeInTheDocument()
  })

  it("con il ruolo di host nasconde il suo pulsante e mostra il collegamento a ciò che si può pubblicare", () => {
    renderActivation(['FAN', 'HOST'])

    expect(screen.queryByRole('button', { name: 'Diventa host' })).not.toBeInTheDocument()
    expect(screen.getByText('Sei host')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pubblica un concerto' })).toHaveAttribute(
      'href',
      ROUTES.newConcert,
    )
    expect(screen.getByRole('button', { name: 'Diventa musicista' })).toBeInTheDocument()
  })

  it('con entrambi i ruoli non resta nessun pulsante e nessun avviso «non si disattiva»', () => {
    renderActivation(['FAN', 'MUSICIAN', 'HOST'])

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByText('Non si può disattivare.')).not.toBeInTheDocument()
  })

  it("un ruolo non implica l'altro: l'host non diventa musicista", () => {
    renderActivation(['FAN', 'HOST'])

    expect(screen.queryByText('Sei musicista')).not.toBeInTheDocument()
  })

  it('«Diventa musicista» chiama POST /roles/musician e aggiorna i ruoli nella sessione e nella pagina', async () => {
    const calls: Request[] = []
    server.use(roleActivated(makeMe({ roles: ['FAN', 'MUSICIAN'] }), calls))
    const { user, store } = renderActivation(['FAN'])

    await user.click(screen.getByRole('button', { name: 'Diventa musicista' }))

    expect(await screen.findByText('Sei musicista')).toBeInTheDocument()
    expect(new URL(calls[0].url).pathname).toBe('/api/users/me/roles/musician')
    expect(calls[0].method).toBe('POST')
    expect(store.getState().auth.user?.roles).toEqual(['FAN', 'MUSICIAN'])
    expect(screen.queryByRole('button', { name: 'Diventa musicista' })).not.toBeInTheDocument()
  })

  it('«Diventa host» chiama POST /roles/host', async () => {
    const calls: Request[] = []
    server.use(roleActivated(makeMe({ roles: ['FAN', 'HOST'] }), calls))
    const { user } = renderActivation(['FAN'])

    await user.click(screen.getByRole('button', { name: 'Diventa host' }))

    expect(await screen.findByText('Sei host')).toBeInTheDocument()
    expect(new URL(calls[0].url).pathname).toBe('/api/users/me/roles/host')
  })

  it('durante la richiesta i pulsanti sono spenti (niente doppio invio)', async () => {
    server.use(
      http.post('*/api/users/me/roles/:role', async () => {
        await delay(100)
        return HttpResponse.json(makeMe({ roles: ['FAN', 'MUSICIAN'] }))
      }),
    )
    const { user } = renderActivation(['FAN'])

    await user.click(screen.getByRole('button', { name: 'Diventa musicista' }))

    expect(screen.getByRole('button', { name: 'Diventa musicista' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Diventa host' })).toBeDisabled()
    await waitFor(() => expect(screen.getByText('Sei musicista')).toBeInTheDocument())
  })

  it('se il server rifiuta mostra l\'errore e il pulsante resta', async () => {
    server.use(roleActivationRejected(500, 'INTERNAL_ERROR'))
    const { user, store } = renderActivation(['FAN'])

    await user.click(screen.getByRole('button', { name: 'Diventa host' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('problema imprevisto')
    expect(screen.getByRole('button', { name: 'Diventa host' })).toBeEnabled()
    expect(store.getState().auth.user?.roles).toEqual(['FAN'])
  })
})
