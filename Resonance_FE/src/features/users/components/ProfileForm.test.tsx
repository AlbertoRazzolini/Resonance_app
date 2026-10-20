import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/app/routes'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import { profileRejected, profileUpdated } from '@/test/handlers/users'
import { server } from '@/test/server'
import type { MeResponse } from '@/types/users'
import { ProfileForm } from './ProfileForm'

// Form del profilo: «Salva» attivo solo con modifiche, PATCH con i soli campi cambiati (stringa vuota per svuotare),
// controlli del client prima di chiamare il server, errori dei campi dal backend e ritorno al profilo con l'avviso.
const me = makeMe({
  displayName: 'Mattia',
  bio: 'Suono la chitarra',
  city: 'Bologna',
  avatarUrl: 'https://x.it/a.png',
})

/** Mostra a cosa è arrivata la navigazione, per provare il ritorno al profilo e lo stato passato. */
function ProfileProbe() {
  const location = useLocation()
  return <p>Profilo con stato {JSON.stringify(location.state)}</p>
}

function renderForm(user: MeResponse = me) {
  const store = makeStore()
  store.dispatch(sessionStarted(makeLoginResponse({ user })))
  const router = createMemoryRouter(
    [
      { path: ROUTES.profile, element: <ProfileProbe /> },
      { path: ROUTES.profileEdit, element: <ProfileForm user={user} /> },
    ],
    { initialEntries: [ROUTES.profileEdit] },
  )
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
  return { store, router, user: userEvent.setup() }
}

const saveButton = () => screen.getByRole('button', { name: 'Salva modifiche' })

describe('ProfileForm', () => {
  it('parte dai dati salvati, con «Salva» spento e «Annulla» che riporta al profilo', () => {
    renderForm()

    expect(screen.getByLabelText('Nome visibile')).toHaveValue('Mattia')
    expect(screen.getByLabelText('Bio')).toHaveValue('Suono la chitarra')
    expect(screen.getByLabelText('Città')).toHaveValue('Bologna')
    expect(screen.getByLabelText('Indirizzo della foto')).toHaveValue('https://x.it/a.png')
    expect(saveButton()).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Annulla' })).toHaveAttribute('href', ROUTES.profile)
  })

  it('con i campi nulli del profilo li mostra vuoti', () => {
    renderForm(makeMe({ displayName: 'Mattia' }))

    expect(screen.getByLabelText('Bio')).toHaveValue('')
    expect(screen.getByLabelText('Indirizzo della foto')).toHaveValue('')
  })

  it('«Salva» si accende con una modifica e si rispegne se la si annulla a mano', async () => {
    const { user } = renderForm()

    await user.type(screen.getByLabelText('Città'), 'x')
    expect(saveButton()).toBeEnabled()

    await user.type(screen.getByLabelText('Città'), '{Backspace}')
    expect(saveButton()).toBeDisabled()
  })

  it('invia solo il campo cambiato, aggiorna la sessione e torna al profilo con il segno del salvataggio', async () => {
    const calls: Request[] = []
    server.use(profileUpdated(me, calls))
    const { user, store, router } = renderForm()

    await user.clear(screen.getByLabelText('Città'))
    await user.type(screen.getByLabelText('Città'), 'Milano')
    await user.click(saveButton())

    expect(await screen.findByText(/Profilo con stato/)).toHaveTextContent('"profileUpdated":true')
    expect(await calls[0].json()).toEqual({ city: 'Milano' })
    expect(store.getState().auth.user?.city).toBe('Milano')
    expect(router.state.location.pathname).toBe(ROUTES.profile)
  })

  it('con la bio svuotata invia la stringa vuota', async () => {
    const calls: Request[] = []
    server.use(profileUpdated(me, calls))
    const { user, store } = renderForm()

    await user.clear(screen.getByLabelText('Bio'))
    await user.click(saveButton())

    await screen.findByText(/Profilo con stato/)
    expect(await calls[0].json()).toEqual({ bio: '' })
    expect(store.getState().auth.user?.bio).toBeNull()
  })

  it('il nome vuoto non parte: messaggio sotto il campo e nessuna chiamata', async () => {
    const calls: Request[] = []
    server.use(profileUpdated(me, calls))
    const { user } = renderForm()

    await user.clear(screen.getByLabelText('Nome visibile'))
    await user.click(saveButton())

    expect(screen.getByText('Scrivi il nome visibile.')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it("un indirizzo della foto che non è http o https non parte", async () => {
    const calls: Request[] = []
    server.use(profileUpdated(me, calls))
    const { user } = renderForm()

    await user.clear(screen.getByLabelText('Indirizzo della foto'))
    await user.type(screen.getByLabelText('Indirizzo della foto'), 'javascript:alert(1)')
    await user.click(saveButton())

    expect(
      screen.getByText('Scrivi un indirizzo che inizia con http:// o https://.'),
    ).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it("il messaggio di un campo sparisce appena si corregge il valore", async () => {
    const { user } = renderForm()
    await user.clear(screen.getByLabelText('Nome visibile'))
    await user.click(saveButton())
    expect(screen.getByText('Scrivi il nome visibile.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Nome visibile'), 'Mattia R')

    expect(screen.queryByText('Scrivi il nome visibile.')).not.toBeInTheDocument()
  })

  it('mostra sotto il campo l\'errore VALIDATION_ERROR del backend e resta nel form', async () => {
    server.use(profileRejected(400, 'VALIDATION_ERROR', { displayName: 'Nome già usato' }))
    const { user, router } = renderForm()

    await user.type(screen.getByLabelText('Nome visibile'), 'x')
    await user.click(saveButton())

    expect(await screen.findByText('Nome già usato')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(ROUTES.profileEdit)
  })

  it('un errore senza campi (rete, server) si mostra in un avviso e il form resta com\'è', async () => {
    server.use(profileRejected(500, 'INTERNAL_ERROR'))
    const { user } = renderForm()

    await user.type(screen.getByLabelText('Città'), 'x')
    await user.click(saveButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('Si è verificato un problema imprevisto')
    expect(screen.getByLabelText('Città')).toHaveValue('Bolognax')
  })

  it("durante l'invio «Salva» è spento (niente doppio invio)", async () => {
    server.use(
      http.patch('*/api/users/me', async () => {
        await delay(100)
        return HttpResponse.json(me)
      }),
    )
    const { user } = renderForm()

    await user.type(screen.getByLabelText('Città'), 'x')
    await user.click(saveButton())

    expect(saveButton()).toBeDisabled()
    await waitFor(() => expect(screen.getByText(/Profilo con stato/)).toBeInTheDocument())
  })

  it('conta i caratteri della bio sul limite', async () => {
    const { user } = renderForm(makeMe({ displayName: 'Mattia' }))

    await user.type(screen.getByLabelText('Bio'), 'ciao')

    expect(screen.getByText('4 / 500')).toBeInTheDocument()
  })
})
