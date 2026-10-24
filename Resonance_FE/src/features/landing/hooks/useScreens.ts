import { useEffect, useMemo, useRef } from 'react'
import {
  TOLERANCE,
  durationFor,
  easeInOutCubic,
  nextScreenTop,
  planScroll,
  type Direction,
  type ScreenLayout,
} from '../scrollScreens'

/** Pausa (ms) fra due eventi della rotella oltre la quale un gesto è finito (fine dell'inerzia del trackpad). */
const GESTURE_GAP_MS = 140
/** Trascinamento minimo (px) perché un tocco su tablet valga come gesto. */
const SWIPE_MIN_PX = 12

/** Ultima misura: leggere le posizioni a ogni evento della rotella costringerebbe il browser a ricalcolare il layout. */
let cached: ScreenLayout | null = null

/** Inizio e fine delle schermate (elementi con `data-screen`), misurati solo se il layout è cambiato. */
function measure(): ScreenLayout {
  if (cached) return cached
  const screens = Array.from(document.querySelectorAll<HTMLElement>('[data-screen]'))
  const tops = screens.map((el) => Math.round(el.getBoundingClientRect().top + window.scrollY))
  cached = { tops, bottoms: screens.map((el, i) => tops[i] + el.offsetHeight) }
  return cached
}

const forgetLayout = () => {
  cached = null
}

/**
 * Fa sembrare la landing fatta di schermate alte quanto lo schermo (elementi `data-screen`): un gesto in giù porta
 * alla successiva con uno scatto accelerato, uno in su alla precedente; l'ultima schermata e il footer scorrono liberi.
 * Intercetta rotella, tasti e trascinamento sul tablet. Spento (`enabled` false: telefono o «riduci animazioni») non
 * tocca lo scroll e le due funzioni restituite saltano subito. `onSnap` parte a ogni scatto. Restituisce `next` (alla
 * schermata successiva, per le frecce) e `top` (alla prima schermata, per «Torna all'inizio»).
 */
export function useScreens(
  enabled: boolean,
  onSnap?: () => void,
): { next: () => void; top: () => void } {
  const goNext = useRef<() => void>(() => {})
  const goTop = useRef<() => void>(() => {})
  const snap = useRef(onSnap)

  useEffect(() => {
    snap.current = onSnap
  }, [onSnap])

  useEffect(() => {
    forgetLayout()
    // jsdom e i browser molto vecchi non hanno ResizeObserver: resta il resize della finestra
    const observer =
      typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(forgetLayout)
    observer?.observe(document.body)
    window.addEventListener('resize', forgetLayout)
    const root = document.documentElement
    let frame = 0
    let animating = false
    let blocked = false
    let lastWheel = 0

    const stopListening = () => {
      observer?.disconnect()
      window.removeEventListener('resize', forgetLayout)
    }

    if (!enabled) {
      goNext.current = () => {
        const target = nextScreenTop(measure(), window.scrollY)
        if (target !== null) window.scrollTo(0, target)
      }
      goTop.current = () => window.scrollTo(0, 0)
      return stopListening
    }

    const animateTo = (target: number) => {
      const from = window.scrollY
      const distance = Math.abs(target - from)
      if (distance < 2) return
      const duration = durationFor(distance)
      animating = true
      snap.current?.()
      // Con `scroll-behavior: smooth` sull'elemento radice ogni scrollTo partirebbe un'animazione per conto suo
      root.style.scrollBehavior = 'auto'
      const start = performance.now()
      const step = (now: number) => {
        const progress = Math.min(1, (now - start) / duration)
        window.scrollTo(0, from + (target - from) * easeInOutCubic(progress))
        if (progress < 1) {
          frame = requestAnimationFrame(step)
        } else {
          animating = false
          root.style.scrollBehavior = ''
        }
      }
      frame = requestAnimationFrame(step)
    }

    const plan = (direction: Direction) =>
      planScroll(measure(), window.scrollY, window.innerHeight, direction)

    goNext.current = () => {
      const target = nextScreenTop(measure(), window.scrollY)
      if (!animating && target !== null) animateTo(target)
    }

    goTop.current = () => {
      if (!animating) animateTo(0)
    }

    /** Vero se si è all'inizio di una schermata: lì l'inerzia residua di un gesto va fermata. */
    const atScreenStart = () =>
      measure().tops.some((top) => Math.abs(top - window.scrollY) <= TOLERANCE)

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return
      const now = performance.now()
      if (now - lastWheel > GESTURE_GAP_MS) blocked = false
      lastWheel = now
      if (animating) {
        event.preventDefault()
        return
      }
      if (blocked) {
        if (atScreenStart()) event.preventDefault()
        return
      }
      if (Math.abs(event.deltaY) < 4 || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
      const target = plan(event.deltaY > 0 ? 1 : -1)
      if (target === null) return
      event.preventDefault()
      blocked = true
      animateTo(target)
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      const space = event.key === ' '
      // Lo spazio su un link o un pulsante lo attiva: non va intercettato
      if (space && target?.closest('a, button')) return
      const down =
        event.key === 'ArrowDown' || event.key === 'PageDown' || (space && !event.shiftKey)
      const up = event.key === 'ArrowUp' || event.key === 'PageUp' || (space && event.shiftKey)
      if (!down && !up) return
      if (animating) {
        event.preventDefault()
        return
      }
      const destination = plan(down ? 1 : -1)
      if (destination === null) return
      event.preventDefault()
      animateTo(destination)
    }

    // Tablet: un trascinamento dà un solo scatto per gesto
    let touchStartY = 0
    let fired = false
    const onTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0].clientY
      fired = false
    }
    const onTouchMove = (event: TouchEvent) => {
      if (animating || fired) {
        if (event.cancelable) event.preventDefault()
        return
      }
      const dy = touchStartY - event.touches[0].clientY
      if (Math.abs(dy) < SWIPE_MIN_PX) return
      const destination = plan(dy > 0 ? 1 : -1)
      if (destination === null) return
      if (event.cancelable) event.preventDefault()
      fired = true
      animateTo(destination)
    }

    // Non passivi: servono a fermare lo scroll del browser quando parte lo scatto
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      stopListening()
      cancelAnimationFrame(frame)
      root.style.scrollBehavior = ''
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
    }
  }, [enabled])

  return useMemo(() => ({ next: () => goNext.current(), top: () => goTop.current() }), [])
}
