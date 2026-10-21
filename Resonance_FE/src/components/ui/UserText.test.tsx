import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserText } from './UserText'

// Testo scritto da un utente (decisione 79): solo testo e link http/https con conferma, mai HTML; Review Focus 9.
afterEach(() => vi.restoreAllMocks())

describe('UserText · testo semplice', () => {
  it('mostra il testo così com\'è', () => {
    render(<UserText text="Suono la chitarra" />)

    expect(screen.getByText('Suono la chitarra')).toBeInTheDocument()
  })

  it('non crea nessun link o pulsante se non ci sono indirizzi', () => {
    render(<UserText text="Solo parole, niente indirizzi" />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('mantiene gli a capo con lo stile, senza inserire <br>', () => {
    const { container } = render(<UserText text={'riga uno\nriga due'} />)

    expect(container.querySelector('br')).toBeNull()
    expect(container.firstElementChild).toHaveClass('rs-user-text')
    expect(container.textContent).toBe('riga uno\nriga due')
  })
})

describe('UserText · HTML e script restano testo (Review Focus 9)', () => {
  it('<script> resta testo: nessun elemento creato, il codice si legge com\'è', () => {
    const { container } = render(<UserText text={'<script>alert(1)</script>'} />)

    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument()
    expect(container.querySelector('script')).toBeNull()
  })

  it('<img onerror> resta testo: nessuna immagine creata', () => {
    const { container } = render(<UserText text="<img src=x onerror=alert(1)>" />)

    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
  })

  it('<a href="javascript:..."> scritto a mano resta testo, non un link', () => {
    const { container } = render(<UserText text={'<a href="javascript:alert(1)">clic</a>'} />)

    expect(container.querySelector('a')).toBeNull()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it.each(['javascript:alert(1)', 'data:text/html,<b>x</b>', 'ftp://example.com/file', 'www.example.com'])(
    '%s non diventa un link: resta testo inerte',
    (text) => {
      render(<UserText text={`vai su ${text} ora`} />)

      expect(screen.queryByRole('button')).not.toBeInTheDocument()
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
    },
  )
})

describe('UserText · indirizzi http e https', () => {
  it('un URL https diventa un pulsante con l\'indirizzo come scritto, il resto resta testo', () => {
    render(<UserText text="Ascoltami su https://example.com/musica oggi" />)

    expect(screen.getByRole('button', { name: 'https://example.com/musica' })).toBeInTheDocument()
    expect(screen.getByText(/Ascoltami su/)).toBeInTheDocument()
    expect(screen.getByText(/oggi/)).toBeInTheDocument()
  })

  it('anche http è un link', () => {
    render(<UserText text="vecchio sito http://example.com" />)

    expect(screen.getByRole('button', { name: 'http://example.com' })).toBeInTheDocument()
  })

  it('il clic apre la conferma con il dominio; "Continua" apre la scheda senza referrer', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    render(<UserText text="Biglietti: https://www.ticketone.it/x?id=7" />)

    await userEvent.click(screen.getByRole('button', { name: 'https://www.ticketone.it/x?id=7' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Aprirai www.ticketone.it in una nuova scheda.')
    expect(open).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Continua' }))
    expect(open).toHaveBeenCalledExactlyOnceWith('https://www.ticketone.it/x?id=7', '_blank', 'noopener,noreferrer')
  })

  it('con due indirizzi nello stesso testo li rende entrambi', () => {
    render(<UserText text="https://a.example e https://b.example" />)

    expect(screen.getByRole('button', { name: 'https://a.example' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'https://b.example' })).toBeInTheDocument()
  })

  it('un indirizzo a capo di riga è un link e l\'a capo resta', () => {
    const { container } = render(<UserText text={'prima\nhttps://example.com\ndopo'} />)

    expect(screen.getByRole('button', { name: 'https://example.com' })).toBeInTheDocument()
    expect(container.textContent).toBe('prima\nhttps://example.com\ndopo')
  })

  it('la conferma mostra il dominio vero anche con un utente nell\'indirizzo', async () => {
    render(<UserText text="https://www.banca.it@evil.example/login" />)

    await userEvent.click(screen.getByRole('button'))

    expect(await screen.findByRole('dialog')).toHaveTextContent('Aprirai evil.example in una nuova scheda.')
  })
})

describe('UserText · punteggiatura dopo l\'indirizzo', () => {
  it.each([
    ['vedi https://example.com/a.', 'https://example.com/a'],
    ['vedi https://example.com/a, poi', 'https://example.com/a'],
    ['(vedi https://example.com/a)', 'https://example.com/a'],
    ['davvero https://example.com/a?!', 'https://example.com/a'],
    ['elenco: https://example.com/a;', 'https://example.com/a'],
  ])('in «%s» il link è %s e la punteggiatura resta testo', (text, link) => {
    const { container } = render(<UserText text={text} />)

    expect(screen.getByRole('button', { name: link })).toBeInTheDocument()
    expect(container.textContent).toBe(text)
  })

  it('la punteggiatura dentro l\'indirizzo resta nel link', () => {
    render(<UserText text="https://example.com/a.b?x=1&y=2#c" />)

    expect(screen.getByRole('button', { name: 'https://example.com/a.b?x=1&y=2#c' })).toBeInTheDocument()
  })
})
