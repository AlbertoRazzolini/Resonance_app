import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SuspensionDialog } from './SuspensionDialog'

// Finestra di sospensione: motivo obbligatorio, una durata a scelta fra le fisse o indeterminata, conferma spenta finché
// il form non è valido, una sola durata alla volta nel corpo inviato, errore del server dentro la finestra.
function setup(props: Partial<React.ComponentProps<typeof SuspensionDialog>> = {}) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <SuspensionDialog show displayName="Marco Rossi" onConfirm={onConfirm} onCancel={onCancel} {...props} />,
  )
  return { onConfirm, onCancel, user: userEvent.setup() }
}

const confirm = () => screen.getByRole('button', { name: 'Sospendi' })

describe('SuspensionDialog', () => {
  it('mostra il titolo con il nome, l’avviso della disconnessione e le sei durate, nessuna scelta', () => {
    setup()

    expect(screen.getByRole('dialog', { name: 'Sospendere Marco Rossi?' })).toBeInTheDocument()
    expect(screen.getByText("L'utente verrà disconnesso subito.")).toBeInTheDocument()
    const labels = screen.getAllByRole('radio').map((radio) => (radio as HTMLInputElement).labels?.[0]?.textContent)
    expect(labels).toEqual(['1 giorno', '3 giorni', '7 giorni', '30 giorni', '90 giorni', 'Indeterminata'])
    screen.getAllByRole('radio').forEach((radio) => expect(radio).not.toBeChecked())
  })

  it('tiene «Sospendi» spento finché mancano il motivo o la durata', async () => {
    const { user } = setup()
    expect(confirm()).toBeDisabled()

    await user.type(screen.getByLabelText('Motivo'), 'Spam')
    expect(confirm()).toBeDisabled()

    await user.click(screen.getByRole('radio', { name: '7 giorni' }))
    expect(confirm()).toBeEnabled()
  })

  it('consegna motivo e giorni scelti', async () => {
    const { user, onConfirm } = setup()

    await user.type(screen.getByLabelText('Motivo'), '  Spam ripetuto ')
    await user.click(screen.getByRole('radio', { name: '30 giorni' }))
    await user.click(confirm())

    expect(onConfirm).toHaveBeenCalledWith({ reason: 'Spam ripetuto', durationDays: 30 })
  })

  it('con «Indeterminata» consegna il solo motivo', async () => {
    const { user, onConfirm } = setup()

    await user.type(screen.getByLabelText('Motivo'), 'Truffa')
    await user.click(screen.getByRole('radio', { name: 'Indeterminata' }))
    await user.click(confirm())

    expect(onConfirm).toHaveBeenCalledWith({ reason: 'Truffa' })
  })

  it('cambiando la durata vale solo l’ultima scelta: mai giorni e indeterminata insieme', async () => {
    const { user, onConfirm } = setup()

    await user.type(screen.getByLabelText('Motivo'), 'Truffa')
    await user.click(screen.getByRole('radio', { name: '7 giorni' }))
    await user.click(screen.getByRole('radio', { name: 'Indeterminata' }))
    await user.click(confirm())

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm.mock.calls[0][0]).toEqual({ reason: 'Truffa' })
  })

  it('mostra l’errore del motivo dopo averlo lasciato vuoto', async () => {
    const { user } = setup()
    expect(screen.queryByText('Scrivi il motivo (massimo 500 caratteri).')).not.toBeInTheDocument()

    await user.click(screen.getByLabelText('Motivo'))
    await user.tab()

    expect(screen.getByText('Scrivi il motivo (massimo 500 caratteri).')).toBeInTheDocument()
  })

  it('mostra il contatore del motivo e non ne accetta più di 500', async () => {
    const { user } = setup()

    await user.click(screen.getByLabelText('Motivo'))
    await user.paste('a'.repeat(520))

    expect(screen.getByText('500 / 500')).toBeInTheDocument()
  })

  it('mostra l’errore del server dentro la finestra, che resta aperta', () => {
    setup({ error: { status: 403, data: { code: 'INSUFFICIENT_PLATFORM_LEVEL' } } })

    expect(screen.getByRole('alert')).toHaveTextContent('Puoi agire solo su account con un ruolo inferiore al tuo')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('con `busy` spegne i pulsanti per non confermare due volte', async () => {
    const { user } = setup({ busy: true })

    expect(screen.getByRole('button', { name: 'Annulla' })).toBeDisabled()
    await user.type(screen.getByLabelText('Motivo'), 'Spam')
    expect(confirm()).toBeDisabled()
  })

  it('«Annulla» chiude senza consegnare niente', async () => {
    const { user, onCancel, onConfirm } = setup()

    await user.click(screen.getByRole('button', { name: 'Annulla' }))

    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
