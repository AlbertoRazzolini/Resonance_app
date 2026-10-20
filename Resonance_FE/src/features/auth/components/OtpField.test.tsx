import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { OtpField } from './OtpField'

// Codice di verifica a 6 cifre in 6 caselle: solo cifre, il cursore avanza da solo, Backspace torna indietro, si può
// incollare il codice intero e un errore colora le caselle (riuso adattato di `CampoCodiceOtp` di NoseY).
function Harness({ initial = '', error }: { initial?: string; error?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <OtpField value={value} onChange={setValue} error={error} />
      <output aria-label="valore">{value}</output>
    </>
  )
}

const boxes = () => screen.getAllByRole('textbox')
const value = () => screen.getByLabelText('valore').textContent

describe('OtpField', () => {
  it('mostra il gruppo "Codice" con sei caselle numerate', () => {
    render(<Harness />)

    expect(screen.getByRole('group', { name: 'Codice' })).toBeInTheDocument()
    expect(boxes()).toHaveLength(6)
    expect(screen.getByLabelText('Cifra 1 di 6')).toBeInTheDocument()
    expect(screen.getByLabelText('Cifra 6 di 6')).toBeInTheDocument()
  })

  it('la prima casella propone il codice ricevuto (one-time-code) e tutte hanno il tastierino numerico', () => {
    render(<Harness />)

    expect(boxes()[0]).toHaveAttribute('autocomplete', 'one-time-code')
    expect(boxes()[1]).toHaveAttribute('autocomplete', 'off')
    boxes().forEach((box) => expect(box).toHaveAttribute('inputmode', 'numeric'))
  })

  it("scrivendo le cifre una dopo l'altra il cursore passa alla casella successiva", async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(boxes()[0])
    await user.keyboard('4820')

    expect(value()).toBe('4820')
    expect(boxes()[4]).toHaveFocus()
  })

  it('ignora tutto ciò che non è una cifra', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(boxes()[0])
    await user.keyboard('a1-b2 3.')

    expect(value()).toBe('123')
  })

  it('incollando il codice intero riempie le sei caselle', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(boxes()[0])
    await user.paste('482019')

    expect(value()).toBe('482019')
  })

  it('incollando un codice con spazi o trattini toglie quello che non è una cifra', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(boxes()[0])
    await user.paste('482 019')

    expect(value()).toBe('482019')
  })

  it('incollando più di sei cifre tiene solo le prime sei', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(boxes()[0])
    await user.paste('12345678')

    expect(value()).toBe('123456')
  })

  it('Backspace su una casella piena toglie quella cifra e quelle dopo', async () => {
    const user = userEvent.setup()
    render(<Harness initial="123456" />)

    await user.click(boxes()[3])
    await user.keyboard('{Backspace}')

    expect(value()).toBe('123')
  })

  it('Backspace su una casella vuota toglie la cifra prima e ci va sopra', async () => {
    const user = userEvent.setup()
    render(<Harness initial="12" />)

    await user.click(boxes()[2])
    await user.keyboard('{Backspace}')

    expect(value()).toBe('1')
    expect(boxes()[1]).toHaveFocus()
  })

  it('con un errore mostra il messaggio sotto le caselle e le segna come non valide', () => {
    render(
      <Harness initial="482019" error="Il codice non è corretto. Controlla l'email e riprova." />,
    )

    expect(
      screen.getByText("Il codice non è corretto. Controlla l'email e riprova."),
    ).toBeInTheDocument()
    boxes().forEach((box) => expect(box).toHaveAttribute('aria-invalid', 'true'))
  })

  it('senza errore le caselle non sono segnate come non valide', () => {
    render(<Harness initial="48" />)

    boxes().forEach((box) => expect(box).not.toHaveAttribute('aria-invalid', 'true'))
  })
})
