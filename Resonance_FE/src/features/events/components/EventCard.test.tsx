import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { makeConcert, makeIndieEvent } from '@/test/fixtures/events'
import { EventCard } from './EventCard'

// Card di un evento nell'elenco: titolo, locale, data in ora locale, distanza, generi, tipo e link al dettaglio.
// Serve lo store: «Nascondi» (solo admin) legge la sessione; «Nascondi» stesso lo prova `HideOnContent.test`.
const renderCard = (ui: React.ReactElement) =>
  render(
    <Provider store={makeStore()}>
      <MemoryRouter>{ui}</MemoryRouter>
    </Provider>,
  )

// Un istante costruito dall'ora locale: l'ora scritta resta la stessa in qualunque fuso orario (23 ottobre 2026 è un venerdì)
const FRIDAY_21_30 = new Date(2026, 9, 23, 21, 30).toISOString()

describe('EventCard · concerto ufficiale', () => {
  it('mostra titolo, locale, data, distanza e generi', () => {
    renderCard(
      <EventCard
        kind="official"
        event={makeConcert({ title: 'Mogwai', venueName: 'Teatro Puccini', eventDate: FRIDAY_21_30, distanceKm: 7.1, genreTags: ['post-rock', 'instrumental'] })}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Mogwai' })).toBeInTheDocument()
    expect(screen.getByText('Teatro Puccini')).toBeInTheDocument()
    expect(screen.getByText('ven 23 ott · 21:30')).toBeInTheDocument()
    expect(screen.getByText('7,1 km')).toBeInTheDocument()
    expect(screen.getByText('post-rock')).toBeInTheDocument()
    expect(screen.getByText('instrumental')).toBeInTheDocument()
  })

  it('ha l\'etichetta "Ufficiale" e il link "Dettagli" verso il concerto', () => {
    renderCard(<EventCard kind="official" event={makeConcert({ id: 'c1' })} />)

    expect(screen.getByText('Ufficiale')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Dettagli/ })).toHaveAttribute('href', '/concerti/c1')
  })

  it('senza distanza (null) non scrive nessuna distanza', () => {
    renderCard(<EventCard kind="official" event={makeConcert({ distanceKm: null })} />)

    expect(screen.queryByText(/ km$| m$/)).not.toBeInTheDocument()
  })
})

describe('EventCard · indie event', () => {
  it('ha l\'etichetta "Indie" e il link verso l\'indie event', () => {
    renderCard(<EventCard kind="indie" event={makeIndieEvent({ id: 'e1' })} />)

    expect(screen.getByText('Indie')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Dettagli/ })).toHaveAttribute('href', '/indie/e1')
  })

  it('un evento gratuito ha l\'etichetta "Gratis", uno a pagamento no', () => {
    const { unmount } = renderCard(<EventCard kind="indie" event={makeIndieEvent({ isFree: true })} />)
    expect(screen.getByText('Gratis')).toBeInTheDocument()
    unmount()

    renderCard(<EventCard kind="indie" event={makeIndieEvent({ isFree: false })} />)
    expect(screen.queryByText('Gratis')).not.toBeInTheDocument()
  })
})

describe('EventCard · evidenziata', () => {
  it('la card del marker aperto è segnata con aria-current', () => {
    renderCard(<EventCard kind="official" event={makeConcert()} highlighted />)

    expect(screen.getByRole('article')).toHaveAttribute('aria-current', 'true')
  })

  it('le altre card non lo sono', () => {
    renderCard(<EventCard kind="official" event={makeConcert()} />)

    expect(screen.getByRole('article')).not.toHaveAttribute('aria-current')
  })
})
