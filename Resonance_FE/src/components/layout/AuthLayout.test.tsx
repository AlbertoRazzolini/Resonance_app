import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { ROUTES } from '@/app/routes'
import { AuthLayout } from './AuthLayout'

// Cornice delle pagine di accesso: logo e freccia indietro, che porta alla home salvo dove la rotta indica un'altra destinazione.
function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: ROUTES.home, element: <p>Home</p> },
      {
        Component: AuthLayout,
        children: [
          { path: '/prima', element: <p>Prima pagina</p> },
          { path: '/seconda', handle: { backTo: '/prima' }, element: <p>Seconda pagina</p> },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(
    <Provider store={makeStore()}>
      <RouterProvider router={router} />
    </Provider>,
  )
  return router
}

describe('AuthLayout', () => {
  it('mostra il logo e il contenuto della pagina', () => {
    renderAt('/prima')
    expect(screen.getByText('Prima pagina')).toBeInTheDocument()
    expect(screen.getByLabelText('Resonance')).toBeInTheDocument()
  })

  it('la freccia indietro porta alla home, non alla pagina precedente della cronologia', async () => {
    const router = renderAt('/prima')
    expect(screen.getByRole('link', { name: 'Indietro' })).toHaveAttribute('href', ROUTES.home)

    await userEvent.click(screen.getByRole('link', { name: 'Indietro' }))
    expect(router.state.location.pathname).toBe(ROUTES.home)
  })

  it('se la rotta indica una destinazione (handle.backTo) la freccia porta lì', async () => {
    const router = renderAt('/seconda')
    expect(screen.getByRole('link', { name: 'Indietro' })).toHaveAttribute('href', '/prima')

    await userEvent.click(screen.getByRole('link', { name: 'Indietro' }))
    expect(router.state.location.pathname).toBe('/prima')
  })
})
