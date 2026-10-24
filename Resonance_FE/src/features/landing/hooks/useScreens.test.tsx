import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useScreens } from './useScreens'

// Scatto fra le schermate: collega rotella, tasti e freccia alle regole di scrollScreens. jsdom non calcola il layout:
// posizioni e altezze delle schermate si simulano con gli attributi data-top e data-height.

let scrollY = 0
let now = 0
let frames: FrameRequestCallback[] = []

function Harness({
  enabled = true,
  onSnap,
  heights = [800, 800, 800, 800],
}: {
  enabled?: boolean
  onSnap?: () => void
  heights?: number[]
}) {
  const { next, top } = useScreens(enabled, onSnap)
  return (
    <div>
      {heights.map((height, index) => (
        <section
          key={index}
          data-screen
          data-top={heights.slice(0, index).reduce((sum, value) => sum + value, 0)}
          data-height={height}
        >
          schermata {index}
        </section>
      ))}
      <button type="button" onClick={next}>
        Vai avanti
      </button>
      <button type="button" onClick={top}>
        Vai in cima
      </button>
    </div>
  )
}

/** Fa girare i fotogrammi dell'animazione, a passi di 100 ms, finché non finisce. */
function finishAnimation() {
  act(() => {
    for (let step = 0; step < 40 && frames.length > 0; step++) {
      const pending = frames
      frames = []
      now += 100
      pending.forEach((callback) => callback(now))
    }
  })
}

function wheel(deltaY: number) {
  const event = new WheelEvent('wheel', { deltaY, cancelable: true, bubbles: true })
  act(() => {
    window.dispatchEvent(event)
  })
  return event
}

function key(name: string, target: EventTarget = document.body) {
  const event = new KeyboardEvent('keydown', { key: name, cancelable: true, bubbles: true })
  act(() => {
    target.dispatchEvent(event)
  })
  return event
}

beforeEach(() => {
  scrollY = 0
  now = 1000
  frames = []
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
  vi.spyOn(window, 'scrollTo').mockImplementation(((_x: number, y: number) => {
    scrollY = y
  }) as typeof window.scrollTo)
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback))
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    return { top: Number(this.dataset.top ?? 0) - scrollY } as DOMRect
  })
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return Number(this.dataset.height ?? 0)
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('useScreens', () => {
  it('un gesto di rotella in giù dalla prima schermata scatta alla seconda e lo dice a chi ascolta', () => {
    const onSnap = vi.fn()
    render(<Harness onSnap={onSnap} />)

    const event = wheel(120)
    finishAnimation()

    expect(event.defaultPrevented).toBe(true)
    expect(scrollY).toBe(800)
    expect(onSnap).toHaveBeenCalledTimes(1)
  })

  it('un gesto in su dalla seconda schermata riporta in cima', () => {
    scrollY = 800
    render(<Harness />)

    const event = wheel(-120)
    finishAnimation()

    expect(event.defaultPrevented).toBe(true)
    expect(scrollY).toBe(0)
  })

  it('se il fondo della schermata non si vede ancora, la pagina scorre da sola', () => {
    const onSnap = vi.fn()
    render(<Harness onSnap={onSnap} heights={[1400, 800]} />)

    const event = wheel(120)

    expect(event.defaultPrevented).toBe(false)
    expect(onSnap).not.toHaveBeenCalled()
  })

  it('durante lo scatto gli altri gesti sono bloccati e non ne partono due', () => {
    const onSnap = vi.fn()
    render(<Harness onSnap={onSnap} />)

    wheel(120)
    const second = wheel(120)

    expect(second.defaultPrevented).toBe(true)
    expect(onSnap).toHaveBeenCalledTimes(1)
  })

  it('i gesti quasi orizzontali o minuscoli non fanno scattare niente', () => {
    render(<Harness />)

    const tiny = wheel(2)

    expect(tiny.defaultPrevented).toBe(false)
    expect(frames).toHaveLength(0)
  })

  it('freccia in giù e PageDown scattano; lo spazio su un pulsante no, perché lo attiva', () => {
    render(<Harness />)
    const button = screen.getByRole('button', { name: 'Vai avanti' })

    expect(key(' ', button).defaultPrevented).toBe(false)
    expect(key('ArrowDown').defaultPrevented).toBe(true)
    finishAnimation()
    expect(scrollY).toBe(800)

    expect(key('PageUp').defaultPrevented).toBe(true)
    finishAnimation()
    expect(scrollY).toBe(0)
  })

  it('i tasti dentro un campo di testo non vengono intercettati', () => {
    render(
      <>
        <Harness />
        <input aria-label="Cerca" />
      </>,
    )

    expect(key('ArrowDown', screen.getByLabelText('Cerca')).defaultPrevented).toBe(false)
  })

  it('la funzione restituita (le frecce) porta alla schermata successiva con lo scatto', async () => {
    const onSnap = vi.fn()
    const user = userEvent.setup()
    render(<Harness onSnap={onSnap} />)

    await user.click(screen.getByRole('button', { name: 'Vai avanti' }))
    finishAnimation()

    expect(scrollY).toBe(800)
    expect(onSnap).toHaveBeenCalledTimes(1)
  })

  it('spento (riduci animazioni o telefono) non intercetta niente, ma le frecce saltano alla successiva', async () => {
    const onSnap = vi.fn()
    const user = userEvent.setup()
    render(<Harness enabled={false} onSnap={onSnap} />)

    expect(wheel(120).defaultPrevented).toBe(false)
    expect(key('ArrowDown').defaultPrevented).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Vai avanti' }))

    expect(scrollY).toBe(800)
    expect(onSnap).not.toHaveBeenCalled()
  })

  it('la funzione «in cima» riporta alla prima schermata con lo scatto, anche da lontano', async () => {
    scrollY = 2600
    const onSnap = vi.fn()
    const user = userEvent.setup()
    render(<Harness onSnap={onSnap} />)

    await user.click(screen.getByRole('button', { name: 'Vai in cima' }))
    finishAnimation()

    expect(scrollY).toBe(0)
    expect(onSnap).toHaveBeenCalledTimes(1)
  })

  it('spento, «in cima» salta subito in cima, senza scatto', async () => {
    scrollY = 2600
    const onSnap = vi.fn()
    const user = userEvent.setup()
    render(<Harness enabled={false} onSnap={onSnap} />)

    await user.click(screen.getByRole('button', { name: 'Vai in cima' }))

    expect(scrollY).toBe(0)
    expect(onSnap).not.toHaveBeenCalled()
  })
})
