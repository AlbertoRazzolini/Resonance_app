import { render, screen } from '@testing-library/react'
import { App } from './App'

// Prova di montaggio: l'app si disegna e mostra il marchio nella barra di navigazione.
describe('App', () => {
  it('si monta e mostra il marchio Resonance', async () => {
    render(<App />)
    expect(await screen.findByRole('link', { name: 'Resonance' })).toBeInTheDocument()
  })
})
