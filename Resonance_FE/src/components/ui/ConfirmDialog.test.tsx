import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

// Finestra di conferma: titolo, testo e due pulsanti; con `withReason` un motivo facoltativo (massimo 500) che si
// consegna senza spazi ai bordi o non si consegna se vuoto; con `busy` i pulsanti sono spenti.
function setup(props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <ConfirmDialog
      show
      title="Cancellare l'evento?"
      body="Non si può annullare."
      confirmLabel="Cancella evento"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  )
  return { onConfirm, onCancel, user: userEvent.setup() }
}

describe('ConfirmDialog', () => {
  it('mostra titolo, testo e i due pulsanti', () => {
    setup()

    expect(screen.getByRole('dialog', { name: "Cancellare l'evento?" })).toBeInTheDocument()
    expect(screen.getByText('Non si può annullare.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancella evento' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Annulla' })).toBeInTheDocument()
  })

  it('senza `show` non disegna niente', () => {
    setup({ show: false })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('«Annulla» avvisa chi ascolta e non conferma', async () => {
    const { user, onCancel, onConfirm } = setup()

    await user.click(screen.getByRole('button', { name: 'Annulla' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('senza `withReason` non c\'è il campo del motivo e la conferma non porta niente', async () => {
    const { user, onConfirm } = setup()

    expect(screen.queryByLabelText('Motivo (facoltativo)')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancella evento' }))

    expect(onConfirm).toHaveBeenCalledWith(undefined)
  })

  it('con `withReason` consegna il motivo senza spazi ai bordi', async () => {
    const { user, onConfirm } = setup({ withReason: true })

    await user.type(screen.getByLabelText('Motivo (facoltativo)'), '  Data sbagliata ')
    await user.click(screen.getByRole('button', { name: 'Cancella evento' }))

    expect(onConfirm).toHaveBeenCalledWith('Data sbagliata')
  })

  it('un motivo vuoto o di soli spazi non si consegna', async () => {
    const { user, onConfirm } = setup({ withReason: true })

    await user.type(screen.getByLabelText('Motivo (facoltativo)'), '   ')
    await user.click(screen.getByRole('button', { name: 'Cancella evento' }))

    expect(onConfirm).toHaveBeenCalledWith(undefined)
  })

  it('conta i caratteri del motivo sul limite di 500', async () => {
    const { user } = setup({ withReason: true })

    await user.type(screen.getByLabelText('Motivo (facoltativo)'), 'ciao')

    expect(screen.getByText('4 / 500')).toBeInTheDocument()
    expect(screen.getByLabelText('Motivo (facoltativo)')).toHaveAttribute('maxlength', '500')
  })

  it('con `busy` i pulsanti sono spenti (niente doppia conferma)', () => {
    setup({ busy: true })

    expect(screen.getByRole('button', { name: 'Cancella evento' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Annulla' })).toBeDisabled()
  })
})
