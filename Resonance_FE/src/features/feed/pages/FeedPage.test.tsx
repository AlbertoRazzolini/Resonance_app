import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { ROUTES } from '@/app/routes'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { makePage } from '@/test/fixtures/events'
import { makeFeedPost } from '@/test/fixtures/feed'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import { feedFound, feedRejected, likeSetRejected, postCreated, postDeleted } from '@/test/handlers/feed'
import { server } from '@/test/server'
import { setViewportWidth } from '@/test/viewport'
import type { MeResponse } from '@/types/users'
import { Component as FeedPage } from './FeedPage'

// Feed: elenco con «Carica altri», filtro «vicino a me» nell'indirizzo, modulo del nuovo post (in finestra su telefono),
// like ottimistico annullato su errore e cancellazione dei propri post.
type Success = (position: { coords: { latitude: number; longitude: number } }) => void

afterEach(() => {
  // @ts-expect-error: jsdom non ha `geolocation`, si toglie lo stub per i test seguenti
  delete navigator.geolocation
})

const ME = makeMe({ id: 'me-id', displayName: 'Io' })

/** Mostra l'indirizzo corrente e, se arriva dall'accesso, lo stato. */
function LocationProbe() {
  const location = useLocation()
  return <p data-testid="location">{location.pathname + location.search + '|' + JSON.stringify(location.state)}</p>
}

function renderFeed({ user, url = ROUTES.feed }: { user?: MeResponse; url?: string } = {}) {
  const store = makeStore()
  if (user) store.dispatch(sessionStarted(makeLoginResponse({ user })))
  const router = createMemoryRouter(
    [
      {
        path: ROUTES.feed,
        element: (
          <>
            <FeedPage />
            <LocationProbe />
          </>
        ),
      },
      { path: ROUTES.login, element: <LocationProbe /> },
    ],
    { initialEntries: [url] },
  )
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
  return userEvent.setup()
}

const search = () => screen.getByTestId('location').textContent?.split('|')[0]

describe('FeedPage · elenco', () => {
  it('mostra il titolo e i post dal più recente come arrivano, chiedendo solo la prima pagina', async () => {
    const calls: Request[] = []
    server.use(
      feedFound(
        [makePage([makeFeedPost({ id: 'a', body: 'Primo post' }), makeFeedPost({ id: 'b', body: 'Secondo post' })])],
        calls,
      ),
    )
    renderFeed()

    expect(screen.getByRole('heading', { level: 1, name: 'Feed' })).toBeInTheDocument()
    const posts = await screen.findAllByRole('article')
    expect(posts).toHaveLength(2)
    expect(within(posts[0]).getByText('Primo post')).toBeInTheDocument()
    expect(within(posts[1]).getByText('Secondo post')).toBeInTheDocument()
    expect(Object.fromEntries(new URL(calls[0].url).searchParams)).toEqual({ page: '0' })
  })

  it('«Carica altri» aggiunge la pagina dopo e sparisce all\'ultima', async () => {
    server.use(
      feedFound([
        makePage([makeFeedPost({ id: 'a', body: 'Pagina uno' })], { totalPages: 2 }),
        makePage([makeFeedPost({ id: 'b', body: 'Pagina due' })], { page: 1, totalPages: 2 }),
      ]),
    )
    const user = renderFeed()
    await screen.findByText('Pagina uno')

    await user.click(screen.getByRole('button', { name: 'Carica altri' }))

    expect(await screen.findByText('Pagina due')).toBeInTheDocument()
    expect(screen.getByText('Pagina uno')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Carica altri' })).not.toBeInTheDocument()
  })

  it('senza post dice che non ce ne sono e invita a scrivere il primo', async () => {
    server.use(feedFound([makePage([])]))
    renderFeed()

    expect(await screen.findByText('Ancora nessun post.')).toBeInTheDocument()
    expect(screen.getByText('Scrivi il primo!')).toBeInTheDocument()
  })

  it('con un errore mostra il messaggio e «Riprova»', async () => {
    server.use(feedRejected(500, 'INTERNAL_ERROR'))
    renderFeed()

    expect(await screen.findByRole('alert')).toHaveTextContent('Si è verificato un problema imprevisto. Riprova tra poco.')
    expect(screen.getByRole('button', { name: 'Riprova' })).toBeInTheDocument()
  })
})

describe('FeedPage · filtro «vicino a me»', () => {
  it('di base è spento: nessun raggio e nessun parametro geografico', async () => {
    const calls: Request[] = []
    server.use(feedFound([makePage([makeFeedPost()])], calls))
    renderFeed()
    await screen.findAllByRole('article')

    expect(screen.getByRole('button', { name: 'Vicino a me' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('group', { name: 'Raggio' })).not.toBeInTheDocument()
    expect(new URL(calls[0].url).searchParams.has('lat')).toBe(false)
  })

  it('accenderlo manda centro, raggio e pagina insieme, scrive l\'indirizzo e avvisa che il centro è Firenze', async () => {
    const calls: Request[] = []
    server.use(feedFound([makePage([makeFeedPost()])], calls))
    const user = renderFeed()
    await screen.findAllByRole('article')

    await user.click(screen.getByRole('button', { name: 'Vicino a me' }))

    await waitFor(() => expect(calls).toHaveLength(2))
    expect(Object.fromEntries(new URL(calls[1].url).searchParams)).toEqual({
      lat: '43.7696',
      lng: '11.2558',
      radiusKm: '15',
      page: '0',
    })
    expect(search()).toBe('/feed?vicino=1')
    expect(screen.getByRole('button', { name: 'Vicino a me' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('group', { name: 'Raggio' })).toBeInTheDocument()
    expect(
      screen.getByText('Stai vedendo i post vicino a Firenze. Usa la tua posizione per vedere quelli più vicini a te.'),
    ).toBeInTheDocument()
  })

  it('un indirizzo con il filtro e il raggio parte già filtrato', async () => {
    const calls: Request[] = []
    server.use(feedFound([makePage([makeFeedPost({ distanceKm: 3.2 })])], calls))
    renderFeed({ url: '/feed?vicino=1&raggio=50' })

    expect(await screen.findByText('3,2 km')).toBeInTheDocument()
    expect(new URL(calls[0].url).searchParams.get('radiusKm')).toBe('50')
    expect(screen.getByRole('button', { name: '50 km' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('cambiare il raggio rifà la ricerca dalla prima pagina e lo scrive nell\'indirizzo', async () => {
    const calls: Request[] = []
    server.use(feedFound([makePage([makeFeedPost()])], calls))
    const user = renderFeed({ url: '/feed?vicino=1' })
    await screen.findAllByRole('article')

    await user.click(screen.getByRole('button', { name: '25 km' }))

    await waitFor(() => expect(calls).toHaveLength(2))
    expect(new URL(calls[1].url).searchParams.get('radiusKm')).toBe('25')
    expect(new URL(calls[1].url).searchParams.get('page')).toBe('0')
    expect(search()).toBe('/feed?vicino=1&raggio=25')
  })

  it('un raggio che non è un livello torna a 15 km', async () => {
    const calls: Request[] = []
    server.use(feedFound([makePage([makeFeedPost()])], calls))
    renderFeed({ url: '/feed?vicino=1&raggio=7' })
    await screen.findAllByRole('article')

    expect(new URL(calls[0].url).searchParams.get('radiusKm')).toBe('15')
  })

  it('senza post nel raggio lo dice e suggerisce di allargarlo', async () => {
    server.use(feedFound([makePage([])]))
    renderFeed({ url: '/feed?vicino=1' })

    expect(await screen.findByText('Nessun post entro 15 km')).toBeInTheDocument()
    expect(screen.getByText('Prova ad allargare il raggio.')).toBeInTheDocument()
  })

  it('spegnerlo toglie i parametri dall\'indirizzo e dalla richiesta', async () => {
    const calls: Request[] = []
    server.use(feedFound([makePage([makeFeedPost()])], calls))
    const user = renderFeed({ url: '/feed?vicino=1&raggio=25' })
    await screen.findAllByRole('article')

    await user.click(screen.getByRole('button', { name: 'Vicino a me' }))

    await waitFor(() => expect(calls).toHaveLength(2))
    expect(new URL(calls[1].url).searchParams.has('lat')).toBe(false)
    expect(search()).toBe('/feed')
  })

  it('con le coordinate nel profilo il centro è il profilo e non c\'è l\'avviso su Firenze', async () => {
    const calls: Request[] = []
    server.use(feedFound([makePage([makeFeedPost()])], calls))
    renderFeed({ user: makeMe({ latitude: 44.4949, longitude: 11.3426 }), url: '/feed?vicino=1' })
    await screen.findAllByRole('article')

    expect(new URL(calls[0].url).searchParams.get('lat')).toBe('44.4949')
    expect(screen.queryByText(/vicino a Firenze/)).not.toBeInTheDocument()
  })

  it('«Usa la mia posizione» cambia il centro con quello del browser', async () => {
    const calls: Request[] = []
    server.use(feedFound([makePage([makeFeedPost()])], calls))
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: (ok: Success) => ok({ coords: { latitude: 45.4642, longitude: 9.19 } }),
      },
      configurable: true,
    })
    const user = renderFeed({ url: '/feed?vicino=1' })
    await screen.findAllByRole('article')

    await user.click(screen.getByRole('button', { name: 'Usa la mia posizione' }))

    await waitFor(() => expect(calls).toHaveLength(2))
    expect(new URL(calls[1].url).searchParams.get('lat')).toBe('45.4642')
    expect(screen.queryByText(/vicino a Firenze/)).not.toBeInTheDocument()
  })
})

describe('FeedPage · nuovo post', () => {
  it('su desktop il modulo è in pagina per chi ha la sessione, senza il pulsante «Nuovo post»', async () => {
    server.use(feedFound([makePage([])]))
    renderFeed({ user: ME })

    expect(screen.getByLabelText('Cosa vuoi condividere?')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nuovo post' })).not.toBeInTheDocument()
    await screen.findByText('Ancora nessun post.')
  })

  it('su tablet (768 px) il modulo è ancora in pagina', async () => {
    setViewportWidth(768)
    server.use(feedFound([makePage([])]))
    renderFeed({ user: ME })

    expect(screen.getByLabelText('Cosa vuoi condividere?')).toBeInTheDocument()
    await screen.findByText('Ancora nessun post.')
  })

  it('su telefono (375 px) c\'è il pulsante «Nuovo post» e il modulo si apre in una finestra', async () => {
    setViewportWidth(375)
    server.use(feedFound([makePage([])]))
    const user = renderFeed({ user: ME })
    await screen.findByText('Ancora nessun post.')
    expect(screen.queryByLabelText('Cosa vuoi condividere?')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Nuovo post' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Nuovo post')
    expect(within(dialog).getByLabelText('Cosa vuoi condividere?')).toBeInTheDocument()
  })

  it('su telefono la pubblicazione chiude la finestra, avvisa e rilegge il feed', async () => {
    setViewportWidth(375)
    const feedCalls: Request[] = []
    const createCalls: Request[] = []
    server.use(feedFound([makePage([])], feedCalls), postCreated(makeFeedPost(), createCalls))
    const user = renderFeed({ user: ME })
    await screen.findByText('Ancora nessun post.')
    await user.click(screen.getByRole('button', { name: 'Nuovo post' }))

    await user.type(await screen.findByLabelText('Cosa vuoi condividere?'), 'Ciao a tutti')
    await user.click(screen.getByRole('button', { name: 'Pubblica' }))

    expect(await screen.findByText('Post pubblicato.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await createCalls[0].json()).toEqual({ body: 'Ciao a tutti' })
    await waitFor(() => expect(feedCalls.length).toBeGreaterThanOrEqual(2))
  })

  it('su desktop pubblicare avvisa e il feed si rilegge', async () => {
    const feedCalls: Request[] = []
    server.use(feedFound([makePage([])], feedCalls), postCreated(makeFeedPost()))
    const user = renderFeed({ user: ME })
    await screen.findByText('Ancora nessun post.')

    await user.type(screen.getByLabelText('Cosa vuoi condividere?'), 'Ciao')
    await user.click(screen.getByRole('button', { name: 'Pubblica' }))

    expect(await screen.findByText('Post pubblicato.')).toBeInTheDocument()
    await waitFor(() => expect(feedCalls.length).toBeGreaterThanOrEqual(2))
  })

  it('un anonimo non ha il modulo: legge l\'invito e il link «Accedi» verso l\'accesso', async () => {
    server.use(feedFound([makePage([])]))
    const user = renderFeed()
    await screen.findByText('Ancora nessun post.')

    expect(screen.getByText('Accedi per scrivere un post.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Cosa vuoi condividere?')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nuovo post' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Accedi' }))

    expect(screen.getByTestId('location')).toHaveTextContent(/^\/accesso\|.*"from":"\/feed"/)
  })
})

describe('FeedPage · like e cancellazione', () => {
  it('il like cambia subito il numero; con un errore 500 torna com\'era e dice perché', async () => {
    server.use(
      feedFound([makePage([makeFeedPost({ id: 'p1', likesCount: 3, likedByMe: false })])]),
      likeSetRejected(500, 'INTERNAL_ERROR', [], 300),
    )
    const user = renderFeed({ user: ME })
    const like = await screen.findByRole('button', { name: 'Mi piace' })
    expect(like).toHaveTextContent('3')

    await user.click(like)

    // Prima della risposta il numero è già salito e il pulsante è «Togli il mi piace»
    expect(await screen.findByRole('button', { name: 'Togli il mi piace' })).toHaveTextContent('4')
    // Con la risposta d'errore il like è annullato
    expect(await screen.findByRole('alert')).toHaveTextContent('Si è verificato un problema imprevisto. Riprova tra poco.')
    expect(await screen.findByRole('button', { name: 'Mi piace' })).toHaveTextContent('3')
  })

  it('cancellare un proprio post chiede conferma, avvisa e il post sparisce dall\'elenco', async () => {
    let posts = [makeFeedPost({ id: 'mio', body: 'Da cancellare', author: { id: ME.id, displayName: 'Io', avatarUrl: null } })]
    server.use(
      http.get('*/api/feed-posts', () => HttpResponse.json(makePage(posts))),
      postDeleted(),
    )
    const user = renderFeed({ user: ME })
    await screen.findByText('Da cancellare')
    posts = []

    await user.click(screen.getByRole('button', { name: /Cancella/ }))
    await user.click(await screen.findByRole('button', { name: 'Cancella post' }))

    expect(await screen.findByText('Post cancellato.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Da cancellare')).not.toBeInTheDocument())
  })
})

// «Nascondi» dell'area admin (FE-10): sui post degli altri per ADMIN e SUPERADMIN; dopo il nascondimento il feed si rilegge.
describe('FeedPage · «Nascondi» per gli admin', () => {
  const ADMIN = makeMe({ id: 'admin-id', displayName: 'Admin', roles: ['FAN', 'ADMIN'] })

  it('un admin nasconde il post di un altro con un motivo e il post sparisce dal feed', async () => {
    let posts = [makeFeedPost({ id: 'p1', body: 'Post offensivo' })]
    const calls: Request[] = []
    server.use(
      http.get('*/api/feed-posts', () => HttpResponse.json(makePage(posts))),
      http.post('*/api/admin/moderation/feed-posts/:id/hide', ({ request }) => {
        calls.push(request.clone())
        posts = []
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = renderFeed({ user: ADMIN })
    await screen.findByText('Post offensivo')

    await user.click(screen.getByRole('button', { name: /^Nascondi/ }))
    await user.type(screen.getByLabelText('Motivo'), 'Contenuto offensivo')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Nascondi' }))

    // L'avviso «Contenuto nascosto.» sta in `LiveNotifications`, non montato qui: lo prova il test di `HideContentButton`
    await waitFor(() => expect(screen.queryByText('Post offensivo')).not.toBeInTheDocument())
    expect(await calls[0].json()).toEqual({ reason: 'Contenuto offensivo' })
  })

  it('un utente senza ruolo admin non vede «Nascondi»', async () => {
    server.use(feedFound([makePage([makeFeedPost({ body: 'Post di Anna' })])]))
    renderFeed({ user: ME })
    await screen.findByText('Post di Anna')

    expect(screen.queryByRole('button', { name: /^Nascondi/ })).not.toBeInTheDocument()
  })

  it('un admin non vede «Nascondi» sui propri post', async () => {
    server.use(
      feedFound([makePage([makeFeedPost({ body: 'Il mio post', author: { id: ADMIN.id, displayName: 'Admin', avatarUrl: null } })])]),
    )
    renderFeed({ user: ADMIN })
    await screen.findByText('Il mio post')

    expect(screen.queryByRole('button', { name: /^Nascondi/ })).not.toBeInTheDocument()
  })
})
