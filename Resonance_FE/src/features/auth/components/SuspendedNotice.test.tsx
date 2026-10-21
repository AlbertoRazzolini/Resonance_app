import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { APPEAL_CONTACT } from '@/config'
import { SuspendedNotice } from './SuspendedNotice'

// Avviso di account sospeso (progettazione, sezione 4.7): motivo, scadenza in ora locale o "a tempo indeterminato" e contatto per i ricorsi.
describe('SuspendedNotice', () => {
  it('mostra titolo, motivo e data di fine della sospensione', () => {
    render(
      <SuspendedNotice
        details={{
          suspensionReason: 'Violazione delle linee guida',
          suspendedUntil: '2026-10-30T12:00:00Z',
        }}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Account sospeso' })).toBeInTheDocument()
    expect(screen.getByText('Restrizione attiva')).toBeInTheDocument()
    expect(screen.getByText(/Violazione delle linee guida/)).toBeInTheDocument()
    expect(screen.getByText(/Sospeso fino al/)).toHaveTextContent('Sospeso fino al 30/10/2026')
  })

  it('senza scadenza dice "A tempo indeterminato"', () => {
    render(<SuspendedNotice details={{ suspensionReason: 'Spam', suspendedUntil: null }} />)

    expect(screen.getByText('A tempo indeterminato')).toBeInTheDocument()
    expect(screen.queryByText(/Sospeso fino al/)).not.toBeInTheDocument()
  })

  it('mostra il contatto per i ricorsi come collegamento email', () => {
    render(<SuspendedNotice details={{ suspensionReason: 'Spam', suspendedUntil: null }} />)

    expect(screen.getByRole('link', { name: APPEAL_CONTACT })).toHaveAttribute(
      'href',
      `mailto:${APPEAL_CONTACT}`,
    )
  })

  it('con il motivo vuoto (dettagli mancanti) non scrive "Motivo:"', () => {
    render(<SuspendedNotice details={{ suspensionReason: '', suspendedUntil: null }} />)

    expect(screen.queryByText(/Motivo/)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Account sospeso' })).toBeInTheDocument()
  })

  it('mostra il motivo come testo, mai come HTML', () => {
    render(
      <SuspendedNotice
        details={{ suspensionReason: '<img src=x onerror=alert(1)>', suspendedUntil: null }}
      />,
    )

    expect(screen.getByText(/<img src=x onerror=alert\(1\)>/)).toBeInTheDocument()
    expect(document.querySelector('img')).toBeNull()
  })
})
