import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeFeedPost } from '@/test/fixtures/feed'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import { postCreated, postCreateRejected } from '@/test/handlers/feed'
import { server } from '@/test/server'
import type { MeResponse } from '@/types/users'
import { NewPostForm } from './NewPostForm'

// Modulo «Nuovo post»: controlli del client, corpo della richiesta, posizione facoltativa (GPS, poi profilo, poi niente,
// sempre con un avviso) chiesta solo all'invio, errori del server sotto i campi.
type Success = (position: { coords: { latitude: number; longitude: number } }) => void
type Failure = (error: { code: number; PERMISSION_DENIED: number }) => void

function stubGeolocation(getCurrentPosition: (ok: Success, fail: Failure) => void) {
  Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true })
}

const gpsGranted = () => stubGeolocation((ok) => ok({ coords: { latitude: 44.4949, longitude: 11.3426 } }))
const gpsDenied = () => stubGeolocation((_ok, fail) => fail({ code: 1, PERMISSION_DENIED: 1 }))

afterEach(() => {
  vi.unstubAllGlobals()
  // @ts-expect-error: jsdom non ha `geolocation`, si toglie lo stub per i test seguenti
  delete navigator.geolocation
})

function renderForm(user: MeResponse = makeMe()) {
  const store = makeStore()
  store.dispatch(sessionStarted(makeLoginResponse({ user })))
  const onPublished = vi.fn()
  render(
    <Provider store={store}>
      <NewPostForm onPublished={onPublished} />
    </Provider>,
  )
  return { onPublished, user: userEvent.setup() }
}

const bodyField = () => screen.getByLabelText('Cosa vuoi condividere?')
const imageField = () => screen.getByLabelText("Indirizzo dell'immagine (facoltativo)")
const submit = () => screen.getByRole('button', { name: 'Pubblica' })

describe('NewPostForm · campi e controlli', () => {
  it('ha testo con contatore, indirizzo dell\'immagine, casella della posizione e «Pubblica»', () => {
    renderForm()

    expect(bodyField()).toBeInTheDocument()
    expect(screen.getByText('0 / 2000')).toBeInTheDocument()
    expect(imageField()).toBeInTheDocument()
    expect(screen.getByLabelText('Aggiungi la mia posizione')).not.toBeChecked()
    expect(submit()).toBeInTheDocument()
  })

  it('il contatore segue quello che si scrive', async () => {
    const { user } = renderForm()

    await user.type(bodyField(), 'Ciao!')

    expect(screen.getByText('5 / 2000')).toBeInTheDocument()
  })

  it('un testo vuoto non parte e mostra l\'errore sotto il campo', async () => {
    const calls: Request[] = []
    server.use(postCreated(makeFeedPost(), calls))
    const { user, onPublished } = renderForm()

    await user.click(submit())

    expect(await screen.findByText('Scrivi qualcosa (massimo 2000 caratteri).')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
    expect(onPublished).not.toHaveBeenCalled()
  })

  it('un indirizzo dell\'immagine che non è http/https non parte', async () => {
    const calls: Request[] = []
    server.use(postCreated(makeFeedPost(), calls))
    const { user } = renderForm()

    await user.type(bodyField(), 'Ciao')
    await user.type(imageField(), 'javascript:alert(1)')
    await user.click(submit())

    expect(await screen.findByText('Inserisci un indirizzo che inizi con http:// o https://.')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })
})

describe('NewPostForm · immagine che non si carica', () => {
  /** `Image` finta che fallisce sempre, come una pagina di ricerca al posto del file. */
  class BrokenImage {
    onerror: (() => void) | null = null
    referrerPolicy = ''
    set src(_value: string) {
      queueMicrotask(() => this.onerror?.())
    }
  }

  it('avvisa sotto il campo ma non impedisce di pubblicare', async () => {
    vi.stubGlobal('Image', BrokenImage)
    const calls: Request[] = []
    server.use(postCreated(makeFeedPost(), calls))
    const { user, onPublished } = renderForm()

    await user.type(bodyField(), 'Guarda')
    await user.type(imageField(), 'https://www.bing.com/images/search?q=x')
    expect(await screen.findByText(/Serve il link diretto all'immagine/)).toBeInTheDocument()

    await user.click(submit())

    await waitFor(() => expect(onPublished).toHaveBeenCalled())
    expect(await calls[0].json()).toEqual({ body: 'Guarda', imageUrl: 'https://www.bing.com/images/search?q=x' })
  })
})

describe('NewPostForm · invio', () => {
  it('manda solo il testo, avvisa e svuota il modulo', async () => {
    const calls: Request[] = []
    server.use(postCreated(makeFeedPost(), calls))
    const { user, onPublished } = renderForm()

    await user.type(bodyField(), '  Stasera suono!  ')
    await user.click(submit())

    await waitFor(() => expect(onPublished).toHaveBeenCalledExactlyOnceWith(['Post pubblicato.']))
    expect(await calls[0].json()).toEqual({ body: 'Stasera suono!' })
    expect(bodyField()).toHaveValue('')
  })

  it('manda anche l\'immagine, se c\'è', async () => {
    const calls: Request[] = []
    server.use(postCreated(makeFeedPost(), calls))
    const { user, onPublished } = renderForm()

    await user.type(bodyField(), 'Guarda')
    await user.type(imageField(), 'https://example.com/a.png')
    await user.click(submit())

    await waitFor(() => expect(onPublished).toHaveBeenCalled())
    expect(await calls[0].json()).toEqual({ body: 'Guarda', imageUrl: 'https://example.com/a.png' })
  })

  it('mentre aspetta il server il pulsante dice «Pubblico…» ed è spento', async () => {
    server.use(postCreated(makeFeedPost(), [], 200))
    const { user } = renderForm()
    await user.type(bodyField(), 'Ciao')

    await user.click(submit())

    expect(await screen.findByRole('button', { name: 'Pubblico…' })).toBeDisabled()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pubblica' })).toBeEnabled())
  })

  it('un errore dei campi del server compare sotto il campo e il testo scritto resta', async () => {
    server.use(postCreateRejected(400, 'VALIDATION_ERROR', { body: 'Testo non valido' }))
    const { user, onPublished } = renderForm()

    await user.type(bodyField(), 'Ciao')
    await user.click(submit())

    expect(await screen.findByText('Testo non valido')).toBeInTheDocument()
    expect(bodyField()).toHaveValue('Ciao')
    expect(onPublished).not.toHaveBeenCalled()
  })

  it('un altro errore del server compare come avviso con il suo messaggio', async () => {
    server.use(postCreateRejected(429, 'TOO_MANY_REQUESTS'))
    const { user } = renderForm()

    await user.type(bodyField(), 'Ciao')
    await user.click(submit())

    expect(await screen.findByRole('alert')).toHaveTextContent('Troppi tentativi: attendi un momento e riprova.')
  })
})

describe('NewPostForm · posizione', () => {
  it('non chiede la posizione al browser finché non si invia, nemmeno spuntando la casella', async () => {
    const getCurrentPosition = vi.fn()
    stubGeolocation(getCurrentPosition)
    const { user } = renderForm()

    await user.click(screen.getByLabelText('Aggiungi la mia posizione'))

    expect(getCurrentPosition).not.toHaveBeenCalled()
  })

  it('senza la casella il browser non è mai interpellato e non parte nessuna coordinata', async () => {
    const getCurrentPosition = vi.fn()
    stubGeolocation(getCurrentPosition)
    const calls: Request[] = []
    server.use(postCreated(makeFeedPost(), calls))
    const { user, onPublished } = renderForm(makeMe({ latitude: 43.7, longitude: 11.2 }))

    await user.type(bodyField(), 'Ciao')
    await user.click(submit())

    await waitFor(() => expect(onPublished).toHaveBeenCalled())
    expect(getCurrentPosition).not.toHaveBeenCalled()
    expect(await calls[0].json()).toEqual({ body: 'Ciao' })
  })

  it('con la casella e il permesso manda la posizione del browser, senza avvisi in più', async () => {
    gpsGranted()
    const calls: Request[] = []
    server.use(postCreated(makeFeedPost(), calls))
    const { user, onPublished } = renderForm(makeMe({ latitude: 43.7, longitude: 11.2 }))

    await user.type(bodyField(), 'Ciao')
    await user.click(screen.getByLabelText('Aggiungi la mia posizione'))
    await user.click(submit())

    await waitFor(() => expect(onPublished).toHaveBeenCalledExactlyOnceWith(['Post pubblicato.']))
    expect(await calls[0].json()).toEqual({ body: 'Ciao', latitude: 44.4949, longitude: 11.3426 })
  })

  it('con la casella e il permesso negato usa la posizione del profilo e lo dice', async () => {
    gpsDenied()
    const calls: Request[] = []
    server.use(postCreated(makeFeedPost(), calls))
    const { user, onPublished } = renderForm(makeMe({ latitude: 43.7, longitude: 11.2 }))

    await user.type(bodyField(), 'Ciao')
    await user.click(screen.getByLabelText('Aggiungi la mia posizione'))
    await user.click(submit())

    await waitFor(() =>
      expect(onPublished).toHaveBeenCalledExactlyOnceWith(['Post pubblicato.', 'Uso la posizione del tuo profilo.']),
    )
    expect(await calls[0].json()).toEqual({ body: 'Ciao', latitude: 43.7, longitude: 11.2 })
  })

  it('senza permesso e senza posizione nel profilo pubblica senza posizione e lo dice', async () => {
    gpsDenied()
    const calls: Request[] = []
    server.use(postCreated(makeFeedPost(), calls))
    const { user, onPublished } = renderForm(makeMe({ latitude: null, longitude: null }))

    await user.type(bodyField(), 'Ciao')
    await user.click(screen.getByLabelText('Aggiungi la mia posizione'))
    await user.click(submit())

    await waitFor(() =>
      expect(onPublished).toHaveBeenCalledExactlyOnceWith([
        'Post pubblicato.',
        'Posizione non disponibile: il post è stato pubblicato senza.',
      ]),
    )
    expect(await calls[0].json()).toEqual({ body: 'Ciao' })
  })
})
