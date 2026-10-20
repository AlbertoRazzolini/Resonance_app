import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { makeStore } from './store'
import { routes } from './router'
import { ROUTES } from './routes'

// Prova del router: pagina iniziale, pagina "non trovato" e barra con menu a scomparsa (sotto md).
// Serve uno store: la barra degli avvisi dentro AppShell legge lo stato.
function renderAt(path: string) {
  render(
    <Provider store={makeStore()}>
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />
    </Provider>,
  )
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

  it('la freccia indietro di /verifica porta alla registrazione, quella di /accesso alla home', async () => {
    renderAt(ROUTES.verify)
    expect(await screen.findByRole('link', { name: 'Indietro' })).toHaveAttribute(
      'href',
      ROUTES.register,
    )
  })

  it('la freccia indietro del reset porta a "password dimenticata", quella di "password dimenticata" alla home', async () => {
    renderAt(ROUTES.resetPassword)
    expect(await screen.findByRole('link', { name: 'Indietro' })).toHaveAttribute(
      'href',
      ROUTES.forgotPassword,
    )
  })

  it('la freccia indietro di "password dimenticata" porta alla home', async () => {
    renderAt(ROUTES.forgotPassword)
    expect(await screen.findByRole('link', { name: 'Indietro' })).toHaveAttribute(
      'href',
      ROUTES.home,
    )
  })

  it('la freccia indietro di /accesso porta alla home', async () => {
    renderAt(ROUTES.login)
    expect(await screen.findByRole('link', { name: 'Indietro' })).toHaveAttribute(
      'href',
      ROUTES.home,
    )
  })

  it('la barra ha il pulsante del menu a scomparsa', async () => {
    renderAt(ROUTES.home)
    expect(await screen.findByRole('button', { name: 'Apri il menu' })).toBeInTheDocument()
  })
})
