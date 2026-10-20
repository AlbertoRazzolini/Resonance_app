import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import type { Role } from '@/types/users'
import { AREA_TABS, type AreaTab } from '../areaTabs'
import { AreaTabs } from './AreaTabs'

// Schede dei contenuti dell'utente: mostrate secondo i ruoli, la prima è aperta, ogni card successiva aggiunge la sua
// al registro e il contenuto si monta solo quando la scheda è aperta.
function renderTabs(roles: Role[], tabs?: AreaTab[]) {
  const store = makeStore()
  store.dispatch(sessionStarted(makeLoginResponse({ user: makeMe({ roles }) })))
  render(
    <Provider store={store}>
      <AreaTabs tabs={tabs} />
    </Provider>,
  )
  return userEvent.setup()
}

const titles = () => screen.getAllByRole('tab').map((tab) => tab.textContent)

describe('AreaTabs', () => {
  it('a un FAN mostra solo «Post»', () => {
    renderTabs(['FAN'])

    expect(titles()).toEqual(['Post'])
  })

  it('a un HOST mostra «Concerti» e «Post»', () => {
    renderTabs(['FAN', 'HOST'])

    expect(titles()).toEqual(['Concerti', 'Post'])
  })

  it('a un MUSICIAN mostra «Indie event», «Annunci» e «Post»', () => {
    renderTabs(['FAN', 'MUSICIAN'])

    expect(titles()).toEqual(['Indie event', 'Annunci', 'Post'])
  })

  it('con tutti i ruoli mostra le quattro schede, nell\'ordine del registro', () => {
    renderTabs(['FAN', 'MUSICIAN', 'HOST'])

    expect(titles()).toEqual(['Concerti', 'Indie event', 'Annunci', 'Post'])
  })

  it('la prima scheda è aperta e mostra «Questa sezione arriva presto.»', () => {
    renderTabs(['FAN', 'HOST'])

    expect(screen.getByRole('tab', { name: 'Concerti' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Post' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Questa sezione arriva presto.')
  })

  it('un clic apre un\'altra scheda', async () => {
    const user = renderTabs(['FAN', 'HOST'])

    await user.click(screen.getByRole('tab', { name: 'Post' }))

    expect(screen.getByRole('tab', { name: 'Post' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Concerti' })).toHaveAttribute('aria-selected', 'false')
  })

  it('il registro è quello che le card successive completano: una scheda registrata compare con il suo contenuto', () => {
    renderTabs(
      ['FAN'],
      [{ key: 'prova', title: 'Prova', element: <p>Contenuto della prova</p> }],
    )

    expect(screen.getByRole('tab', { name: 'Prova' })).toBeInTheDocument()
    expect(screen.getByText('Contenuto della prova')).toBeInTheDocument()
  })

  it('monta il contenuto solo della scheda aperta', async () => {
    const user = renderTabs(
      ['FAN'],
      [
        { key: 'a', title: 'A', element: <p>Contenuto A</p> },
        { key: 'b', title: 'B', element: <p>Contenuto B</p> },
      ],
    )
    expect(screen.queryByText('Contenuto B')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'B' }))

    expect(screen.getByText('Contenuto B')).toBeInTheDocument()
    expect(screen.queryByText('Contenuto A')).not.toBeInTheDocument()
  })

  it('una scheda con più ruoli si vede se ne basta uno', () => {
    renderTabs(['FAN', 'HOST'], [{ key: 'x', title: 'X', roles: ['MUSICIAN', 'HOST'], element: <p>x</p> }])

    expect(titles()).toEqual(['X'])
  })

  it('il registro non ha chiavi doppie', () => {
    const keys = AREA_TABS.map((tab) => tab.key)

    expect(new Set(keys).size).toBe(keys.length)
  })
})
