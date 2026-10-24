import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RadarMap } from './RadarMap'

// Mappa statica della landing: un'immagine con testo alternativo, con i due tipi di segnaposto dell'app, mai cliccabile.
describe('RadarMap', () => {
  it("è un'immagine con una descrizione per i lettori di schermo", () => {
    render(<RadarMap />)

    expect(
      screen.getByRole('img', {
        name: /un concerto ufficiale e due eventi indie/i,
      }),
    ).toBeInTheDocument()
  })

  it('mostra un segnaposto ufficiale e due indie, come negli eventi vicini', () => {
    const { container } = render(<RadarMap />)

    expect(container.querySelectorAll('[data-kind="official"]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-kind="indie"]')).toHaveLength(2)
  })

  it('non ha nulla di cliccabile: né link né pulsanti', () => {
    render(<RadarMap />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('dichiara di essere un esempio, perché i segnaposto non sono eventi veri', () => {
    render(<RadarMap />)

    expect(screen.getByText('Esempio illustrativo')).toBeInTheDocument()
  })
})
