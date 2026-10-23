import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Component as CookiePolicyPage } from './CookiePolicyPage'

// Informativa cookie: dice quale è l'unico cookie, per quanto vive e che non ce ne sono di tracciamento.
describe('CookiePolicyPage', () => {
  it('ha il titolo e le sezioni della bozza approvata', () => {
    render(<CookiePolicyPage />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Informativa sui cookie' }),
    ).toBeInTheDocument()
    for (const section of ['Un solo cookie, tecnico', 'Cosa non usiamo', 'Come toglierlo']) {
      expect(screen.getByRole('heading', { level: 2, name: section })).toBeInTheDocument()
    }
  })

  it('nomina il cookie e la sua durata', () => {
    render(<CookiePolicyPage />)

    expect(screen.getByText('resonance_refresh')).toBeInTheDocument()
    expect(screen.getByText(/10 giorni/)).toBeInTheDocument()
  })

  it('avvisa che il testo è dimostrativo e non è stato scritto da un avvocato', () => {
    render(<CookiePolicyPage />)

    expect(screen.getByText(/non è stato scritto da un avvocato/)).toBeInTheDocument()
  })

  it('dice che non ci sono cookie di pubblicità, statistiche o tracciamento', () => {
    render(<CookiePolicyPage />)

    expect(
      screen.getByText(/Nessun cookie di pubblicità, di statistiche o di tracciamento/),
    ).toBeInTheDocument()
  })
})
