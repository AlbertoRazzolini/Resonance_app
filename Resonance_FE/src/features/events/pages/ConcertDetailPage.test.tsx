import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeConcert } from '@/test/fixtures/events'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import { concertDeleted, concertDeleteRejected, concertFound, concertRejected } from '@/test/handlers/events'
import { server } from '@/test/server'
import type { MeResponse } from '@/types/users'
import { Component as ConcertDetailPage } from './ConcertDetailPage'

// Dettaglio di un concerto ufficiale: dati dell'evento, biglietto con conferma, testo degli utenti inerte,
// copertina che sparisce se non si carica, e "non trovato" per 404 (Review Focus 6: contenuto nascosto aperto da un link).
function renderPage(id = 'c1', user?: MeResponse) {
  const store = makeStore()
  if (user) store.dispatch(sessionStarted(makeLoginResponse({ user })))
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[`/concerti/${id}`]}>
        <Routes>
          <Route path="/concerti/:id" element={<ConcertDetailPage />} />
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

// Un istante costruito dall'ora locale: l'ora scritta resta la stessa in qualunque fuso orario (23 ottobre 2026 è un venerdì)
const FRIDAY_21_30 = new Date(2026, 9, 23, 21, 30).toISOString()

describe('ConcertDetailPage · evento trovato', () => {
  it('mostra titolo, organizzatore, locale, indirizzo, data e generi', async () => {
    server.use(
      concertFound(
        makeConcert({
          id: 'c1',
          title: 'Mogwai',
          venueName: 'Teatro Puccini',
          address: 'Via delle Cascine 41, Firenze',
          eventDate: FRIDAY_21_30,
          genreTags: ['post-rock'],
          host: { id: 'h1', displayName: 'Teatro Puccini srl', avatarUrl: null },
        }),
      ),
    )

    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: 'Mogwai' })).toBeInTheDocument()
    expect(screen.getByText('Teatro Puccini', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.getByText('Via delle Cascine 41, Firenze')).toBeInTheDocument()
    expect(screen.getByText('venerdì 23 ottobre 2026 · 21:30')).toBeInTheDocument()
    expect(screen.getByText('post-rock')).toBeInTheDocument()
    expect(screen.getByText('Ufficiale')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Teatro Puccini srl' })).toHaveAttribute('href', '/utenti/h1')
  })

  it('ha il link "Eventi" per tornare all\'elenco', async () => {
    server.use(concertFound(makeConcert()))
    renderPage()

    expect(await screen.findByRole('link', { name: 'Eventi' })).toHaveAttribute('href', '/eventi')
  })

  it('con il biglietto mostra il pulsante che apre la conferma d\'uscita', async () => {
    server.use(concertFound(makeConcert({ externalTicketUrl: 'https://www.ticketone.it/evento/x' })))
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Acquista il biglietto' }))

    expect(await screen.findByRole('dialog')).toHaveTextContent('Aprirai www.ticketone.it in una nuova scheda.')
  })

  it('senza biglietto non mostra il pulsante', async () => {
    server.use(concertFound(makeConcert({ externalTicketUrl: null })))
    renderPage()
    await screen.findByRole('heading', { level: 1 })

    expect(screen.queryByRole('button', { name: 'Acquista il biglietto' })).not.toBeInTheDocument()
  })

  it('un biglietto con indirizzo "javascript:" non compare affatto', async () => {
    server.use(concertFound(makeConcert({ externalTicketUrl: 'javascript:alert(1)' })))
    renderPage()
    await screen.findByRole('heading', { level: 1 })

    expect(screen.queryByText('Acquista il biglietto')).not.toBeInTheDocument()
    expect(screen.queryByText(/javascript/)).not.toBeInTheDocument()
  })

  it('l\'HTML nella descrizione resta testo: nessun elemento creato, il codice si legge com\'è', async () => {
    server.use(concertFound(makeConcert({ description: '<b>grassetto</b><img src=x onerror=alert(1)>' })))
    renderPage()

    expect(await screen.findByText('<b>grassetto</b><img src=x onerror=alert(1)>')).toBeInTheDocument()
    expect(document.querySelector('b')).toBeNull()
    expect(document.querySelector('img[src="x"]')).toBeNull()
  })

  it('un indirizzo https nella descrizione è un link con conferma', async () => {
    server.use(concertFound(makeConcert({ description: 'Programma completo su https://example.com/programma.' })))
    renderPage()

    expect(await screen.findByRole('button', { name: 'https://example.com/programma' })).toBeInTheDocument()
  })

  it('senza descrizione non lascia un blocco vuoto', async () => {
    server.use(concertFound(makeConcert({ description: null })))
    renderPage()
    await screen.findByRole('heading', { level: 1 })

    expect(document.querySelector('.rs-event-detail__description')).toBeNull()
  })
})

describe('ConcertDetailPage · copertina', () => {
  it('con la copertina mostra l\'immagine con il titolo come testo alternativo, senza referrer', async () => {
    server.use(concertFound(makeConcert({ title: 'Mogwai', coverImageUrl: 'https://example.com/cover.jpg' })))
    renderPage()

    const image = await screen.findByRole('img', { name: 'Mogwai' })
    expect(image).toHaveAttribute('src', 'https://example.com/cover.jpg')
    expect(image).toHaveAttribute('referrerpolicy', 'no-referrer')
  })

  it('se l\'immagine non si carica sparisce', async () => {
    server.use(concertFound(makeConcert({ title: 'Mogwai', coverImageUrl: 'https://example.com/rotta.jpg' })))
    renderPage()

    fireEvent.error(await screen.findByRole('img', { name: 'Mogwai' }))

    expect(screen.queryByRole('img', { name: 'Mogwai' })).not.toBeInTheDocument()
  })

  it('senza copertina non c\'è nessuna immagine', async () => {
    server.use(concertFound(makeConcert({ coverImageUrl: null })))
    renderPage()
    await screen.findByRole('heading', { level: 1 })

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('una copertina con indirizzo "javascript:" non si usa come immagine', async () => {
    server.use(concertFound(makeConcert({ coverImageUrl: 'javascript:alert(1)' })))
    renderPage()
    await screen.findByRole('heading', { level: 1 })

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})

describe('ConcertDetailPage · non trovato e errori', () => {
  it('un 404 (nascosto o inesistente) mostra "Evento non trovato" con il ritorno agli eventi', async () => {
    server.use(concertRejected(404, 'NOT_FOUND'))
    renderPage('nascosto')

    expect(await screen.findByRole('heading', { name: 'Evento non trovato' })).toBeInTheDocument()
    expect(screen.getByText('L\'evento non esiste o non è più disponibile.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Torna agli eventi' })).toHaveAttribute('href', '/eventi')
  })

  it('un errore del server non è "non trovato": mostra l\'errore e "Riprova" che ricarica', async () => {
    server.use(concertRejected(500, 'INTERNAL_ERROR'))
    renderPage()
    expect(await screen.findByRole('button', { name: 'Riprova' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Evento non trovato' })).not.toBeInTheDocument()

    server.use(concertFound(makeConcert({ title: 'Ritorno' })))
    await userEvent.click(screen.getByRole('button', { name: 'Riprova' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Ritorno' })).toBeInTheDocument()
  })
})

describe('ConcertDetailPage · cancellazione del proprietario', () => {
  const host = { id: 'h1', displayName: 'Teatro Puccini srl', avatarUrl: null }
  const owner = makeMe({ id: 'h1', roles: ['FAN', 'HOST'] })

  it('un anonimo non vede «Cancella»', async () => {
    server.use(concertFound(makeConcert({ host })))
    renderPage()
    await screen.findByRole('heading', { level: 1 })

    expect(screen.queryByRole('button', { name: 'Cancella' })).not.toBeInTheDocument()
  })

  it('un altro utente, anche admin, non vede «Cancella»', async () => {
    server.use(concertFound(makeConcert({ host })))
    renderPage('c1', makeMe({ id: 'altro', roles: ['FAN', 'ADMIN'] }))
    await screen.findByRole('heading', { level: 1 })

    expect(screen.queryByRole('button', { name: 'Cancella' })).not.toBeInTheDocument()
  })

  it('il proprietario cancella con un motivo: DELETE, poi torna al profilo con il segno della cancellazione', async () => {
    const calls: Request[] = []
    server.use(concertFound(makeConcert({ id: 'c1', host })), concertDeleted(calls))
    renderPage('c1', owner)

    await userEvent.click(await screen.findByRole('button', { name: 'Cancella' }))
    await userEvent.type(screen.getByLabelText('Motivo (facoltativo)'), 'Annullato')
    await userEvent.click(screen.getByRole('button', { name: 'Cancella evento' }))

    expect(await screen.findByText(/Profilo con stato/)).toHaveTextContent('"eventDeleted":true')
    expect(new URL(calls[0].url).pathname).toBe('/api/official-concerts/c1')
    expect(await calls[0].json()).toEqual({ reason: 'Annullato' })
  })

  it('«Annulla» nella conferma non cancella niente', async () => {
    const calls: Request[] = []
    server.use(concertFound(makeConcert({ host })), concertDeleted(calls))
    renderPage('c1', owner)

    await userEvent.click(await screen.findByRole('button', { name: 'Cancella' }))
    await userEvent.click(screen.getByRole('button', { name: 'Annulla' }))

    expect(calls).toHaveLength(0)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('un errore del server resta nella pagina con il suo messaggio', async () => {
    server.use(concertFound(makeConcert({ host })), concertDeleteRejected(403, 'NOT_OWNER'))
    renderPage('c1', owner)

    await userEvent.click(await screen.findByRole('button', { name: 'Cancella' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancella evento' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Solo chi l'ha creato può farlo.")
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })
})
