import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/app/routes'
import { makeStore } from '@/app/store'
import { makeIndieEvent } from '@/test/fixtures/events'
import { indieEventCreated, indieEventCreateRejected } from '@/test/handlers/events'
import { server } from '@/test/server'
import { IndieEventForm } from './IndieEventForm'

// Form «Pubblica indie event»: gli stessi campi del concerto (senza biglietto) più «Ingresso gratuito», due pulsanti
// («Pubblica» e «Salva come bozza») che mandano lo stato giusto, stessi errori di geocodifica, successo → dettaglio.
function renderForm() {
  const router = createMemoryRouter(
    [
      { path: ROUTES.newIndieEvent, element: <IndieEventForm /> },
      { path: ROUTES.indieEvent, element: <p>Dettaglio dell'indie event</p> },
    ],
    { initialEntries: [ROUTES.newIndieEvent] },
  )
  render(
    <Provider store={makeStore()}>
      <RouterProvider router={router} />
    </Provider>,
  )
  return { router, user: userEvent.setup() }
}

const publishButton = () => screen.getByRole('button', { name: /^Pubblica$|Sto cercando/ })
const draftButton = () => screen.getByRole('button', { name: 'Salva come bozza' })

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Titolo'), 'Underground night')
  await user.type(screen.getByLabelText('Nome del locale'), 'Combo Social Club')
  await user.type(screen.getByLabelText('Indirizzo'), 'Via del Pratellino 10, Firenze')
  fireEvent.change(screen.getByLabelText('Data e ora'), { target: { value: '2099-01-01T21:00' } })
}

describe('IndieEventForm', () => {
  it('mostra «Ingresso gratuito» (spento) e non il biglietto, con i due pulsanti', () => {
    renderForm()

    expect(screen.getByLabelText('Ingresso gratuito')).not.toBeChecked()
    expect(screen.queryByLabelText('Indirizzo per i biglietti')).not.toBeInTheDocument()
    expect(publishButton()).toBeInTheDocument()
    expect(draftButton()).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Annulla' })).toHaveAttribute('href', ROUTES.profile)
  })

  it('dopo un invio con errori il cursore va sul primo campo sbagliato', async () => {
    const { user } = renderForm()

    await user.click(publishButton())

    expect(screen.getByLabelText('Titolo')).toHaveFocus()
  })

  it('con i campi vuoti nessuno dei due pulsanti chiama il server', async () => {
    const calls: Request[] = []
    server.use(indieEventCreated(makeIndieEvent(), calls))
    const { user } = renderForm()

    await user.click(publishButton())
    await user.click(draftButton())

    expect(screen.getByText('Scrivi il titolo.')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('«Pubblica» manda PUBLISHED, la data con offset e isFree, poi apre il dettaglio', async () => {
    const calls: Request[] = []
    server.use(indieEventCreated(makeIndieEvent({ id: 'ie-1' }), calls))
    const { user, router } = renderForm()
    await fillValid(user)
    await user.click(screen.getByLabelText('Ingresso gratuito'))

    await user.click(publishButton())

    await waitFor(() => expect(router.state.location.pathname).toBe('/indie/ie-1'))
    expect(await calls[0].json()).toEqual({
      title: 'Underground night',
      venueName: 'Combo Social Club',
      address: 'Via del Pratellino 10, Firenze',
      eventDate: new Date(2099, 0, 1, 21, 0).toISOString(),
      genreTags: [],
      isFree: true,
      status: 'PUBLISHED',
    })
  })

  it('«Salva come bozza» manda DRAFT e apre il dettaglio della bozza', async () => {
    const calls: Request[] = []
    server.use(indieEventCreated(makeIndieEvent({ id: 'ie-2', status: 'DRAFT' }), calls))
    const { user, router } = renderForm()
    await fillValid(user)

    await user.click(draftButton())

    await waitFor(() => expect(router.state.location.pathname).toBe('/indie/ie-2'))
    expect(await calls[0].json()).toMatchObject({ status: 'DRAFT', isFree: false })
  })

  it('durante la geocodifica i due pulsanti sono spenti e si legge «Sto cercando l\'indirizzo…»', async () => {
    server.use(
      http.post('*/api/indie-events', async () => {
        await delay(150)
        return HttpResponse.json(makeIndieEvent({ id: 'lento' }), { status: 201 })
      }),
    )
    const { user, router } = renderForm()
    await fillValid(user)

    await user.click(publishButton())

    expect(await screen.findByRole('button', { name: "Sto cercando l'indirizzo…" })).toBeDisabled()
    expect(draftButton()).toBeDisabled()
    await waitFor(() => expect(router.state.location.pathname).toBe('/indie/lento'))
  })

  it('ADDRESS_NOT_FOUND evidenzia l\'indirizzo', async () => {
    server.use(indieEventCreateRejected(400, 'ADDRESS_NOT_FOUND', { address: 'Indirizzo non trovato' }))
    const { user } = renderForm()
    await fillValid(user)

    await user.click(draftButton())

    expect(await screen.findByText('Indirizzo non trovato')).toBeInTheDocument()
    expect(screen.getByLabelText('Indirizzo')).toHaveAttribute('aria-invalid', 'true')
  })

  it('GEOCODING_UNAVAILABLE è un avviso e i pulsanti tornano attivi', async () => {
    server.use(indieEventCreateRejected(502, 'GEOCODING_UNAVAILABLE'))
    const { user } = renderForm()
    await fillValid(user)

    await user.click(publishButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Il servizio degli indirizzi non risponde: riprova tra poco.',
    )
    expect(publishButton()).toBeEnabled()
    expect(draftButton()).toBeEnabled()
  })
})
