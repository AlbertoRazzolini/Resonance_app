import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Avatar } from './Avatar'

// Cerchio del profilo: la foto se c'è e si carica, altrimenti l'iniziale del nome (anche un'emoji intera).
describe('Avatar', () => {
  it.each([
    ['mattia verdi', 'M'],
    ['  anna ', 'A'],
    ['🎸 Chitarrista', '🎸'],
    ['', '?'],
  ])("l'iniziale di %j è %s", (name, expected) => {
    const { container } = render(<Avatar displayName={name} avatarUrl={null} />)

    expect(container).toHaveTextContent(new RegExp(`^${expected === '?' ? '\\?' : expected}$`))
  })

  it("senza indirizzo mostra l'iniziale e nessuna immagine", () => {
    const { container } = render(<Avatar displayName="mattia" avatarUrl={null} />)

    expect(container).toHaveTextContent('M')
    expect(container.querySelector('img')).toBeNull()
  })

  it('con un indirizzo mostra la foto, decorativa e senza inviare il Referer', () => {
    const { container } = render(<Avatar displayName="mattia" avatarUrl="https://x.it/a.png" />)

    const image = container.querySelector('img')
    expect(image).toHaveAttribute('src', 'https://x.it/a.png')
    expect(image).toHaveAttribute('alt', '')
    expect(image).toHaveAttribute('referrerpolicy', 'no-referrer')
    expect(container).not.toHaveTextContent('M')
  })

  it("se la foto non si carica torna all'iniziale", () => {
    const { container } = render(<Avatar displayName="mattia" avatarUrl="https://x.it/rotta.png" />)

    fireEvent.error(container.querySelector('img')!)

    expect(container.querySelector('img')).toBeNull()
    expect(container).toHaveTextContent('M')
  })

  it('con un nuovo indirizzo riprova a caricare la foto', () => {
    const { container, rerender } = render(<Avatar displayName="mattia" avatarUrl="https://x.it/rotta.png" />)
    fireEvent.error(container.querySelector('img')!)

    rerender(<Avatar displayName="mattia" avatarUrl="https://x.it/nuova.png" />)

    expect(container.querySelector('img')).toHaveAttribute('src', 'https://x.it/nuova.png')
  })

  it('la misura grande aggiunge la sua classe', () => {
    const { container } = render(<Avatar displayName="mattia" avatarUrl={null} size="lg" />)

    expect(container.firstElementChild).toHaveClass('rs-avatar', 'rs-avatar--lg')
  })
})
