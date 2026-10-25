import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { makeStore } from '@/app/store'
import { Component as NewConcertPage } from './NewConcertPage'
import { Component as NewIndieEventPage } from './NewIndieEventPage'

// Pagine «Pubblica concerto» e «Pubblica indie event»: occupano tutta la larghezza della card (25 ottobre), come Modifica
// profilo (vedi `EditProfilePage.test.tsx`); Pubblica annuncio resta nella colonna stretta. jsdom non fa il layout: si controllano la
// classe sulle pagine e la regola nel foglio di stile.
const css = readFileSync(path.join(import.meta.dirname, '../../../styles/index.css'), 'utf8')

function renderPage(Page: () => React.JSX.Element) {
  return render(
    <Provider store={makeStore()}>
      <MemoryRouter>
        <Page />
      </MemoryRouter>
    </Provider>,
  )
}

describe('pagine di creazione degli eventi', () => {
  it.each([
    ['Pubblica concerto', NewConcertPage],
    ['Pubblica indie event', NewIndieEventPage],
  ])('«%s» usa tutta la larghezza della card', (_name, Page) => {
    const { container } = renderPage(Page)

    expect(container.firstElementChild).toHaveClass('rs-edit', 'rs-edit--full')
  })

  it('la classe toglie il limite di larghezza della colonna stretta', () => {
    expect(css).toMatch(/\.rs-edit--full\s*\{[^}]*max-width:\s*none/)
  })

  // Pubblica e Annulla hanno l'effetto magnet (scala 1,15 e spostamento): 16 px fra i due pulsanti, perché non si tocchino
  it("i pulsanti del modulo stanno a 16 px l'uno dall'altro", () => {
    expect(css).toMatch(/\.rs-form-actions\s*\{[^}]*gap:\s*var\(--rs-space-4\)/)
  })
})
