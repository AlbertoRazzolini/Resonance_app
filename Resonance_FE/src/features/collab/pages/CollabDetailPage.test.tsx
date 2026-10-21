import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeCollabPost } from '@/test/fixtures/collab'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import {
  collabCloseRejected,
  collabClosed,
  collabDeleted,
  collabDeleteRejected,
  collabPostFound,
  collabPostRejected,
} from '@/test/handlers/collab'
import { server } from '@/test/server'
import type { MeResponse } from '@/types/users'
import { Component as CollabDetailPage } from './CollabDetailPage'

// Dettaglio di un annuncio collab: aperto anche agli anonimi e anche se chiuso (con l'indicazione «Chiuso»), testo degli
// utenti inerte, «non trovato» per 404 (Review Focus 6: contenuto nascosto aperto da un link) e «Riprova» sugli altri errori.
// Il proprietario chiude (con conferma) e cancella (con conferma e motivo facoltativo); gli altri non vedono i pulsanti.
/** Mostra a cosa è arrivata la navigazione dopo una cancellazione, e lo stato passato. */
function ProfileProbe() {
  const location = useLocation()
  return <p>Profilo con stato {JSON.stringify(location.state)}</p>
}

function renderPage(id = 'a1', user?: MeResponse) {
  const store = makeStore()
  if (user) store.dispatch(sessionStarted(makeLoginResponse({ user })))
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[`/collab/${id}`]}>
        <Routes>
          <Route path="/collab/:id" element={<CollabDetailPage />} />
          <Route path="/profilo" element={<ProfileProbe />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  )
  return userEvent.setup()
}

describe('CollabDetailPage · annuncio trovato', () => {
  it('mostra titolo, autore con il link al profilo, ruolo, luogo, data numerica e generi', async () => {
    server.use(
      collabPostFound(
        makeCollabPost({
          id: 'a1',
          title: 'Cercasi cantante',
          musician: { id: 'u1', displayName: 'Etere Ossidato', avatarUrl: null },
          roleNeeded: 'Cantante',
          location: 'Torino Nord',
          genreTags: ['shoegaze'],
          createdAt: '2026-10-20T12:00:00Z',
        }),
      ),
    )

    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: 'Cercasi cantante' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Etere Ossidato' })).toHaveAttribute('href', '/utenti/u1')
    expect(screen.getByText('Cantante', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.getByText('Torino Nord', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.getByText('20/10/2026', { selector: 'time' })).toBeInTheDocument()
    expect(screen.getByText('shoegaze')).toBeInTheDocument()
  })

  it("un annuncio aperto non porta l'indicazione «Chiuso»", async () => {
    server.use(collabPostFound(makeCollabPost({ isOpen: true })))

    renderPage()

    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByText('Chiuso')).not.toBeInTheDocument()
  })

  it("un annuncio chiuso si apre lo stesso, anche da anonimo, con l'indicazione «Chiuso»", async () => {
    server.use(collabPostFound(makeCollabPost({ isOpen: false })))

    renderPage()

    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Chiuso')).toBeInTheDocument()
  })

  it('senza luogo la riga «Luogo» non compare', async () => {
    server.use(collabPostFound(makeCollabPost({ location: null })))

    renderPage()

    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByText('Luogo')).not.toBeInTheDocument()
  })

  it('il codice HTML nella descrizione resta testo inerte', async () => {
    server.use(collabPostFound(makeCollabPost({ description: 'Riga uno\n<b>non grassetto</b>' })))

    renderPage()

    expect(await screen.findByText(/<b>non grassetto<\/b>/)).toBeInTheDocument()
    expect(document.querySelector('article b')).toBeNull()
  })
})

describe('CollabDetailPage · uscite dalla pagina', () => {
  // Dopo la pubblicazione si arriva qui: i due pulsanti dicono che la creazione è finita e portano via dal dettaglio
  it.each([
    ['un anonimo', undefined],
    ['un altro musicista', makeMe({ id: 'other-id', roles: ['MUSICIAN'] })],
    ['il proprietario', makeMe({ id: 'owner-id', roles: ['MUSICIAN'] })],
  ])('%s vede «Torna su Collab» verso la bacheca e «Torna alla home» verso la home', async (_who, user) => {
    server.use(
      collabPostFound(makeCollabPost({ id: 'a1', musician: { id: 'owner-id', displayName: 'Io', avatarUrl: null } })),
    )

    renderPage('a1', user)

    expect(await screen.findByRole('link', { name: 'Torna su Collab' })).toHaveAttribute('href', '/collab')
    expect(screen.getByRole('link', { name: 'Torna alla home' })).toHaveAttribute('href', '/')
  })

  it('i due pulsanti ci sono anche su un annuncio chiuso', async () => {
    server.use(collabPostFound(makeCollabPost({ isOpen: false })))

    renderPage()

    expect(await screen.findByRole('link', { name: 'Torna su Collab' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Torna alla home' })).toBeInTheDocument()
  })
})

describe('CollabDetailPage · errori', () => {
  it('un 404 NOT_FOUND diventa «Annuncio non trovato», con il ritorno alla bacheca', async () => {
    server.use(collabPostRejected(404, 'NOT_FOUND'))

    renderPage('nascosto')

    expect(await screen.findByRole('heading', { level: 1, name: 'Annuncio non trovato' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Torna alla bacheca' })).toHaveAttribute('href', '/collab')
  })

  it("un altro errore mostra il suo messaggio e «Riprova» rilegge l'annuncio", async () => {
    server.use(collabPostRejected(500, 'INTERNAL_ERROR'))
    const user = renderPage()

    expect(await screen.findByText('Si è verificato un problema imprevisto. Riprova tra poco.')).toBeInTheDocument()
    server.use(collabPostFound(makeCollabPost({ title: 'Eccolo' })))
    await user.click(screen.getByRole('button', { name: 'Riprova' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Eccolo' })).toBeInTheDocument()
  })
})

// L'autore dell'annuncio di prova ha id `owner-id`; chi è collegato con un altro id non è il proprietario.
const OWNER = makeMe({ id: 'owner-id', roles: ['MUSICIAN'] })
const OTHER = makeMe({ id: 'other-id', roles: ['MUSICIAN'] })
const ownPost = (overrides = {}) =>
  makeCollabPost({ id: 'a1', musician: { id: 'owner-id', displayName: 'Io', avatarUrl: null }, ...overrides })

describe('CollabDetailPage · candidatura', () => {
  it('su un annuncio aperto di un altro, un musicista vede il modulo di candidatura', async () => {
    server.use(collabPostFound(ownPost()))

    renderPage('a1', OTHER)

    expect(await screen.findByLabelText("Messaggio per l'autore")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Invia candidatura' })).toBeInTheDocument()
  })

  it('un anonimo vede il modulo (all\'invio andrà all\'accesso)', async () => {
    server.use(collabPostFound(ownPost()))

    renderPage('a1')

    expect(await screen.findByLabelText("Messaggio per l'autore")).toBeInTheDocument()
  })

  it('sul proprio annuncio il modulo di candidatura non compare', async () => {
    server.use(collabPostFound(ownPost()))

    renderPage('a1', OWNER)

    await screen.findByRole('button', { name: 'Chiudi annuncio' })
    expect(screen.queryByLabelText("Messaggio per l'autore")).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Invia candidatura' })).not.toBeInTheDocument()
  })

  it("su un annuncio chiuso il modulo non compare e un avviso dice che non accetta più candidature", async () => {
    server.use(collabPostFound(ownPost({ isOpen: false })))

    renderPage('a1', OTHER)

    expect(await screen.findByText("L'annuncio è chiuso e non accetta più candidature.")).toBeInTheDocument()
    expect(screen.queryByLabelText("Messaggio per l'autore")).not.toBeInTheDocument()
  })

  it("quando il proprietario chiude l'annuncio l'indicazione «Chiuso» compare e non resta nessun modulo", async () => {
    server.use(collabPostFound(ownPost({ isOpen: false })))

    renderPage('a1', OWNER)

    expect(await screen.findByText('Chiuso')).toBeInTheDocument()
    expect(screen.queryByLabelText("Messaggio per l'autore")).not.toBeInTheDocument()
    expect(screen.queryByText("L'annuncio è chiuso e non accetta più candidature.")).not.toBeInTheDocument()
  })
})

describe('CollabDetailPage · azioni del proprietario', () => {
  it('il proprietario di un annuncio aperto vede «Chiudi annuncio» e «Cancella»', async () => {
    server.use(collabPostFound(ownPost()))

    renderPage('a1', OWNER)

    expect(await screen.findByRole('button', { name: 'Chiudi annuncio' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancella' })).toBeInTheDocument()
  })

  it('il proprietario di un annuncio chiuso può solo cancellarlo', async () => {
    server.use(collabPostFound(ownPost({ isOpen: false })))

    renderPage('a1', OWNER)

    expect(await screen.findByRole('button', { name: 'Cancella' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Chiudi annuncio' })).not.toBeInTheDocument()
  })

  it('un altro musicista non vede nessun pulsante del proprietario', async () => {
    server.use(collabPostFound(ownPost()))

    renderPage('a1', OTHER)

    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('button', { name: 'Chiudi annuncio' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancella' })).not.toBeInTheDocument()
  })

  it('un anonimo non vede nessun pulsante del proprietario', async () => {
    server.use(collabPostFound(ownPost()))

    renderPage('a1')

    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('button', { name: 'Chiudi annuncio' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancella' })).not.toBeInTheDocument()
  })

  it("«Chiudi annuncio» apre la conferma con l'effetto sulla chat; «Annulla» la chiude senza chiamare il server", async () => {
    const calls: Request[] = []
    server.use(collabPostFound(ownPost()), collabClosed(ownPost({ isOpen: false }), calls))
    const user = renderPage('a1', OWNER)

    await user.click(await screen.findByRole('button', { name: 'Chiudi annuncio' }))
    const dialog = screen.getByRole('dialog', { name: "Chiudere l'annuncio?" })
    expect(dialog).toHaveTextContent(
      'Dopo la chiusura nessuno potrà più candidarsi. Chi non è tuo amico non potrà più scriverti in chat: se vuoi continuare una conversazione, prima aggiungilo agli amici.',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Annulla' }))

    expect(calls).toHaveLength(0)
    await screen.findByRole('button', { name: 'Chiudi annuncio' })
  })

  it("confermando la chiusura chiama il server e l'annuncio mostra «Chiuso» senza più «Chiudi annuncio»", async () => {
    const calls: Request[] = []
    server.use(collabPostFound(ownPost()), collabClosed(ownPost({ isOpen: false }), calls))
    const user = renderPage('a1', OWNER)

    await user.click(await screen.findByRole('button', { name: 'Chiudi annuncio' }))
    // La rilettura dopo la chiusura trova l'annuncio chiuso
    server.use(collabPostFound(ownPost({ isOpen: false })))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Chiudi annuncio' }))

    expect(await screen.findByText('Chiuso')).toBeInTheDocument()
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('PATCH')
    expect(new URL(calls[0].url).pathname).toBe('/api/collab-posts/a1/close')
    // Anche il pulsante della conferma si chiama «Chiudi annuncio» e sparisce con la transizione della finestra
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Chiudi annuncio' })).not.toBeInTheDocument())
  })

  it("un errore alla chiusura mostra il messaggio del suo codice e l'annuncio resta aperto", async () => {
    server.use(collabPostFound(ownPost()), collabCloseRejected(403, 'NOT_OWNER'))
    const user = renderPage('a1', OWNER)

    await user.click(await screen.findByRole('button', { name: 'Chiudi annuncio' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Chiudi annuncio' }))

    expect(await screen.findByText("Solo chi l'ha creato può farlo.")).toBeInTheDocument()
    expect(screen.queryByText('Chiuso')).not.toBeInTheDocument()
  })

  it('«Cancella» apre la conferma con il motivo facoltativo', async () => {
    server.use(collabPostFound(ownPost()))
    const user = renderPage('a1', OWNER)

    await user.click(await screen.findByRole('button', { name: 'Cancella' }))

    const dialog = screen.getByRole('dialog', { name: "Cancellare l'annuncio?" })
    expect(dialog).toHaveTextContent(
      "L'annuncio non sarà più visibile a nessuno. L'operazione non potrà essere annullata, vuoi continuare?",
    )
    expect(within(dialog).getByLabelText('Motivo (facoltativo)')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Cancella annuncio' })).toBeInTheDocument()
  })

  it("confermando senza motivo cancella senza body e torna al profilo con il segno per l'avviso", async () => {
    const calls: Request[] = []
    server.use(collabPostFound(ownPost()), collabDeleted(calls))
    const user = renderPage('a1', OWNER)

    await user.click(await screen.findByRole('button', { name: 'Cancella' }))
    await user.click(screen.getByRole('button', { name: 'Cancella annuncio' }))

    expect(await screen.findByText(/Profilo con stato/)).toHaveTextContent('"collabDeleted":true')
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('DELETE')
    expect(await calls[0].text()).toBe('')
  })

  it('confermando con un motivo lo manda nel body', async () => {
    const calls: Request[] = []
    server.use(collabPostFound(ownPost()), collabDeleted(calls))
    const user = renderPage('a1', OWNER)

    await user.click(await screen.findByRole('button', { name: 'Cancella' }))
    await user.type(screen.getByLabelText('Motivo (facoltativo)'), 'Trovato il bassista')
    await user.click(screen.getByRole('button', { name: 'Cancella annuncio' }))

    await screen.findByText(/Profilo con stato/)
    expect(await calls[0].json()).toEqual({ reason: 'Trovato il bassista' })
  })

  it('un errore alla cancellazione resta sulla pagina con il messaggio del suo codice', async () => {
    server.use(collabPostFound(ownPost()), collabDeleteRejected(403, 'NOT_OWNER'))
    const user = renderPage('a1', OWNER)

    await user.click(await screen.findByRole('button', { name: 'Cancella' }))
    await user.click(screen.getByRole('button', { name: 'Cancella annuncio' }))

    expect(await screen.findByText("Solo chi l'ha creato può farlo.")).toBeInTheDocument()
    expect(screen.queryByText(/Profilo con stato/)).not.toBeInTheDocument()
    // La finestra si chiude con una breve transizione
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
