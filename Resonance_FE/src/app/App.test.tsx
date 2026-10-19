import { render, screen } from '@testing-library/react'
import { refreshRejected } from '@/test/handlers/auth'
import { server } from '@/test/server'
import { App } from './App'

// Prova di montaggio: all'avvio il refresh senza cookie rende l'utente anonimo, poi l'app mostra il marchio.
describe('App', () => {
  it('si monta e mostra il marchio Resonance', async () => {
    server.use(refreshRejected(401, 'REFRESH_TOKEN_INVALID'))
    render(<App />)
    expect(await screen.findByRole('link', { name: 'Resonance' })).toBeInTheDocument()
  })
})
