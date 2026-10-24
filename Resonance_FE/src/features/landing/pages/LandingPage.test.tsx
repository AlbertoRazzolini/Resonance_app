import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ROUTES } from '@/app/routes'
import { makeStore } from '@/app/store'
import { sessionEnded } from '@/features/auth/authSlice'
import { Component as LandingPage } from './LandingPage'

// Gli anelli veri (WebGL2) in jsdom non esistono e hanno un test a parte: qui la pagina li monta come uno spazio vuoto.
vi.mock('../components/LandingRings', () => ({ LandingRings: () => null }))

// Il magnete vero si prova a parte: qui basta sapere con quale aspetto lo usa la landing.
vi.mock('@/components/motion/DesktopMagnet', () => ({
  default: ({ children, look }: { children: ReactNode; look?: { tilt: number } }) => (
    <div data-magnet-tilt={look?.tilt}>{children}</div>
  ),
}))

// Landing page (FE-12): quattro schermate (presentazione, ruoli, funzioni, tre passi con invito finale) e un footer
// statico. Spiega cos'è Resonance e porta ad accedere, registrarsi o guardare gli eventi vicini. Solo ciò che l'app fa.
function renderPage() {
  const store = makeStore()
  store.dispatch(sessionEnded())
  render(
    <Provider store={store}>
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    </Provider>,
  )
}

const hrefsOf = (name: string) =>
  screen.getAllByRole('link', { name }).map((link) => link.getAttribute('href'))

afterEach(() => {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
})

describe('LandingPage', () => {
  it('ha un solo titolo principale, su due righe, e presenta Resonance', () => {
    renderPage()

    const title = screen.getByRole('heading', { level: 1, name: /trova la tua scena dal vivo/i })
    expect(title.querySelectorAll(':scope > span')).toHaveLength(2)
    expect(screen.getByLabelText('Resonance')).toBeInTheDocument()
  })

  it('nel titolo «scena» è un blocco a parte in giallo e i titoli di sezione sono animati', () => {
    renderPage()

    const title = screen.getByRole('heading', { level: 1 })
    const accent = title.querySelector('.rs-landing__accent')
    expect(accent).toHaveTextContent('scena')
    for (const name of [/fan, musicista o host/i, /quattro funzioni, una app/i, /tre passi/i]) {
      const heading = screen.getByRole('heading', { level: 2, name })
      expect(heading.querySelector('[aria-hidden="true"]')).not.toBeNull()
    }
  })

  it('«palco» è in giallo anche nell invito finale', () => {
    renderPage()

    const closing = screen.getByRole('heading', { level: 2, name: /sali sul palco/i })
    expect(closing.querySelector('.rs-landing__accent')).toHaveTextContent('palco')
  })

  it('è fatta di quattro schermate', () => {
    renderPage()

    expect(document.querySelectorAll('[data-screen]')).toHaveLength(4)
  })

  it("l'header è trasparente in cima e prende lo sfondo pieno appena si scorre", () => {
    renderPage()
    const bar = screen.getByRole('banner')
    expect(bar).toHaveAttribute('data-solid', 'false')

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 40 })
    fireEvent.scroll(window)
    expect(bar).toHaveAttribute('data-solid', 'true')

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
    fireEvent.scroll(window)
    expect(bar).toHaveAttribute('data-solid', 'false')
  })

  it('presenta i tre ruoli: fan, musicista e host', () => {
    renderPage()

    expect(
      screen.getByRole('heading', { level: 2, name: /fan, musicista o host/i }),
    ).toBeInTheDocument()
    for (const role of ['Fan', 'Musicista', 'Host']) {
      expect(screen.getByRole('heading', { level: 3, name: role })).toBeInTheDocument()
    }
    for (const title of ['Vai ai concerti', 'Fatti trovare', 'Organizza le serate']) {
      expect(screen.getByText(title)).toBeInTheDocument()
    }
  })

  it('presenta le quattro funzioni: eventi vicini, collab, feed e chat', () => {
    renderPage()

    for (const title of ['Eventi vicini', 'Collab', 'Feed', 'Chat']) {
      expect(screen.getByRole('heading', { level: 3, name: title })).toBeInTheDocument()
    }
  })

  it('spiega le regole vere della chat: amici, candidature e contatti, niente sconosciuti', () => {
    renderPage()

    expect(screen.getByText(/niente messaggi da sconosciuti/i)).toBeInTheDocument()
    expect(screen.getByText(/si apre la chat con chi li ha pubblicati/i)).toBeInTheDocument()
  })

  it('presenta i tre passi per cominciare', () => {
    renderPage()

    expect(screen.getByRole('heading', { level: 2, name: /tre passi/i })).toBeInTheDocument()
    for (const step of ["Crea l'account", 'Scegli i ruoli', 'Entra in gioco']) {
      expect(screen.getByRole('heading', { level: 3, name: step })).toBeInTheDocument()
    }
  })

  it('mostra la mappa di esempio con la legenda dei due tipi di evento', () => {
    renderPage()

    expect(
      screen.getByRole('img', { name: /un concerto ufficiale e due eventi indie/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Ufficiale')).toBeInTheDocument()
    expect(screen.getByText('Indie')).toBeInTheDocument()
  })

  it("chiude con l'invito «Sali sul palco»", () => {
    renderPage()

    expect(screen.getByRole('heading', { level: 2, name: /sali sul palco/i })).toBeInTheDocument()
  })

  it('ha le frecce «Scorri verso il basso» sulle prime tre schermate, non sull ultima', () => {
    renderPage()

    const arrows = screen.getAllByRole('button', { name: 'Scorri verso il basso' })
    expect(arrows).toHaveLength(3)
    const lastScreen = document.querySelectorAll('[data-screen]')[3]
    arrows.forEach((arrow) => expect(lastScreen.contains(arrow)).toBe(false))
  })

  it('ha il pulsante «Torna all inizio» nell angolo in basso, subito sopra il footer', () => {
    renderPage()

    const button = screen.getByRole('button', { name: "Torna all'inizio" })
    const footer = document.querySelector('.rs-landing__footer') as HTMLElement
    expect(button.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(button.closest('[data-screen]')).toBeNull()
  })

  it('i pulsanti con il magnete usano l aspetto leggero della landing (inclinazione 5°)', () => {
    renderPage()

    const magnets = document.querySelectorAll('[data-magnet-tilt]')
    expect(magnets).toHaveLength(2)
    magnets.forEach((magnet) => expect(magnet).toHaveAttribute('data-magnet-tilt', '5'))
  })

  it("Accedi porta all'accesso, ovunque compaia", () => {
    renderPage()

    const hrefs = hrefsOf('Accedi')
    expect(hrefs.length).toBeGreaterThanOrEqual(2)
    expect(new Set(hrefs)).toEqual(new Set([ROUTES.login]))
  })

  it('Registrati e «Crea il tuo account» portano alla registrazione', () => {
    renderPage()

    expect(new Set(hrefsOf('Registrati'))).toEqual(new Set([ROUTES.register]))
    expect(new Set(hrefsOf('Crea il tuo account'))).toEqual(new Set([ROUTES.register]))
  })

  it("il collegamento agli eventi vicini porta a /eventi, aperti anche a chi non ha l'account", () => {
    renderPage()

    expect(new Set(hrefsOf('Guarda gli eventi vicini'))).toEqual(new Set([ROUTES.events]))
  })

  it('ha un footer statico, sempre raggiungibile, con le quattro informative', () => {
    renderPage()

    const nav = screen.getByRole('navigation', { name: 'Informazioni legali' })
    const footer = nav.closest('footer')
    expect(footer).toHaveClass('rs-landing__footer')
    expect(footer).not.toHaveAttribute('inert')
    expect(screen.getByRole('link', { name: 'Informativa privacy' })).toHaveAttribute(
      'href',
      ROUTES.privacy,
    )
    for (const name of ['Informativa cookie', 'Copyright', 'Termini di servizio']) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument()
    }
  })

  it("non promette ciò che l'app non ha: niente negozi di app, numeri o chat criptata", () => {
    renderPage()

    expect(screen.queryByText(/app store|google play|crittograf|scarica/i)).not.toBeInTheDocument()
  })
})
