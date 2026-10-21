import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider, useParams } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/app/routes'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeCollabPost } from '@/test/fixtures/collab'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import { collabCreated, collabCreateRejected } from '@/test/handlers/collab'
import { server } from '@/test/server'
import { Component as NewCollabPage } from './NewCollabPage'

// «Pubblica annuncio»: campi, controlli del client prima di chiamare il server, corpo della richiesta con il luogo vuoto
// omesso, apertura del dettaglio a creazione riuscita, errori dei campi del server e avviso per gli altri errori.
function DetailProbe() {
  const { id } = useParams()
  return <p>Dettaglio {id}</p>
}

function renderPage() {
  const store = makeStore()
  store.dispatch(sessionStarted(makeLoginResponse({ user: makeMe({ roles: ['MUSICIAN'] }) })))
  const router = createMemoryRouter(
    [
      { path: ROUTES.newCollab, element: <NewCollabPage /> },
      { path: ROUTES.collabPost, element: <DetailProbe /> },
      { path: ROUTES.collab, element: <p>Bacheca</p> },
    ],
    { initialEntries: [ROUTES.newCollab] },
  )
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
  return userEvent.setup()
}

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Titolo'), 'Cercasi bassista')
  await user.type(screen.getByLabelText('Descrizione'), 'Progetto post-rock.')
  await user.type(screen.getByLabelText('Ruolo cercato'), 'Bassista')
}

describe('NewCollabPage', () => {
  it('mostra il titolo, i campi con il suggerimento sul ruolo e «Annulla» verso la bacheca', () => {
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: 'Pubblica annuncio' })).toBeInTheDocument()
    expect(screen.getByLabelText('Titolo')).toBeInTheDocument()
    expect(screen.getByLabelText('Descrizione')).toBeInTheDocument()
    expect(screen.getByLabelText('Ruolo cercato')).toBeInTheDocument()
    expect(screen.getByText('Per esempio: bassista')).toBeInTheDocument()
    expect(screen.getByLabelText('Generi')).toBeInTheDocument()
    expect(screen.getByLabelText('Luogo (facoltativo)')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Annulla' })).toHaveAttribute('href', ROUTES.collab)
  })

  it('con i campi obbligatori vuoti mostra gli errori e non chiama il server', async () => {
    const calls: Request[] = []
    server.use(collabCreated(makeCollabPost(), calls))
    const user = renderPage()

    await user.click(screen.getByRole('button', { name: 'Pubblica' }))

    expect(screen.getByText('Scrivi il titolo.')).toBeInTheDocument()
    expect(screen.getByText('Scrivi la descrizione.')).toBeInTheDocument()
    expect(screen.getByText('Scrivi il ruolo cercato.')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('un titolo di meno di 3 lettere mostra l\'errore sotto il campo e non chiama il server', async () => {
    const calls: Request[] = []
    server.use(collabCreated(makeCollabPost(), calls))
    const user = renderPage()

    await user.type(screen.getByLabelText('Titolo'), 'ab')
    await user.type(screen.getByLabelText('Descrizione'), 'Progetto post-rock.')
    await user.type(screen.getByLabelText('Ruolo cercato'), 'Bassista')
    await user.click(screen.getByRole('button', { name: 'Pubblica' }))

    expect(screen.getByText('Il titolo deve avere almeno 3 caratteri.')).toBeInTheDocument()
    expect(screen.getByLabelText('Titolo')).toHaveAttribute('aria-invalid', 'true')
    expect(calls).toHaveLength(0)
  })

  it('dopo un invio con errori il cursore va sul primo campo sbagliato', async () => {
    const user = renderPage()

    await user.click(screen.getByRole('button', { name: 'Pubblica' }))
    expect(screen.getByLabelText('Titolo')).toHaveFocus()

    await user.type(screen.getByLabelText('Titolo'), 'Titolo valido')
    await user.type(screen.getByLabelText('Descrizione'), 'Progetto post-rock.')
    await user.click(screen.getByRole('button', { name: 'Pubblica' }))
    expect(screen.getByLabelText('Ruolo cercato')).toHaveFocus()
  })

  it('un errore di campo del server porta il cursore su quel campo', async () => {
    server.use(collabCreateRejected(400, 'VALIDATION_ERROR', { description: 'Descrizione non valida dal server' }))
    const user = renderPage()

    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: 'Pubblica' }))

    expect(await screen.findByText('Descrizione non valida dal server')).toBeInTheDocument()
    expect(screen.getByLabelText('Descrizione')).toHaveFocus()
  })

  it('manda il corpo con i generi e senza il luogo vuoto, poi apre il dettaglio', async () => {
    const calls: Request[] = []
    server.use(collabCreated(makeCollabPost({ id: 'nuovo-id' }), calls))
    const user = renderPage()

    await fillRequired(user)
    await user.type(screen.getByLabelText('Generi'), 'Post-Rock{Enter}')
    await user.click(screen.getByRole('button', { name: 'Pubblica' }))

    expect(await screen.findByText('Dettaglio nuovo-id')).toBeInTheDocument()
    expect(calls).toHaveLength(1)
    expect(await calls[0].json()).toEqual({
      title: 'Cercasi bassista',
      description: 'Progetto post-rock.',
      roleNeeded: 'Bassista',
      genreTags: ['post-rock'],
    })
  })

  it('con il luogo scritto lo manda', async () => {
    const calls: Request[] = []
    server.use(collabCreated(makeCollabPost(), calls))
    const user = renderPage()

    await fillRequired(user)
    await user.type(screen.getByLabelText('Luogo (facoltativo)'), 'Milano')
    await user.click(screen.getByRole('button', { name: 'Pubblica' }))

    await screen.findByText(/Dettaglio/)
    expect(await calls[0].json()).toMatchObject({ location: 'Milano' })
  })

  it('un errore di campo del server compare sotto il campo, senza avviso generale, e sparisce cambiando il campo', async () => {
    server.use(collabCreateRejected(400, 'VALIDATION_ERROR', { title: 'Titolo non valido dal server' }))
    const user = renderPage()

    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: 'Pubblica' }))

    expect(await screen.findByText('Titolo non valido dal server')).toBeInTheDocument()
    expect(screen.queryByRole('alert', { name: /Dati non validi/ })).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Titolo'), 'x')
    expect(screen.queryByText('Titolo non valido dal server')).not.toBeInTheDocument()
  })

  it('un errore senza campi (troppe richieste) mostra l\'avviso con il messaggio del suo codice', async () => {
    server.use(collabCreateRejected(429, 'TOO_MANY_REQUESTS'))
    const user = renderPage()

    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: 'Pubblica' }))

    expect(await screen.findByText('Troppi tentativi: attendi un momento e riprova.')).toBeInTheDocument()
    expect(screen.queryByText(/Dettaglio/)).not.toBeInTheDocument()
  })
})
