import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeFeedPost } from '@/test/fixtures/feed'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import { likeRemoved, likeSet, postDeleted, postDeleteRejected } from '@/test/handlers/feed'
import { server } from '@/test/server'
import type { FeedPostResponse } from '@/types/feed'
import { FeedPostCard } from './FeedPostCard'

// Card di un post: autore, data, distanza, testo inerte con link a conferma, immagine che sparisce se non si carica,
// «Mi piace» (anonimo all'accesso) e, solo per il proprietario, «Cancella» con conferma.
afterEach(() => vi.restoreAllMocks())

const ME = makeMe({ id: 'me-id', displayName: 'Io' })

/** Mostra a cosa è arrivata la navigazione verso l'accesso e lo stato passato. */
function LoginProbe() {
  const location = useLocation()
  return <p>Accesso con stato {JSON.stringify(location.state)}</p>
}

function renderCard(post: FeedPostResponse, { signedIn = false, onDeleted = vi.fn() } = {}) {
  const store = makeStore()
  if (signedIn) store.dispatch(sessionStarted(makeLoginResponse({ user: ME })))
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/feed?vicino=1']}>
        <Routes>
          <Route path="/feed" element={<FeedPostCard post={post} onDeleted={onDeleted} />} />
          <Route path="/accesso" element={<LoginProbe />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  )
  return { onDeleted }
}

describe('FeedPostCard · contenuto', () => {
  it('mostra autore con il link al profilo, data breve e testo', () => {
    renderCard(
      makeFeedPost({
        author: { id: 'a1', displayName: 'Giulia', avatarUrl: null },
        body: 'Prove aperte domani',
        createdAt: '2026-10-20T12:00:00Z',
      }),
    )

    expect(screen.getByRole('link', { name: 'Giulia' })).toHaveAttribute('href', '/utenti/a1')
    expect(screen.getByText('20/10/2026')).toBeInTheDocument()
    expect(screen.getByText('Prove aperte domani')).toBeInTheDocument()
  })

  it('con la distanza la scrive, senza (null) no', () => {
    renderCard(makeFeedPost({ distanceKm: 3.2 }))
    expect(screen.getByText('3,2 km')).toBeInTheDocument()
  })

  it('senza distanza non scrive nessuna distanza', () => {
    renderCard(makeFeedPost({ distanceKm: null }))
    expect(screen.queryByText(/ km$| m$/)).not.toBeInTheDocument()
  })
})

describe('FeedPostCard · testo degli utenti (Review Focus 9)', () => {
  it('<script> e <img onerror> restano testo: nessun elemento creato', () => {
    const { container } = render(
      <Provider store={makeStore()}>
        <MemoryRouter>
          <FeedPostCard post={makeFeedPost({ body: '<script>alert(1)</script><img src=x onerror=alert(1)>' })} />
        </MemoryRouter>
      </Provider>,
    )

    expect(screen.getByText('<script>alert(1)</script><img src=x onerror=alert(1)>')).toBeInTheDocument()
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img[src="x"]')).toBeNull()
  })

  it('javascript:alert(1) non diventa un link', () => {
    renderCard(makeFeedPost({ body: 'clicca javascript:alert(1)' }))

    expect(screen.queryByRole('link', { name: /javascript/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /javascript/ })).not.toBeInTheDocument()
  })

  it('un URL https apre la conferma con il dominio e poi la scheda con noopener', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    renderCard(makeFeedPost({ body: 'Il disco è su https://example.com/disco' }))

    await userEvent.click(screen.getByRole('button', { name: 'https://example.com/disco' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('Aprirai example.com in una nuova scheda.')
    expect(open).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Continua' }))
    expect(open).toHaveBeenCalledExactlyOnceWith('https://example.com/disco', '_blank', 'noopener,noreferrer')
  })
})

describe('FeedPostCard · immagine', () => {
  it('mostra l\'immagine senza referrer e con il testo alternativo', () => {
    renderCard(makeFeedPost({ imageUrl: 'https://img.example.com/a.png' }))

    const image = screen.getByAltText('Immagine allegata al post')
    expect(image).toHaveAttribute('src', 'https://img.example.com/a.png')
    expect(image).toHaveAttribute('referrerpolicy', 'no-referrer')
    expect(image).toHaveAttribute('loading', 'lazy')
  })

  it('se non si carica sparisce, senza lasciare un buco', () => {
    renderCard(makeFeedPost({ imageUrl: 'https://img.example.com/rotta.png' }))

    screen.getByAltText('Immagine allegata al post').dispatchEvent(new Event('error'))

    return waitFor(() => expect(screen.queryByAltText('Immagine allegata al post')).not.toBeInTheDocument())
  })

  it('un imageUrl che non è http/https non diventa un\'immagine', () => {
    renderCard(makeFeedPost({ imageUrl: 'javascript:alert(1)' }))

    expect(screen.queryByAltText('Immagine allegata al post')).not.toBeInTheDocument()
  })

  it('senza imageUrl non c\'è nessuna immagine', () => {
    renderCard(makeFeedPost({ imageUrl: null }))

    expect(screen.queryByAltText('Immagine allegata al post')).not.toBeInTheDocument()
  })
})

describe('FeedPostCard · mi piace', () => {
  it('un anonimo che clicca va all\'accesso e al ritorno riprende la pagina', async () => {
    renderCard(makeFeedPost({ likesCount: 3 }))

    await userEvent.click(screen.getByRole('button', { name: 'Mi piace' }))

    expect(await screen.findByText(/Accesso con stato/)).toHaveTextContent(
      JSON.stringify({ from: '/feed?vicino=1', loginRequired: true }),
    )
  })

  it('con la sessione manda PUT e mostra il numero dei like', async () => {
    const calls: Request[] = []
    server.use(likeSet({ likesCount: 4, likedByMe: true }, calls))
    renderCard(makeFeedPost({ id: 'p9', likesCount: 3, likedByMe: false }), { signedIn: true })

    expect(screen.getByRole('button', { name: 'Mi piace' })).toHaveTextContent('3')
    await userEvent.click(screen.getByRole('button', { name: 'Mi piace' }))

    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].method).toBe('PUT')
    expect(new URL(calls[0].url).pathname).toBe('/api/feed-posts/p9/like')
  })

  it('un post con il mio like ha il pulsante «Togli il mi piace» e il clic manda DELETE', async () => {
    const calls: Request[] = []
    server.use(likeRemoved({ likesCount: 2, likedByMe: false }, calls))
    renderCard(makeFeedPost({ likesCount: 3, likedByMe: true }), { signedIn: true })

    await userEvent.click(screen.getByRole('button', { name: 'Togli il mi piace' }))

    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].method).toBe('DELETE')
  })
})

describe('FeedPostCard · cancellazione', () => {
  it('«Cancella» c\'è solo sui propri post', () => {
    renderCard(makeFeedPost({ author: { id: 'altro', displayName: 'Altro', avatarUrl: null } }), { signedIn: true })

    expect(screen.queryByRole('button', { name: /Cancella/ })).not.toBeInTheDocument()
  })

  it('«Cancella» non c\'è per un anonimo', () => {
    renderCard(makeFeedPost({ author: { id: ME.id, displayName: 'Io', avatarUrl: null } }))

    expect(screen.queryByRole('button', { name: /Cancella/ })).not.toBeInTheDocument()
  })

  it('chiede conferma, senza motivo, e poi cancella il post', async () => {
    const calls: Request[] = []
    server.use(postDeleted(calls))
    const { onDeleted } = renderCard(makeFeedPost({ id: 'mio', author: { id: ME.id, displayName: 'Io', avatarUrl: null } }), {
      signedIn: true,
    })

    await userEvent.click(screen.getByRole('button', { name: /Cancella/ }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Cancellare il post?')
    expect(dialog).toHaveTextContent("Il post non sarà più visibile a nessuno. L'operazione non si può annullare.")
    expect(screen.queryByLabelText('Motivo (facoltativo)')).not.toBeInTheDocument()
    expect(calls).toHaveLength(0)

    await userEvent.click(screen.getByRole('button', { name: 'Cancella post' }))

    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce())
    expect(calls[0].method).toBe('DELETE')
    expect(new URL(calls[0].url).pathname).toBe('/api/feed-posts/mio')
    expect(calls[0].headers.get('content-type')).toBeNull()
  })

  it('«Annulla» chiude la conferma senza cancellare', async () => {
    const calls: Request[] = []
    server.use(postDeleted(calls))
    renderCard(makeFeedPost({ author: { id: ME.id, displayName: 'Io', avatarUrl: null } }), { signedIn: true })
    await userEvent.click(screen.getByRole('button', { name: /Cancella/ }))

    await userEvent.click(await screen.findByRole('button', { name: 'Annulla' }))

    expect(calls).toHaveLength(0)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('con un errore mostra il messaggio e non dice «cancellato»', async () => {
    server.use(postDeleteRejected(403, 'NOT_OWNER'))
    const { onDeleted } = renderCard(makeFeedPost({ author: { id: ME.id, displayName: 'Io', avatarUrl: null } }), {
      signedIn: true,
    })

    await userEvent.click(screen.getByRole('button', { name: /Cancella/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Cancella post' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Solo chi l'ha creato può farlo.")
    expect(onDeleted).not.toHaveBeenCalled()
  })
})
