import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from './EmptyState'

// Stato vuoto di un elenco: titolo, suggerimento e, se serve, un'azione.
describe('EmptyState', () => {
  it('mostra il titolo e il suggerimento', () => {
    render(<EmptyState title="Nessun indie event entro 15 km" hint="Prova ad allargare il raggio." />)

    expect(screen.getByText('Nessun indie event entro 15 km')).toBeInTheDocument()
    expect(screen.getByText('Prova ad allargare il raggio.')).toBeInTheDocument()
  })

  it('mostra l\'azione passata come figlio', () => {
    render(
      <EmptyState title="Vuoto">
        <button type="button">Fai qualcosa</button>
      </EmptyState>,
    )

    expect(screen.getByRole('button', { name: 'Fai qualcosa' })).toBeInTheDocument()
  })
})
