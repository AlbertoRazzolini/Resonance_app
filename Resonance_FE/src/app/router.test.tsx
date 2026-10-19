import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { routes } from './router'
import { ROUTES } from './routes'

// Prova del router: pagina iniziale, pagina "non trovato" e barra con menu a scomparsa (sotto md).
function renderAt(path: string) {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />)
}

describe('router', () => {
  it('mostra la pagina iniziale su "/"', async () => {
    renderAt(ROUTES.home)
    expect(await screen.findByRole('heading', { name: 'Resonance' })).toBeInTheDocument()
  })

  it('mostra "Pagina non trovata" per un percorso sconosciuto', async () => {
    renderAt('/percorso-che-non-esiste')
    expect(await screen.findByRole('heading', { name: 'Pagina non trovata' })).toBeInTheDocument()
  })

  it('la barra ha il pulsante del menu a scomparsa', async () => {
    renderAt(ROUTES.home)
    expect(await screen.findByRole('button', { name: 'Apri il menu' })).toBeInTheDocument()
  })
})
