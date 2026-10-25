import { render } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeLoginResponse } from '@/test/fixtures/users'
import { Component as EditProfilePage } from './EditProfilePage'

// Modifica profilo: la pagina riempie tutta la larghezza della card (25 ottobre), come Pubblica concerto e Pubblica indie
// event. jsdom non fa il layout: si controlla la classe sulla pagina (la regola `.rs-edit--full` la prova
// `newEventPages.test.tsx`).
describe('EditProfilePage', () => {
  it('usa tutta la larghezza della card', () => {
    const store = makeStore()
    store.dispatch(sessionStarted(makeLoginResponse()))

    const { container } = render(
      <Provider store={store}>
        <MemoryRouter>
          <EditProfilePage />
        </MemoryRouter>
      </Provider>,
    )

    expect(container.firstElementChild).toHaveClass('rs-edit', 'rs-edit--full')
  })
})
