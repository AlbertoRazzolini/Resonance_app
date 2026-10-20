import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExternalLink } from './ExternalLink'

// Link verso un sito esterno: solo http/https, conferma con il dominio prima di uscire, apertura senza referrer.
afterEach(() => vi.restoreAllMocks())

describe('ExternalLink · indirizzo valido', () => {
  it('è un pulsante con il testo dato, non un link che porta fuori subito', () => {
    render(<ExternalLink href="https://www.ticketone.it/x">Acquista il biglietto</ExternalLink>)

    expect(screen.getByRole('button', { name: 'Acquista il biglietto' })).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('il clic apre la conferma con il dominio e non apre ancora niente', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    render(<ExternalLink href="https://www.ticketone.it/x">Biglietto</ExternalLink>)

    await userEvent.click(screen.getByRole('button', { name: 'Biglietto' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Stai uscendo da Resonance')
    expect(dialog).toHaveTextContent('Aprirai www.ticketone.it in una nuova scheda.')
    expect(open).not.toHaveBeenCalled()
  })

  it('"Annulla" chiude la conferma senza aprire niente', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    render(<ExternalLink href="https://example.com">Vai</ExternalLink>)
    await userEvent.click(screen.getByRole('button', { name: 'Vai' }))

    await userEvent.click(await screen.findByRole('button', { name: 'Annulla' }))

    expect(open).not.toHaveBeenCalled()
    // La finestra esce con un'animazione: sparisce poco dopo il clic
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('"Continua" apre l\'indirizzo in una nuova scheda senza referrer né collegamento con questa pagina', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    render(<ExternalLink href="https://example.com/biglietti?id=7">Vai</ExternalLink>)
    await userEvent.click(screen.getByRole('button', { name: 'Vai' }))

    await userEvent.click(await screen.findByRole('button', { name: 'Continua' }))

    expect(open).toHaveBeenCalledExactlyOnceWith('https://example.com/biglietti?id=7', '_blank', 'noopener,noreferrer')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('senza testo mostra il dominio', () => {
    render(<ExternalLink href="https://example.com/biglietti" />)

    expect(screen.getByRole('button', { name: 'example.com' })).toBeInTheDocument()
  })

  it('con un utente nell\'indirizzo la conferma mostra il dominio vero', async () => {
    render(<ExternalLink href="https://www.banca.it@evil.example/login">Accedi</ExternalLink>)

    await userEvent.click(screen.getByRole('button', { name: 'Accedi' }))

    expect(await screen.findByRole('dialog')).toHaveTextContent('Aprirai evil.example in una nuova scheda.')
  })
})

describe('ExternalLink · indirizzo non valido', () => {
  it.each(['javascript:alert(1)', 'data:text/html,<b>x</b>', 'ftp://example.com', 'non è un indirizzo'])(
    '%s resta testo inerte: niente pulsante, niente link',
    (href) => {
      const open = vi.spyOn(window, 'open').mockReturnValue(null)
      render(<ExternalLink href={href}>Biglietto</ExternalLink>)

      expect(screen.getByText('Biglietto')).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
      expect(open).not.toHaveBeenCalled()
    },
  )

  it('senza testo mostra l\'indirizzo così com\'è, come testo', () => {
    render(<ExternalLink href="javascript:alert(1)" />)

    expect(screen.getByText('javascript:alert(1)')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
