import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import BlurText from './BlurText'

// BlurText (ReactBits): titolo che entra parola per parola da sfocato a nitido. Qui si prova l'accessibilità e la
// struttura; l'animazione vera la fa la libreria motion e si guarda nel browser.

describe('BlurText', () => {
  it('il testo si legge una sola volta: i pezzi animati sono nascosti agli screen reader', () => {
    const { container } = render(<BlurText text="Sali sul palco" trigger="load" />)

    expect(screen.getByText('Sali sul palco')).toBeInTheDocument()
    const pieces = container.querySelectorAll('[aria-hidden="true"]')
    expect(pieces).toHaveLength(3)
    expect(Array.from(pieces).map((piece) => piece.textContent?.trim())).toEqual([
      'Sali',
      'sul',
      'palco',
    ])
  })

  it('le parole restano separate da uno spazio che non collassa (alla fine di un pezzo uno spazio normale sparirebbe)', () => {
    const { container } = render(<BlurText text="Sali sul palco" trigger="load" />)

    const pieces = Array.from(container.querySelectorAll('[aria-hidden="true"]'))
    const nbsp = String.fromCharCode(160)
    expect(pieces.map((piece) => piece.textContent)).toEqual([`Sali${nbsp}`, `sul${nbsp}`, 'palco'])
  })

  it('anche per lettere lo spazio fra le parole è un pezzo che non collassa', () => {
    const { container } = render(<BlurText text="a b" trigger="load" animateBy="letters" />)

    const pieces = Array.from(container.querySelectorAll('[aria-hidden="true"]'))
    expect(pieces.map((piece) => piece.textContent)).toEqual(['a', String.fromCharCode(160), 'b'])
  })

  it('per lettere crea un pezzo per ogni carattere, spazi compresi', () => {
    const { container } = render(<BlurText text="Sali sul" trigger="load" animateBy="letters" />)

    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(8)
  })

  it('applica la classe al contenitore, che è uno span (sta dentro i titoli)', () => {
    const { container } = render(
      <BlurText text="scena" trigger="load" className="rs-landing__accent" />,
    )

    const root = container.firstElementChild as HTMLElement
    expect(root.tagName).toBe('SPAN')
    expect(root).toHaveClass('rs-landing__accent')
  })

  it('con un testo vuoto non scrive niente di leggibile', () => {
    const { container } = render(<BlurText text="" trigger="load" />)

    expect(container).toHaveTextContent('')
  })
})
