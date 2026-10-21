import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/app/routes'
import { makeStore } from '@/app/store'
import { makeConcert } from '@/test/fixtures/events'
import { concertCreated, concertCreateRejected } from '@/test/handlers/events'
import { server } from '@/test/server'
import { ConcertForm } from './ConcertForm'

// Form «Pubblica concerto»: controlli prima dell'invio, data con offset, generi a chip, attesa della geocodifica,
// ADDRESS_NOT_FOUND sul campo indirizzo, GEOCODING_UNAVAILABLE e TOO_MANY_REQUESTS in un avviso, successo → dettaglio.
function renderForm() {
  const router = createMemoryRouter(
    [
      { path: ROUTES.newConcert, element: <ConcertForm /> },
      { path: ROUTES.concert, element: <p>Dettaglio del concerto</p> },
    ],
    { initialEntries: [ROUTES.newConcert] },
  )
  render(
    <Provider store={makeStore()}>
      <RouterProvider router={router} />
    </Provider>,
  )
  return { router, user: userEvent.setup() }
}

const submitButton = () => screen.getByRole('button', { name: /Pubblica concerto|Sto cercando/ })

/** Compila i campi obbligatori; la data è nel 2099 per restare sempre futura. */
async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Titolo'), 'Serata rock')
  await user.type(screen.getByLabelText('Nome del locale'), 'Viper Theatre')
  await user.type(screen.getByLabelText('Indirizzo'), 'Via Pistoiese 309, Firenze')
  fireEvent.change(screen.getByLabelText('Data e ora'), { target: { value: '2099-01-01T21:00' } })
}

describe('ConcertForm', () => {
  it('mostra i campi del concerto, con il biglietto e senza «Ingresso gratuito»', () => {
    renderForm()

    expect(screen.getByLabelText('Titolo')).toBeInTheDocument()
    expect(screen.getByLabelText('Descrizione')).toBeInTheDocument()
    expect(screen.getByLabelText('Generi')).toBeInTheDocument()
    expect(screen.getByLabelText('Indirizzo della copertina')).toBeInTheDocument()
    expect(screen.getByLabelText('Indirizzo per i biglietti')).toBeInTheDocument()
    expect(screen.queryByLabelText('Ingresso gratuito')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Annulla' })).toHaveAttribute('href', ROUTES.profile)
  })

  it('dopo un invio con errori il cursore va sul primo campo sbagliato', async () => {
    const { user } = renderForm()

    await user.click(submitButton())

    expect(screen.getByLabelText('Titolo')).toHaveFocus()
  })

  it('con i campi vuoti non chiama il server e scrive un messaggio sotto ogni campo obbligatorio', async () => {
    const calls: Request[] = []
    server.use(concertCreated(makeConcert(), calls))
    const { user } = renderForm()

    await user.click(submitButton())

    expect(screen.getByText('Scrivi il titolo.')).toBeInTheDocument()
    expect(screen.getByText('Scrivi il nome del locale.')).toBeInTheDocument()
    expect(screen.getByText("Scrivi l'indirizzo.")).toBeInTheDocument()
    expect(screen.getByText("Scegli la data e l'ora.")).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('una data passata non parte', async () => {
    const calls: Request[] = []
    server.use(concertCreated(makeConcert(), calls))
    const { user } = renderForm()
    await fillValid(user)
    fireEvent.change(screen.getByLabelText('Data e ora'), { target: { value: '2001-01-01T21:00' } })

    await user.click(submitButton())

    expect(screen.getByText('Scegli una data futura.')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it("invia la data con offset (mai l'ora senza fuso), i generi normalizzati e va al dettaglio", async () => {
    const calls: Request[] = []
    server.use(concertCreated(makeConcert({ id: 'nuovo-1' }), calls))
    const { user, router } = renderForm()
    await fillValid(user)
    await user.type(screen.getByLabelText('Generi'), 'Rock{Enter}Indie{Enter}')

    await user.click(submitButton())

    await waitFor(() => expect(router.state.location.pathname).toBe('/concerti/nuovo-1'))
    const body = await calls[0].json()
    expect(body).toEqual({
      title: 'Serata rock',
      venueName: 'Viper Theatre',
      address: 'Via Pistoiese 309, Firenze',
      eventDate: new Date(2099, 0, 1, 21, 0).toISOString(),
      genreTags: ['rock', 'indie'],
    })
    expect(body.eventDate).not.toBe('2099-01-01T21:00')
  })

  it('durante la geocodifica mostra «Sto cercando l\'indirizzo…» e il pulsante è spento', async () => {
    server.use(
      http.post('*/api/official-concerts', async () => {
        await delay(150)
        return HttpResponse.json(makeConcert({ id: 'lento' }), { status: 201 })
      }),
    )
    const { user, router } = renderForm()
    await fillValid(user)

    await user.click(submitButton())

    expect(await screen.findByRole('button', { name: "Sto cercando l'indirizzo…" })).toBeDisabled()
    await waitFor(() => expect(router.state.location.pathname).toBe('/concerti/lento'))
  })

  it('ADDRESS_NOT_FOUND evidenzia il campo indirizzo e lascia il resto com\'è', async () => {
    server.use(concertCreateRejected(400, 'ADDRESS_NOT_FOUND', { address: 'Indirizzo non trovato' }))
    const { user, router } = renderForm()
    await fillValid(user)

    await user.click(submitButton())

    expect(await screen.findByText('Indirizzo non trovato')).toBeInTheDocument()
    expect(screen.getByLabelText('Indirizzo')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Titolo')).toHaveValue('Serata rock')
    expect(router.state.location.pathname).toBe(ROUTES.newConcert)
  })

  it("l'errore sull'indirizzo sparisce appena lo si corregge", async () => {
    server.use(concertCreateRejected(400, 'ADDRESS_NOT_FOUND', { address: 'Indirizzo non trovato' }))
    const { user } = renderForm()
    await fillValid(user)
    await user.click(submitButton())
    await screen.findByText('Indirizzo non trovato')

    await user.type(screen.getByLabelText('Indirizzo'), ' 1')

    expect(screen.queryByText('Indirizzo non trovato')).not.toBeInTheDocument()
  })

  it.each([
    [502, 'GEOCODING_UNAVAILABLE', 'Il servizio degli indirizzi non risponde: riprova tra poco.'],
    [429, 'TOO_MANY_REQUESTS', 'Troppi tentativi: attendi un momento e riprova.'],
  ])('%i %s: avviso con invito a riprovare, e il form si può reinviare', async (status, code, message) => {
    server.use(concertCreateRejected(status, code))
    const { user } = renderForm()
    await fillValid(user)

    await user.click(submitButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(submitButton()).toBeEnabled()
    expect(screen.getByLabelText('Titolo')).toHaveValue('Serata rock')
  })

  it('un errore dei campi del server (es. titolo) si vede sotto il campo giusto', async () => {
    server.use(concertCreateRejected(400, 'VALIDATION_ERROR', { title: 'Titolo non valido' }))
    const { user } = renderForm()
    await fillValid(user)

    await user.click(submitButton())

    expect(await screen.findByText('Titolo non valido')).toBeInTheDocument()
  })
})
