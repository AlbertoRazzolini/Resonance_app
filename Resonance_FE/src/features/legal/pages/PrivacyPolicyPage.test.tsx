import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { PRIVACY_CONTACT } from '@/config'
import { Component as PrivacyPolicyPage } from './PrivacyPolicyPage'

// Informativa privacy: le sezioni promesse dalla bozza approvata il 20 ottobre, il contatto da config.ts, e niente
// affermazioni su vendite o pagamenti (l'app non li ha).
describe('PrivacyPolicyPage', () => {
  function renderPage() {
    render(
      <MemoryRouter>
        <PrivacyPolicyPage />
      </MemoryRouter>,
    )
  }

  it('ha il titolo e le sezioni della bozza approvata', () => {
    renderPage()

    expect(
      screen.getByRole('heading', { level: 1, name: 'Informativa sulla privacy' }),
    ).toBeInTheDocument()
    for (const section of [
      'Chi siamo',
      'Quali dati raccogliamo',
      'A cosa servono',
      'Servizi esterni',
      'Link a siti esterni',
      'Chi vede cosa',
      'Conservazione e moderazione',
      'I tuoi diritti',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: section })).toBeInTheDocument()
    }
  })

  it('nomina i servizi esterni che ricevono dati', () => {
    renderPage()

    for (const service of ['Brevo', 'Nominatim', 'OpenFreeMap', 'Render']) {
      expect(screen.getByText(service, { exact: false })).toBeInTheDocument()
    }
  })

  it('dice che Resonance non vende biglietti né gestisce pagamenti', () => {
    renderPage()

    expect(screen.getByText(/non vende biglietti e non gestisce pagamenti/)).toBeInTheDocument()
  })

  it('il contatto per i diritti è un collegamento email preso da config.ts', () => {
    renderPage()

    expect(screen.getByRole('link', { name: PRIVACY_CONTACT })).toHaveAttribute(
      'href',
      `mailto:${PRIVACY_CONTACT}`,
    )
  })

  it('avvisa che il testo è dimostrativo e non è stato scritto da un avvocato', () => {
    renderPage()

    expect(screen.getByText(/non è stato scritto da un avvocato/)).toBeInTheDocument()
  })

  it('non parla di cookie: ha una pagina sua', () => {
    renderPage()

    expect(screen.queryByRole('heading', { name: /cookie/i })).not.toBeInTheDocument()
  })
})
