import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeIndieEvent } from '@/test/fixtures/events'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import { indieDeleted, indieEventFound, indieEventRejected } from '@/test/handlers/events'
import { server } from '@/test/server'
import type { MeResponse } from '@/types/users'
import { Component as IndieEventDetailPage } from './IndieEventDetailPage'

// Dettaglio di un indie event: musicista, ingresso gratuito o a pagamento, etichetta Bozza per il proprietario,
// "non trovato" per 404 (una bozza di un altro utente è un 404: Review Focus 6).
function renderPage(id = 'e1', user?: MeResponse) {
  const store = makeStore()
  if (user) store.dispatch(sessionStarted(makeLoginResponse({ user })))
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[`/indie/${id}`]}>
        <Routes>
          <Route path="/indie/:id" element={<IndieEventDetailPage />} />
          <Route path="/profilo" element={<ProfileProbe />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  )
}

/** Mostra a cosa è arrivata la navigazione dopo una cancellazione, e lo stato passato. */
function ProfileProbe() {
  const location = useLocation()
  return <p>Profilo con stato {JSON.stringify(location.state)}</p>
}

describe('IndieEventDetailPage', () => {
  it('mostra titolo, musicista con il link al profilo e l\'etichetta "Indie"', async () => {
    server.use(
      indieEventFound(
        makeIndieEvent({ title: 'Underground night', musician: { id: 'm1', displayName: 'Gazebo Penguins', avatarUrl: null } }),
      ),
    )

    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: 'Underground night' })).toBeInTheDocument()
    expect(screen.getByText('Indie')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Gazebo Penguins' })).toHaveAttribute('href', '/utenti/m1')
  })

  it('un evento gratuito dice "Ingresso gratuito"', async () => {
    server.use(indieEventFound(makeIndieEvent({ isFree: true })))
    renderPage()

    expect(await screen.findByText('Ingresso gratuito')).toBeInTheDocument()
  })

  it('un evento a pagamento dice "Ingresso a pagamento"', async () => {
    server.use(indieEventFound(makeIndieEvent({ isFree: false })))
    renderPage()

    expect(await screen.findByText('Ingresso a pagamento')).toBeInTheDocument()
  })

  it('una bozza (la vede solo il proprietario) ha l\'etichetta "Bozza"', async () => {
    server.use(indieEventFound(makeIndieEvent({ status: 'DRAFT' })))
    renderPage()

    expect(await screen.findByText('Bozza')).toBeInTheDocument()
  })

  it('un evento pubblicato non ha l\'etichetta "Bozza"', async () => {
    server.use(indieEventFound(makeIndieEvent({ status: 'PUBLISHED' })))
    renderPage()
    await screen.findByRole('heading', { level: 1 })

    expect(screen.queryByText('Bozza')).not.toBeInTheDocument()
  })

  it('un 404 (bozza di un altro, nascosto, inesistente) mostra "Evento non trovato"', async () => {
    server.use(indieEventRejected(404, 'NOT_FOUND'))
    renderPage('bozza-altrui')

    expect(await screen.findByRole('heading', { name: 'Evento non trovato' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Torna agli eventi' })).toHaveAttribute('href', '/eventi')
  })
})

describe('IndieEventDetailPage · cancellazione del proprietario', () => {
  const musician = { id: 'm1', displayName: 'Gazebo Penguins', avatarUrl: null }

  it('il proprietario vede «Cancella», anche su una bozza, e cancella tornando al profilo', async () => {
    const calls: Request[] = []
    server.use(indieEventFound(makeIndieEvent({ id: 'e1', musician, status: 'DRAFT' })), indieDeleted(calls))
    renderPage('e1', makeMe({ id: 'm1', roles: ['FAN', 'MUSICIAN'] }))

    await userEvent.click(await screen.findByRole('button', { name: 'Cancella' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancella evento' }))

    expect(await screen.findByText(/Profilo con stato/)).toHaveTextContent('"eventDeleted":true')
    expect(new URL(calls[0].url).pathname).toBe('/api/indie-events/e1')
    expect(await calls[0].text()).toBe('')
  })

  it('un anonimo non vede «Cancella»', async () => {
    server.use(indieEventFound(makeIndieEvent({ musician })))
    renderPage()
    await screen.findByRole('heading', { level: 1 })

    expect(screen.queryByRole('button', { name: 'Cancella' })).not.toBeInTheDocument()
  })

  it('un altro utente loggato non vede «Cancella»', async () => {
    server.use(indieEventFound(makeIndieEvent({ musician })))
    renderPage('e1', makeMe({ id: 'altro', roles: ['FAN', 'MUSICIAN'] }))
    await screen.findByRole('heading', { level: 1 })

    expect(screen.queryByRole('button', { name: 'Cancella' })).not.toBeInTheDocument()
  })
})

describe('IndieEventDetailPage · contatto dell’organizzatore', () => {
  const musician = { id: 'm1', displayName: 'Gazebo Penguins', avatarUrl: null }
  const future = new Date(Date.now() + 30 * 86_400_000).toISOString()

  it('un altro utente vede «Contatta l’organizzatore» sotto il dettaglio', async () => {
    server.use(indieEventFound(makeIndieEvent({ musician, eventDate: future })))
    renderPage('e1', makeMe({ id: 'altro' }))

    expect(await screen.findByRole('heading', { name: "Contatta l'organizzatore" })).toBeInTheDocument()
  })

  it('il proprietario non lo vede: non può contattare se stesso', async () => {
    server.use(indieEventFound(makeIndieEvent({ musician, eventDate: future })))
    renderPage('e1', makeMe({ id: 'm1', roles: ['FAN', 'MUSICIAN'] }))
    await screen.findByRole('heading', { level: 1 })

    expect(screen.queryByRole('heading', { name: "Contatta l'organizzatore" })).not.toBeInTheDocument()
  })
})
