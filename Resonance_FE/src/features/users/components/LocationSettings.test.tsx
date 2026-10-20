import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { afterEach, describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import {
  locationRemovalRejected,
  locationRemoved,
  profileRejected,
  profileUpdated,
} from '@/test/handlers/users'
import { server } from '@/test/server'
import type { MeResponse } from '@/types/users'
import { LocationSettings } from './LocationSettings'

// Posizione condivisa: «Condividi la mia posizione» invia latitudine e longitudine insieme (arrotondate), «Smetti di
// condividere» le toglie; messaggi per permesso negato o posizione non disponibile; le coordinate non si mostrano mai.
type Success = (position: { coords: { latitude: number; longitude: number } }) => void
type Failure = (error: { code: number; PERMISSION_DENIED: number }) => void

function stubGeolocation(getCurrentPosition: (ok: Success, fail: Failure) => void) {
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition },
    configurable: true,
  })
}

const granted = () =>
  stubGeolocation((ok) => ok({ coords: { latitude: 44.4949, longitude: 11.3426 } }))

afterEach(() => {
  // @ts-expect-error: jsdom non ha `geolocation`, si toglie lo stub per i test seguenti
  delete navigator.geolocation
})

function renderSettings(user: MeResponse = makeMe()) {
  const store = makeStore()
  store.dispatch(sessionStarted(makeLoginResponse({ user })))
  render(
    <Provider store={store}>
      <LocationSettings />
    </Provider>,
  )
  return { store, user: userEvent.setup() }
}

const sharing = makeMe({ latitude: 44.49, longitude: 11.34 })

describe('LocationSettings · senza posizione condivisa', () => {
  it('dice che non si condivide e offre il pulsante per farlo', () => {
    renderSettings()

    expect(screen.getByText('Non stai condividendo la tua posizione')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Condividi la mia posizione' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Smetti di condividere' })).not.toBeInTheDocument()
  })

  it('non chiede la posizione al browser finché non si preme il pulsante', () => {
    let asked = false
    stubGeolocation(() => {
      asked = true
    })

    renderSettings()

    expect(asked).toBe(false)
  })

  it('invia latitudine e longitudine insieme, arrotondate, e passa allo stato «condivisa»', async () => {
    const calls: Request[] = []
    granted()
    server.use(
      profileUpdated(makeMe(), calls),
    )
    const { user, store } = renderSettings()

    await user.click(screen.getByRole('button', { name: 'Condividi la mia posizione' }))

    expect(await screen.findByText('Posizione condivisa')).toBeInTheDocument()
    expect(await calls[0].json()).toEqual({ latitude: 44.49, longitude: 11.34 })
    expect(store.getState().auth.user).toMatchObject({ latitude: 44.49, longitude: 11.34 })
    expect(screen.getByRole('button', { name: 'Smetti di condividere' })).toBeInTheDocument()
  })

  it('non mostra mai le coordinate', async () => {
    granted()
    server.use(profileUpdated())
    const { user } = renderSettings()

    await user.click(screen.getByRole('button', { name: 'Condividi la mia posizione' }))
    await screen.findByText('Posizione condivisa')

    expect(document.body).not.toHaveTextContent('44.49')
    expect(document.body).not.toHaveTextContent('11.34')
  })

  it('mentre cerca la posizione il pulsante è spento e dice che sta cercando', async () => {
    let answer: Success = () => {}
    stubGeolocation((ok) => {
      answer = ok
    })
    server.use(profileUpdated())
    const { user } = renderSettings()

    await user.click(screen.getByRole('button', { name: 'Condividi la mia posizione' }))

    expect(screen.getByRole('button', { name: 'Sto cercando la tua posizione…' })).toBeDisabled()
    answer({ coords: { latitude: 1, longitude: 2 } })
    await screen.findByText('Posizione condivisa')
  })

  it('con il permesso negato mostra il messaggio e non chiama il server', async () => {
    const calls: Request[] = []
    stubGeolocation((_ok, fail) => fail({ code: 1, PERMISSION_DENIED: 1 }))
    server.use(profileUpdated(makeMe(), calls))
    const { user } = renderSettings()

    await user.click(screen.getByRole('button', { name: 'Condividi la mia posizione' }))

    expect(
      await screen.findByText(
        'Hai negato l\'accesso alla posizione. Puoi riattivarlo dalle impostazioni del browser.',
      ),
    ).toBeInTheDocument()
    expect(calls).toHaveLength(0)
    expect(screen.getByText('Non stai condividendo la tua posizione')).toBeInTheDocument()
  })

  it('con la posizione non trovata mostra il messaggio e non chiama il server', async () => {
    const calls: Request[] = []
    stubGeolocation((_ok, fail) => fail({ code: 2, PERMISSION_DENIED: 1 }))
    server.use(profileUpdated(makeMe(), calls))
    const { user } = renderSettings()

    await user.click(screen.getByRole('button', { name: 'Condividi la mia posizione' }))

    expect(
      await screen.findByText('Non riesco a trovare la tua posizione. Riprova tra poco.'),
    ).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('in un browser senza geolocalizzazione mostra lo stesso messaggio', async () => {
    const { user } = renderSettings()

    await user.click(screen.getByRole('button', { name: 'Condividi la mia posizione' }))

    expect(
      await screen.findByText('Non riesco a trovare la tua posizione. Riprova tra poco.'),
    ).toBeInTheDocument()
  })

  it('se il server rifiuta il PATCH mostra l\'errore e resta «non condivisa»', async () => {
    granted()
    server.use(profileRejected(500, 'INTERNAL_ERROR'))
    const { user, store } = renderSettings()

    await user.click(screen.getByRole('button', { name: 'Condividi la mia posizione' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Si è verificato un problema imprevisto')
    expect(store.getState().auth.user?.latitude).toBeNull()
    expect(screen.getByText('Non stai condividendo la tua posizione')).toBeInTheDocument()
  })
})

describe('LocationSettings · con la posizione condivisa', () => {
  it('dice che si condivide e offre «Smetti di condividere», senza il pulsante per condividere', () => {
    renderSettings(sharing)

    expect(screen.getByText('Posizione condivisa')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Smetti di condividere' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Condividi la mia posizione' })).not.toBeInTheDocument()
  })

  it('«Smetti di condividere» chiama DELETE e torna allo stato «non condivisa»', async () => {
    const calls: Request[] = []
    server.use(locationRemoved(sharing, calls))
    const { user, store } = renderSettings(sharing)

    await user.click(screen.getByRole('button', { name: 'Smetti di condividere' }))

    expect(await screen.findByText('Non stai condividendo la tua posizione')).toBeInTheDocument()
    expect(calls).toHaveLength(1)
    expect(store.getState().auth.user).toMatchObject({ latitude: null, longitude: null })
  })

  it('se il DELETE fallisce mostra l\'errore e resta «condivisa»', async () => {
    server.use(locationRemovalRejected(500, 'INTERNAL_ERROR'))
    const { user } = renderSettings(sharing)

    await user.click(screen.getByRole('button', { name: 'Smetti di condividere' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('problema imprevisto'))
    expect(screen.getByText('Posizione condivisa')).toBeInTheDocument()
  })

  it('con una sola coordinata nel profilo non si considera condivisa', () => {
    renderSettings(makeMe({ latitude: 44.49, longitude: null }))

    expect(screen.getByText('Non stai condividendo la tua posizione')).toBeInTheDocument()
  })
})
