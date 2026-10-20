import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { makeIndieEvent } from '@/test/fixtures/events'
import { indieEventFound, indieEventRejected } from '@/test/handlers/events'
import { server } from '@/test/server'
import { Component as IndieEventDetailPage } from './IndieEventDetailPage'

// Dettaglio di un indie event: musicista, ingresso gratuito o a pagamento, etichetta Bozza per il proprietario,
// "non trovato" per 404 (una bozza di un altro utente è un 404: Review Focus 6).
function renderPage(id = 'e1') {
  render(
    <Provider store={makeStore()}>
      <MemoryRouter initialEntries={[`/indie/${id}`]}>
        <Routes>
          <Route path="/indie/:id" element={<IndieEventDetailPage />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  )
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
