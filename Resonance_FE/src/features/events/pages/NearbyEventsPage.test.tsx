import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Provider } from 'react-redux'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeStore } from '@/app/store'
import type { MapProps } from '@/components/map/Map'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeConcert, makeIndieEvent, makePage } from '@/test/fixtures/events'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import {
  nearbyConcertsFound,
  nearbyConcertsRejected,
  nearbyIndieFound,
  nearbyIndieRejected,
} from '@/test/handlers/events'
import { server } from '@/test/server'
import { Component as NearbyEventsPage } from './NearbyEventsPage'

// Eventi vicini: schede Eventi/Ufficiali/Indie e raggio nell'indirizzo, centro (Firenze, profilo, browser), "Carica altri",
// elenco vuoto, errore con "Riprova" (anche di un solo tipo), e il legame fra marker della mappa, fumetto e card. La
// scheda Eventi mostra i due tipi insieme; negli altri test gli indie event sono vuoti, se non diversamente detto.
// MapLibre non gira in jsdom: la mappa vera è sostituita da una finta che espone marker, zoom e fumetto.
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
beforeEach(() => server.use(nearbyIndieFound([makePage([])])))
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
  it('parte da Firenze a 15 km con la scheda Eventi e mostra insieme concerti e indie event', async () => {
    const calls: Request[] = []
    const indieCalls: Request[] = []
    server.use(
      nearbyConcertsFound([makePage([makeConcert({ title: 'Mogwai' }), makeConcert({ id: 'c2', title: 'Soviet' })])], calls),
      nearbyIndieFound([makePage([makeIndieEvent({ title: 'Gazebo' })])], indieCalls),
    )

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Mogwai' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Soviet' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Gazebo' })).toBeInTheDocument()
    expect(params(calls[0])).toEqual({ ...FLORENCE, radiusKm: '15', page: '0' })
    expect(params(indieCalls[0])).toEqual({ ...FLORENCE, radiusKm: '15', page: '0' })
    expect(screen.getByRole('link', { name: 'Eventi' })).toHaveAttribute('aria-current', 'page')
  })

  it('nella scheda Eventi l\'elenco è dal più vicino, concerti e indie mescolati', async () => {
    server.use(
      nearbyConcertsFound([makePage([makeConcert({ title: 'Lontano', distanceKm: 9 })])]),
      nearbyIndieFound([makePage([makeIndieEvent({ title: 'Vicino', distanceKm: 2 })])]),
    )

    renderPage()

    await screen.findByRole('heading', { name: 'Lontano' })
    const titles = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
    expect(titles).toEqual(['Vicino', 'Lontano'])
  })

  it('la scheda Ufficiali cerca solo i concerti e la sceglie nell\'indirizzo', async () => {
    const indieCalls: Request[] = []
    server.use(
      nearbyConcertsFound([makePage([makeConcert({ title: 'Mogwai' })])]),
      nearbyIndieFound([makePage([makeIndieEvent({ title: 'Gazebo' })])], indieCalls),
    )
    const user = renderPage('/eventi?tipo=ufficiali')

    expect(await screen.findByRole('heading', { name: 'Mogwai' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ufficiali' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('heading', { name: 'Gazebo' })).not.toBeInTheDocument()
    expect(indieCalls).toHaveLength(0)

    await user.click(screen.getByRole('link', { name: 'Eventi' }))
    expect(await screen.findByRole('heading', { name: 'Gazebo' })).toBeInTheDocument()
    expect(screen.getByTestId('search')).toHaveTextContent(/^$/)
  })

  it('il clic su Ufficiali scrive tipo=ufficiali nell\'indirizzo', async () => {
    server.use(nearbyConcertsFound([makePage([makeConcert({ title: 'Mogwai' })])]))
    const user = renderPage()
    await screen.findByRole('heading', { name: 'Mogwai' })

    await user.click(screen.getByRole('link', { name: 'Ufficiali' }))

    expect(screen.getByTestId('search')).toHaveTextContent('tipo=ufficiali')
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
  it('senza eventi dice che non ce ne sono entro il raggio e suggerisce di allargarlo', async () => {
    server.use(nearbyConcertsFound([makePage([])]), nearbyIndieFound([makePage([])]))
    renderPage()

    expect(await screen.findByText('Nessun evento entro 15 km')).toBeInTheDocument()
    expect(screen.getByText('Prova ad allargare il raggio.')).toBeInTheDocument()
  })

  it('nella scheda Ufficiali senza concerti usa il testo dei concerti', async () => {
    server.use(nearbyConcertsFound([makePage([])]))
    renderPage('/eventi?tipo=ufficiali')

    expect(await screen.findByText('Nessun evento ufficiale entro 15 km')).toBeInTheDocument()
  })

  it('senza indie event usa il testo degli indie', async () => {
    server.use(nearbyIndieFound([makePage([])]))
    renderPage('/eventi?tipo=indie&raggio=25')

    expect(await screen.findByText('Nessun indie event entro 25 km')).toBeInTheDocument()
  })

  it('con un errore del server mostra l\'avviso e "Riprova" cerca di nuovo', async () => {
    const calls: Request[] = []
    server.use(nearbyConcertsRejected(500, 'INTERNAL_ERROR', calls))
    const user = renderPage('/eventi?tipo=ufficiali')
    expect(await screen.findByRole('alert')).toHaveTextContent('Si è verificato un problema imprevisto')

    server.use(nearbyConcertsFound([makePage([makeConcert({ title: 'Ritorno' })])], calls))
    await user.click(screen.getByRole('button', { name: 'Riprova' }))

    expect(await screen.findByRole('heading', { name: 'Ritorno' })).toBeInTheDocument()
  })

  it('nella scheda Eventi, se un tipo non si carica, l\'altro resta e l\'avviso dice quale manca', async () => {
    const calls: Request[] = []
    server.use(
      nearbyConcertsRejected(500, 'INTERNAL_ERROR', calls),
      nearbyIndieFound([makePage([makeIndieEvent({ title: 'Gazebo' })], { totalElements: 1 })]),
    )
    const user = renderPage()

    expect(await screen.findByRole('heading', { name: 'Gazebo' })).toBeInTheDocument()
    expect(await screen.findByText('Gli eventi ufficiali non si sono caricati.')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Si è verificato un problema imprevisto')
    expect(screen.queryByText('Nessun evento entro 15 km')).not.toBeInTheDocument()

    server.use(nearbyConcertsFound([makePage([makeConcert({ title: 'Ritorno' })])], calls))
    await user.click(screen.getByRole('button', { name: /Riprova/ }))

    expect(await screen.findByRole('heading', { name: 'Ritorno' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Gazebo' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('nella scheda Eventi, se falliscono entrambi, ci sono due avvisi con il loro "Riprova"', async () => {
    server.use(nearbyConcertsRejected(500, 'INTERNAL_ERROR'), nearbyIndieRejected(500, 'INTERNAL_ERROR'))
    renderPage()

    expect(await screen.findByText('Gli eventi ufficiali non si sono caricati.')).toBeInTheDocument()
    expect(await screen.findByText('Gli indie event non si sono caricati.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Riprova/ })).toHaveLength(2)
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
    renderPage('/eventi?tipo=ufficiali')
    await screen.findByRole('button', { name: 'Riprova' })

    expect(screen.getByTestId('map')).toHaveAttribute('data-zoom', '5')
  })

  it('se fallisce un tipo solo la mappa si avvicina comunque, con i marker dell\'altro', async () => {
    server.use(nearbyConcertsRejected(500, 'INTERNAL_ERROR'), nearbyIndieFound([makePage([makeIndieEvent({ title: 'Gazebo' })])]))
    renderPage()

    await screen.findByRole('button', { name: 'marker Gazebo' })
    await waitFor(() => expect(Number(screen.getByTestId('map').getAttribute('data-zoom'))).toBeGreaterThan(9))
  })

  it('nella scheda Eventi la mappa ha i marker dei due tipi, e il fumetto di un indie event porta al suo dettaglio', async () => {
    server.use(
      nearbyConcertsFound([makePage([makeConcert({ id: 'c1', title: 'Mogwai' })])]),
      nearbyIndieFound([makePage([makeIndieEvent({ id: 'e1', title: 'Gazebo', distanceKm: 4.4 })])]),
    )
    const user = renderPage()
    await screen.findByRole('button', { name: 'marker Mogwai' })

    await user.click(await screen.findByRole('button', { name: 'marker Gazebo' }))

    const popup = screen.getByTestId('map')
    expect(within(popup).getByRole('link', { name: /Dettagli/ })).toHaveAttribute('href', '/indie/e1')
    expect(within(popup).getByText('4,4 km')).toBeInTheDocument()
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

// Pulsanti di pubblicazione nella riga del titolo (decisione dello studente, 25 ottobre): solo per chi ha il ruolo giusto,
// host per i concerti ufficiali e musicista per gli indie event; portano alle pagine di creazione (nessuna finestra).
describe('NearbyEventsPage · pubblicare', () => {
  beforeEach(() => server.use(nearbyConcertsFound([makePage([])])))

  const inTitleRow = () => (screen.getByRole('heading', { level: 1, name: 'Eventi vicini' }).parentElement as HTMLElement)

  it('un anonimo non vede nessun pulsante di pubblicazione', async () => {
    renderPage('/eventi')
    await screen.findByText(/Nessun evento/)

    expect(screen.queryByRole('link', { name: /^Pubblica/ })).not.toBeInTheDocument()
  })

  it('un fan senza ruoli speciali non li vede', async () => {
    renderPage('/eventi', makeMe({ roles: ['FAN'] }))
    await screen.findByText(/Nessun evento/)

    expect(screen.queryByRole('link', { name: /^Pubblica/ })).not.toBeInTheDocument()
  })

  it('un host vede solo «Pubblica concerto», verso la pagina di creazione', async () => {
    renderPage('/eventi', makeMe({ roles: ['FAN', 'HOST'] }))
    await screen.findByText(/Nessun evento/)

    expect(within(inTitleRow()).getByRole('link', { name: 'Pubblica concerto' })).toHaveAttribute('href', '/concerti/nuovo')
    expect(screen.queryByRole('link', { name: 'Pubblica indie event' })).not.toBeInTheDocument()
  })

  it('un musicista vede solo «Pubblica indie event»', async () => {
    renderPage('/eventi', makeMe({ roles: ['FAN', 'MUSICIAN'] }))
    await screen.findByText(/Nessun evento/)

    expect(within(inTitleRow()).getByRole('link', { name: 'Pubblica indie event' })).toHaveAttribute('href', '/indie/nuovo')
    expect(screen.queryByRole('link', { name: 'Pubblica concerto' })).not.toBeInTheDocument()
  })

  it('con tutti e due i ruoli vede entrambi i pulsanti', async () => {
    renderPage('/eventi', makeMe({ roles: ['FAN', 'HOST', 'MUSICIAN'] }))
    await screen.findByText(/Nessun evento/)

    expect(within(inTitleRow()).getByRole('link', { name: 'Pubblica concerto' })).toBeInTheDocument()
    expect(within(inTitleRow()).getByRole('link', { name: 'Pubblica indie event' })).toBeInTheDocument()
  })
})
