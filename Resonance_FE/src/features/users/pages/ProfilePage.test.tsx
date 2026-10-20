import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/app/routes'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { makePage } from '@/test/fixtures/events'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import { myConcertsFound } from '@/test/handlers/events'
import { server } from '@/test/server'
import type { MeResponse } from '@/types/users'
import { Component as ProfilePage } from './ProfilePage'

// Profilo dell'utente: foto o iniziale, nome, ruoli, città e bio, il collegamento alla modifica e l'avviso dopo un
// salvataggio (solo se arriva dal form, dallo stato del router).
function renderProfile(user: MeResponse, state?: unknown) {
  const store = makeStore()
  store.dispatch(sessionStarted(makeLoginResponse({ user })))
  const router = createMemoryRouter([{ path: ROUTES.profile, element: <ProfilePage /> }], {
    initialEntries: [{ pathname: ROUTES.profile, state }],
  })
  render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
}

describe('ProfilePage', () => {
  it('mostra nome, ruoli, città e bio', () => {
    renderProfile(
      makeMe({
        displayName: 'Mattia',
        roles: ['FAN', 'MUSICIAN'],
        city: 'Bologna',
        bio: 'Suono la chitarra',
      }),
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Mattia' })).toBeInTheDocument()
    expect(screen.getByText('Fan')).toBeInTheDocument()
    expect(screen.getByText('Musicista')).toBeInTheDocument()
    expect(screen.queryByText('Host')).not.toBeInTheDocument()
    expect(screen.getByText('Bologna')).toBeInTheDocument()
    expect(screen.getByText('Suono la chitarra')).toBeInTheDocument()
  })

  it('con città e bio vuote non disegna righe vuote', () => {
    renderProfile(makeMe({ displayName: 'Mattia' }))

    expect(screen.queryByTestId('profile-city')).not.toBeInTheDocument()
    expect(screen.queryByTestId('profile-bio')).not.toBeInTheDocument()
  })

  it('mostra la foto se il profilo ha un indirizzo', () => {
    renderProfile(makeMe({ avatarUrl: 'https://x.it/a.png' }))

    expect(document.querySelector('img')).toHaveAttribute('src', 'https://x.it/a.png')
  })

  it('«Modifica profilo» porta al form', () => {
    renderProfile(makeMe())

    expect(screen.getByRole('link', { name: 'Modifica profilo' })).toHaveAttribute(
      'href',
      ROUTES.profileEdit,
    )
  })

  it('sotto il profilo mostra le schede dei contenuti secondo i ruoli', () => {
    server.use(myConcertsFound([makePage([])]))
    renderProfile(makeMe({ roles: ['FAN', 'HOST'] }))

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Concerti', 'Post'])
  })

  it('dopo un salvataggio mostra «Profilo aggiornato.»', () => {
    renderProfile(makeMe(), { profileUpdated: true })

    expect(screen.getByRole('status')).toHaveTextContent('Profilo aggiornato.')
  })

  it("senza il segno del salvataggio non mostra l'avviso", () => {
    renderProfile(makeMe())

    expect(screen.queryByText('Profilo aggiornato.')).not.toBeInTheDocument()
  })

  it('dopo una cancellazione dal dettaglio mostra «Evento cancellato.»', () => {
    renderProfile(makeMe(), { eventDeleted: true })

    expect(screen.getByRole('status')).toHaveTextContent('Evento cancellato.')
  })

  it("lo stato di un altro tipo non mostra l'avviso della cancellazione", () => {
    renderProfile(makeMe(), { profileUpdated: true })

    expect(screen.queryByText('Evento cancellato.')).not.toBeInTheDocument()
  })
})
