import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Map } from './index'

// MapLibre non gira in jsdom (niente WebGL): la mappa vera è sostituita da un finto. Si verifica il caricamento
// differito: prima l'attesa "Carico la mappa…", poi la mappa con le proprietà ricevute.
vi.mock('./Map', () => ({
  default: ({ label }: { label?: string }) => <div>mappa finta: {label}</div>,
}))

describe('Map (caricamento differito)', () => {
  it('mostra l\'attesa e poi la mappa con le sue proprietà', async () => {
    render(<Map center={{ latitude: 43.77, longitude: 11.25 }} zoom={5} label="Mappa degli eventi vicini" />)

    expect(screen.getByRole('status')).toHaveTextContent('Carico la mappa…')
    expect(await screen.findByText('mappa finta: Mappa degli eventi vicini')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
