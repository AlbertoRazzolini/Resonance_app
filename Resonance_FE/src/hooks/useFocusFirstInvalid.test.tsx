import { render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import { useFocusFirstInvalid } from './useFocusFirstInvalid'

// Dopo un invio con errori il cursore va sul primo campo sbagliato, anche fuori dalla parte visibile della pagina
// (sul telefono «Pubblica» sta in fondo e il titolo in cima). Il primo campo è il primo nell'ordine della pagina,
// non il primo errore scoperto.
function Harness({ invalid }: { invalid: string[] }) {
  const [attempts, setAttempts] = useState(0)
  const ref = useFocusFirstInvalid(attempts)
  return (
    <form ref={ref}>
      {['uno', 'due', 'tre'].map((name) => (
        <input key={name} aria-label={name} aria-invalid={invalid.includes(name)} />
      ))}
      <button type="button" onClick={() => setAttempts((current) => current + 1)}>
        Invia
      </button>
    </form>
  )
}

describe('useFocusFirstInvalid', () => {
  it('a un tentativo con errori mette il cursore sul primo campo sbagliato della pagina', async () => {
    const user = userEvent.setup()
    render(<Harness invalid={['tre', 'due']} />)

    await user.click(screen.getByRole('button', { name: 'Invia' }))

    expect(screen.getByLabelText('due')).toHaveFocus()
  })

  it('prima di qualunque tentativo non sposta il cursore', () => {
    render(<Harness invalid={['uno']} />)

    expect(screen.getByLabelText('uno')).not.toHaveFocus()
  })

  it('senza campi sbagliati lascia il cursore dov\'è', async () => {
    const user = userEvent.setup()
    render(<Harness invalid={[]} />)

    await user.click(screen.getByRole('button', { name: 'Invia' }))

    expect(screen.getByRole('button', { name: 'Invia' })).toHaveFocus()
  })

  it('porta il campo al centro dello schermo con lo scorrimento del browser', async () => {
    const user = userEvent.setup()
    const calls: unknown[] = []
    // jsdom non fa lo scorrimento: si registra la richiesta
    Element.prototype.scrollIntoView = function (options?: unknown) {
      calls.push(options)
    }
    render(<Harness invalid={['tre']} />)

    await user.click(screen.getByRole('button', { name: 'Invia' }))

    expect(calls).toEqual([{ block: 'center' }])
  })
})
