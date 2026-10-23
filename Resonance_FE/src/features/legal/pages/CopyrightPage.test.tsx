import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Component as CopyrightPage } from './CopyrightPage'

// Pagina Copyright: titolare e sezioni della bozza approvata il 23 ottobre; avviso che il testo è dimostrativo.
describe('CopyrightPage', () => {
  it('ha il titolo e le sezioni della bozza approvata', () => {
    render(<CopyrightPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Copyright' })).toBeInTheDocument()
    for (const section of ['Chi ha i diritti', 'Quello che pubblichi tu', 'Immagini', 'Mappe']) {
      expect(screen.getByRole('heading', { level: 2, name: section })).toBeInTheDocument()
    }
  })

  it('indica il titolare con il suo nome e l\'anno', () => {
    render(<CopyrightPage />)

    expect(screen.getByText(/© 2026 Alberto Razzolini/)).toBeInTheDocument()
  })

  it('avvisa che il testo è dimostrativo e non è stato scritto da un avvocato', () => {
    render(<CopyrightPage />)

    expect(screen.getByText(/non è stato scritto da un avvocato/)).toBeInTheDocument()
  })
})
