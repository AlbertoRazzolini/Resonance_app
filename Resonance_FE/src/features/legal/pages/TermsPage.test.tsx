import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { APPEAL_CONTACT, PRIVACY_CONTACT } from '@/config'
import { Component as TermsPage } from './TermsPage'

// Termini di servizio: sezioni della bozza approvata il 23 ottobre, contatti da config.ts e avviso che il testo è
// dimostrativo.
describe('TermsPage', () => {
  it('ha il titolo e le sezioni della bozza approvata', () => {
    render(<TermsPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Termini di servizio' })).toBeInTheDocument()
    for (const section of [
      "Cos'è questo servizio",
      'Il tuo account',
      'Cosa pubblichi',
      'Messaggi',
      'Moderazione',
      'Ricorsi',
      'Link esterni',
      'Cancellazione',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: section })).toBeInTheDocument()
    }
  })

  it('i contatti per ricorsi e cancellazione sono collegamenti email presi da config.ts', () => {
    render(<TermsPage />)

    expect(screen.getByRole('link', { name: APPEAL_CONTACT })).toHaveAttribute('href', `mailto:${APPEAL_CONTACT}`)
    expect(screen.getByRole('link', { name: PRIVACY_CONTACT })).toHaveAttribute('href', `mailto:${PRIVACY_CONTACT}`)
  })

  it('avvisa che il testo è dimostrativo e non è stato scritto da un avvocato', () => {
    render(<TermsPage />)

    expect(screen.getByText(/non è stato scritto da un avvocato/)).toBeInTheDocument()
  })
})
