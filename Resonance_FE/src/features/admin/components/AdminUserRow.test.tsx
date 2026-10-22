import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { makeAdminUser } from '@/test/fixtures/admin'
import { AdminUserRow } from './AdminUserRow'

// Riga dell'elenco utenti: il contenuto di ogni cella sta in un contenitore flex (`rs-admin-row__cell`), così nome ed email,
// stato e dettagli, pulsanti e frasi restano distanziati anche quando da 992 px la cella è una cella di tabella.
function renderRow(children?: React.ReactNode) {
  render(
    <table>
      <tbody>
        <AdminUserRow user={makeAdminUser({ displayName: 'Marco Rossi', email: 'marco@example.com' })}>{children}</AdminUserRow>
      </tbody>
    </table>,
  )
}

describe('AdminUserRow · distanze', () => {
  it('nome ed email stanno in colonna nello stesso contenitore', () => {
    renderRow()

    const holder = screen.getByText('Marco Rossi').parentElement
    expect(holder).toHaveClass('rs-admin-row__cell', 'rs-admin-row__cell--stack')
    expect(holder).toContainElement(screen.getByText('marco@example.com'))
  })

  it('i pulsanti e le frasi della cella finale stanno nello stesso contenitore flex', () => {
    renderRow(
      <>
        <button type="button">Sospendi</button>
        <span>Una frase</span>
      </>,
    )

    const holder = screen.getByRole('button', { name: 'Sospendi' }).parentElement
    expect(holder).toHaveClass('rs-admin-row__cell')
    expect(holder).toContainElement(screen.getByText('Una frase'))
  })

  it('stato e «Non verificato» stanno nello stesso contenitore flex', () => {
    render(
      <table>
        <tbody>
          <AdminUserRow user={makeAdminUser({ emailVerified: false })} />
        </tbody>
      </table>,
    )

    const holder = screen.getByText('Attivo').parentElement
    expect(holder).toHaveClass('rs-admin-row__cell')
    expect(holder).toContainElement(screen.getByText('Non verificato'))
  })
})
