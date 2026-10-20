import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { GenreInput } from './GenreInput'

// Campo dei generi a chip: Invio aggiunge (senza inviare il form), × toglie, uscendo dal campo si aggiunge quello
// scritto, e i limiti (30 caratteri, 10 generi) si vedono come messaggio.
function Harness({ initial = [] as string[], onSubmit = () => {} }: { initial?: string[]; onSubmit?: () => void }) {
  const [tags, setTags] = useState(initial)
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <GenreInput id="genres" tags={tags} onChange={setTags} />
      <button type="submit">Invia</button>
      <output data-testid="tags">{tags.join('|')}</output>
    </form>
  )
}

describe('GenreInput', () => {
  it('Invio aggiunge il genere normalizzato come chip e svuota il campo', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText('Generi'), '  Post-Punk {Enter}')

    expect(screen.getByTestId('tags')).toHaveTextContent('post-punk')
    expect(screen.getByRole('listitem')).toHaveTextContent('post-punk')
    expect(screen.getByLabelText('Generi')).toHaveValue('')
  })

  it('Invio nel campo non invia il form', async () => {
    const user = userEvent.setup()
    let submitted = 0
    render(<Harness onSubmit={() => (submitted += 1)} />)

    await user.type(screen.getByLabelText('Generi'), 'rock{Enter}')

    expect(submitted).toBe(0)
  })

  it('uscendo dal campo si aggiunge anche il genere non ancora confermato', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText('Generi'), 'jazz')
    await user.click(screen.getByRole('button', { name: 'Invia' }))

    expect(screen.getByTestId('tags')).toHaveTextContent('jazz')
  })

  it('«Togli» elimina il chip', async () => {
    const user = userEvent.setup()
    render(<Harness initial={['rock', 'jazz']} />)

    await user.click(screen.getByRole('button', { name: 'Togli rock' }))

    expect(screen.getByTestId('tags')).toHaveTextContent(/^jazz$/)
  })

  it('un doppione non si aggiunge', async () => {
    const user = userEvent.setup()
    render(<Harness initial={['rock']} />)

    await user.type(screen.getByLabelText('Generi'), 'ROCK{Enter}')

    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('un genere di oltre 30 caratteri è rifiutato con un messaggio sotto il campo', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText('Generi'), `${'a'.repeat(31)}{Enter}`)

    expect(screen.getByRole('alert')).toHaveTextContent('Un genere può avere al massimo 30 caratteri.')
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('con 10 generi un altro è rifiutato e il contatore dice 10 / 10', async () => {
    const user = userEvent.setup()
    const ten = Array.from({ length: 10 }, (_, index) => `g${index}`)
    render(<Harness initial={ten} />)

    await user.type(screen.getByLabelText('Generi'), 'extra{Enter}')

    expect(screen.getByText('10 / 10')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Puoi indicare al massimo 10 generi.')
    expect(screen.getAllByRole('listitem')).toHaveLength(10)
  })

  it("l'errore del form si vede sotto il campo", () => {
    render(<GenreInput id="genres" tags={[]} onChange={() => {}} error="Genere non valido" />)

    expect(screen.getByRole('alert')).toHaveTextContent('Genere non valido')
  })
})
