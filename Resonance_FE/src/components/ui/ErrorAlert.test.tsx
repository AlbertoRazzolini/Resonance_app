import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { errorResponse } from '@/test/handlers/auth'
import { ErrorAlert } from './ErrorAlert'

// ErrorAlert mostra il messaggio italiano dell'errore in un avviso annunciato dagli screen reader; senza errore non disegna nulla.
describe('ErrorAlert', () => {
  it("mostra il messaggio dell'errore in un avviso", () => {
    render(<ErrorAlert error={{ status: 403, data: errorResponse(403, 'EMAIL_NOT_VERIFIED') }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Email non ancora verificata')
  })

  it('DISPLAY_NAME_TAKEN non si mostra qui: è un errore del campo, lo scrive il form sotto il nome', () => {
    const { container } = render(
      <ErrorAlert error={{ status: 409, data: errorResponse(409, 'DISPLAY_NAME_TAKEN') }} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('senza errore non disegna nulla', () => {
    const { container } = render(<ErrorAlert error={undefined} />)
    expect(container).toBeEmptyDOMElement()
  })
})
