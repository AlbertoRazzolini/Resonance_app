import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Provider } from 'react-redux'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeStore } from '@/app/store'
import type { MapProps } from '@/components/map/Map'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeConcert, makeIndieEvent, makePage } from '@/test/fixtures/events'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import {
  nearbyConcertsFound,
  nearbyConcertsRejected,
  nearbyIndieFound,
} from '@/test/handlers/events'
import { server } from '@/test/server'
import { Component as NearbyEventsPage } from './NearbyEventsPage'

// Eventi vicini: schede Ufficiali/Indie e raggio nell'indirizzo, centro (Firenze, profilo, browser), "Carica altri",
// elenco vuoto, errore con "Riprova", e il legame fra marker della mappa, fumetto e card. MapLibre non gira in jsdom:
// la mappa vera è sostituita da una finta che espone marker, zoom e fumetto.
vi.mock('@/components/map/Map', () => ({
  default: ({ markers = [], selectedId, onMarkerClick, renderPopup, zoom, radiusKm, center }: MapProps) => {
    const selected = markers.find((marker) => marker.id === selectedId)
    return (
      <div data-testid="map" data-zoom={zoom} data-radius={radiusKm} data-center={`${center.latitude},${center.longitude}`}>
        {markers.map((marker) => (
          <button key={marker.id} type="button" onClick={() => onMarkerClick?.(marker.id)}>
            marker {marker.label}
          </button>
        ))}
        {selected && renderPopup?.(selected)}
      </div>
    )
  },
}))

type Success = (position: { coords: { latitude: number; longitude: number } }) => void
function stubGeolocation(getCurrentPosition: (ok: Success) => void) {
  Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true })
}
afterEach(() => {
  // @ts-expect-error: jsdom non ha `geolocation`, si toglie lo stub per i test seguenti
  delete navigator.geolocation
})

function CurrentSearch() {
  return <output data-testid="search">{useLocation().search}</output>
}

function renderPage(initialUrl = '/eventi', user = null as ReturnType<typeof makeMe> | null) {
  const store = makeStore()
  if (user) store.dispatch(sessionStarted(makeLoginResponse({ user })))
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialUrl]}>
        <NearbyEventsPage />
        <CurrentSearch />
      </MemoryRouter>
    </Provider>,
  )
  return userEvent.setup()
}

const params = (request: Request) => Object.fromEntries(new URL(request.url).searchParams)
const FLORENCE = { lat: '43.7696', lng: '11.2558' }

describe('NearbyEventsPage · ricerca', () => {
  it('parte da Firenze a 15 km con la scheda Ufficiali e mostra i concerti trovati', async () => {
    const calls: Request[] = []
    server.use(nearbyConcertsFound([makePage([makeConcert({ title: 'Mogwai' }), makeConcert({ id: 'c2', title: 'Soviet' })])], calls))

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Mogwai' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Soviet' })).toBeInTheDocument()
    expect(params(calls[0])).toEqual({ ...FLORENCE, radiusKm: '15', page: '0' })
  })

  it('la scheda Indie cerca gli indie event, e il clic sulla scheda la mette nell\'indirizzo', async () => {
    const indieCalls: Request[] = []
    server.use(
      nearbyConcertsFound([makePage([makeConcert({ title: 'Mogwai' })])]),
      nearbyIndieFound([makePage([makeIndieEvent({ title: 'Gazebo' })])], indieCalls),
    )
    const user = renderPage()
    await screen.findByRole('heading', { name: 'Mogwai' })

    await user.click(screen.getByRole('link', { name: 'Indie' }))

    expect(await screen.findByRole('heading', { name: 'Gazebo' })).toBeInTheDocument()
    expect(screen.getByTestId('search')).toHaveTextContent('tipo=indie')
    expect(params(indieCalls[0])).toMatchObject({ radiusKm: '15' })
  })

  it('un indirizzo con ?tipo=indie&raggio=50 apre già la scheda Indie a 50 km', async () => {
    const calls: Request[] = []
    server.use(nearbyIndieFound([makePage([makeIndieEvent()])], calls))

    renderPage('/eventi?tipo=indie&raggio=50')

    await screen.findByRole('heading', { name: 'Underground night' })
    expect(params(calls[0])).toMatchObject({ radiusKm: '50' })
    expect(screen.getByRole('button', { name: '50 km' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('cambiando raggio cerca di nuovo con il nuovo raggio, tiene la scheda e lo scrive nell\'indirizzo', async () => {
    const calls: Request[] = []
    server.use(nearbyIndieFound([makePage([makeIndieEvent()])], calls))
    const user = renderPage('/eventi?tipo=indie')
    await screen.findByRole('heading', { name: 'Underground night' })

    await user.click(screen.getByRole('button', { name: '25 km' }))

    await waitFor(() => expect(calls).toHaveLength(2))
    expect(params(calls[1])).toMatchObject({ radiusKm: '25', page: '0' })
    expect(screen.getByTestId('search')).toHaveTextContent('raggio=25')
    expect(screen.getByTestId('search')).toHaveTextContent('tipo=indie')
  })

  it('un raggio non valido nell\'indirizzo torna a 15 km', async () => {
    const calls: Request[] = []
    server.use(nearbyConcertsFound([makePage([makeConcert()])], calls))

    renderPage('/eventi?raggio=33')

    await screen.findByRole('heading', { name: 'Soviet Soviet + Leatherette' })
    expect(params(calls[0]).radiusKm).toBe('15')
  })

  it('scrive quanti eventi ci sono entro il raggio, al singolare e al plurale', async () => {
    server.use(nearbyConcertsFound([makePage([makeConcert()], { totalElements: 1 })]))
    renderPage()
    expect(await screen.findByText('1 evento entro 15 km')).toBeInTheDocument()
  })

  it('il conteggio usa il totale di tutte le pagine, non quelle caricate', async () => {
    server.use(nearbyConcertsFound([makePage([makeConcert()], { totalElements: 37, totalPages: 2 })]))
    renderPage()
    expect(await screen.findByText('37 eventi entro 15 km')).toBeInTheDocument()
  })
})

describe('NearbyEventsPage · Carica altri', () => {
  it('carica la pagina successiva e la accoda, poi il pulsante sparisce', async () => {
    const calls: Request[] = []
    const pages = [
      makePage([makeConcert({ id: 'c1', title: 'Primo' })], { totalPages: 2, totalElements: 2 }),
      makePage([makeConcert({ id: 'c2', title: 'Secondo' })], { page: 1, totalPages: 2, totalElements: 2 }),
    ]
    server.use(nearbyConcertsFound(pages, calls))
    const user = renderPage()
    await screen.findByRole('heading', { name: 'Primo' })

    await user.click(screen.getByRole('button', { name: 'Carica altri' }))

    expect(await screen.findByRole('heading', { name: 'Secondo' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Primo' })).toBeInTheDocument()
    expect(params(calls[1]).page).toBe('1')
    expect(screen.queryByRole('button', { name: 'Carica altri' })).not.toBeInTheDocument()
  })

  it('con una sola pagina non c\'è "Carica altri"', async () => {
    server.use(nearbyConcertsFound([makePage([makeConcert()])]))
    renderPage()
    await screen.findByRole('heading', { name: 'Soviet Soviet + Leatherette' })

    expect(screen.queryByRole('button', { name: 'Carica altri' })).not.toBeInTheDocument()
  })
})

describe('NearbyEventsPage · vuoto e errore', () => {
  it('senza concerti dice che non ce ne sono entro il raggio e suggerisce di allargarlo', async () => {
    server.use(nearbyConcertsFound([makePage([])]))
    renderPage()

    expect(await screen.findByText('Nessun evento ufficiale entro 15 km')).toBeInTheDocument()
    expect(screen.getByText('Prova ad allargare il raggio.')).toBeInTheDocument()
  })

  it('senza indie event usa il testo degli indie', async () => {
    server.use(nearbyIndieFound([makePage([])]))
    renderPage('/eventi?tipo=indie&raggio=25')

    expect(await screen.findByText('Nessun indie event entro 25 km')).toBeInTheDocument()
  })

  it('con un errore del server mostra l\'avviso e "Riprova" cerca di nuovo', async () => {
    const calls: Request[] = []
    server.use(nearbyConcertsRejected(500, 'INTERNAL_ERROR', calls))
    const user = renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('Si è verificato un problema imprevisto')

    server.use(nearbyConcertsFound([makePage([makeConcert({ title: 'Ritorno' })])], calls))
    await user.click(screen.getByRole('button', { name: 'Riprova' }))

    expect(await screen.findByRole('heading', { name: 'Ritorno' })).toBeInTheDocument()
  })
})

describe('NearbyEventsPage · centro', () => {
  it('da Firenze avvisa che mostra gli eventi vicino a Firenze e offre la posizione', async () => {
    server.use(nearbyConcertsFound([makePage([makeConcert()])]))
    renderPage()

    expect(await screen.findByText(/Stai vedendo gli eventi vicino a Firenze/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Usa la mia posizione' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Firenze e dintorni' })).toBeInTheDocument()
  })

  it('con le coordinate del profilo cerca da lì, senza avviso su Firenze', async () => {
    const calls: Request[] = []
    server.use(nearbyConcertsFound([makePage([makeConcert()])], calls))

    renderPage('/eventi', makeMe({ latitude: 44.4949, longitude: 11.3426 }))

    await screen.findByRole('heading', { name: 'Soviet Soviet + Leatherette' })
    expect(params(calls[0])).toMatchObject({ lat: '44.4949', lng: '11.3426' })
    expect(screen.queryByText(/Stai vedendo gli eventi vicino a Firenze/)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Vicino al tuo profilo' })).toBeInTheDocument()
  })

  it('"Usa la mia posizione" cerca dalla posizione del browser e toglie l\'avviso', async () => {
    const calls: Request[] = []
    server.use(nearbyConcertsFound([makePage([makeConcert()])], calls))
    stubGeolocation((ok) => ok({ coords: { latitude: 45.4642, longitude: 9.19 } }))
    const user = renderPage()
    await screen.findByRole('heading', { name: 'Soviet Soviet + Leatherette' })

    await user.click(screen.getByRole('button', { name: 'Usa la mia posizione' }))

    await waitFor(() => expect(params(calls[calls.length - 1])).toMatchObject({ lat: '45.4642', lng: '9.19' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Vicino a te' })).toBeInTheDocument()
    expect(screen.queryByText(/Stai vedendo gli eventi vicino a Firenze/)).not.toBeInTheDocument()
  })

  it('con il permesso negato lo dice e resta sul centro di prima', async () => {
    server.use(nearbyConcertsFound([makePage([makeConcert()])]))
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: (_ok: unknown, fail: (e: { code: number; PERMISSION_DENIED: number }) => void) =>
          fail({ code: 1, PERMISSION_DENIED: 1 }),
      },
      configurable: true,
    })
    const user = renderPage()
    await screen.findByRole('heading', { name: 'Soviet Soviet + Leatherette' })

    await user.click(screen.getByRole('button', { name: 'Usa la mia posizione' }))

    expect(await screen.findByText('Permesso negato: abilitalo dalle impostazioni del browser.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Firenze e dintorni' })).toBeInTheDocument()
  })
})

describe('NearbyEventsPage · mappa', () => {
  it('prima dei risultati la mappa mostra l\'Italia dall\'alto, poi si avvicina al raggio', async () => {
    // La risposta resta in attesa finché il test non la libera: così "prima dei risultati" non dipende dai tempi
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.get('*/api/official-concerts/nearby', async () => {
        await gate
        return HttpResponse.json(makePage([makeConcert()]))
      }),
    )
    renderPage()

    expect(await screen.findByTestId('map')).toHaveAttribute('data-zoom', '5')
    release()
    await screen.findByRole('heading', { name: 'Soviet Soviet + Leatherette' })
    await waitFor(() => expect(Number(screen.getByTestId('map').getAttribute('data-zoom'))).toBeGreaterThan(9))
  })

  it('con un errore la mappa resta sull\'Italia', async () => {
    server.use(nearbyConcertsRejected(500, 'INTERNAL_ERROR'))
    renderPage()
    await screen.findByRole('button', { name: 'Riprova' })

    expect(screen.getByTestId('map')).toHaveAttribute('data-zoom', '5')
  })

  it('disegna il cerchio del raggio scelto', async () => {
    server.use(nearbyConcertsFound([makePage([makeConcert()])]))
    renderPage('/eventi?raggio=50')

    expect(await screen.findByTestId('map')).toHaveAttribute('data-radius', '50')
  })

  it('il clic su un marker apre il fumetto con titolo, distanza e link, e evidenzia la card', async () => {
    server.use(nearbyConcertsFound([makePage([makeConcert({ id: 'c1', title: 'Mogwai', distanceKm: 7.1 })])]))
    const user = renderPage()
    await screen.findByRole('heading', { name: 'Mogwai' })

    await user.click(screen.getByRole('button', { name: 'marker Mogwai' }))

    const popup = screen.getByTestId('map')
    expect(within(popup).getByText('Mogwai')).toBeInTheDocument()
    expect(within(popup).getByText('7,1 km')).toBeInTheDocument()
    expect(within(popup).getByRole('link', { name: /Dettagli/ })).toHaveAttribute('href', '/concerti/c1')
    expect(screen.getByRole('article')).toHaveAttribute('aria-current', 'true')
  })
})
