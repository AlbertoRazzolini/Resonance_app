import { useEffect, useRef } from 'react'
import dataSource from 'emoji-picker-element-data/it/cldr/data.json?url'

type EmojiPickerProps = {
  /** Chiamata con l'emoji scelta (carattere Unicode). */
  onPick: (unicode: string) => void
}

/**
 * Selettore di emoji (web component `emoji-picker-element`), caricato solo all'apertura così non pesa sul bundle
 * iniziale. I dati e i testi sono in italiano e arrivano da un file della nostra origine, mai da un CDN (decisione 76).
 * Tema scuro, colori nel CSS (`.rs-emoji-picker`).
 */
export function EmojiPicker({ onPick }: EmojiPickerProps) {
  const host = useRef<HTMLDivElement>(null)
  // Sempre l'ultima funzione, senza rifare il selettore a ogni render
  const pick = useRef(onPick)
  useEffect(() => {
    pick.current = onPick
  }, [onPick])

  useEffect(() => {
    const container = host.current
    if (!container) return
    let cancelled = false
    let picker: HTMLElement | null = null
    const onClick = (event: Event) => {
      const unicode = (event as CustomEvent<{ unicode?: string }>).detail.unicode
      if (unicode) pick.current(unicode)
    }

    void Promise.all([import('emoji-picker-element'), import('emoji-picker-element/i18n/it')]).then(([, it]) => {
      if (cancelled) return
      const element = document.createElement('emoji-picker')
      element.setAttribute('data-source', dataSource)
      element.setAttribute('locale', 'it')
      element.i18n = it.default
      element.classList.add('dark')
      element.addEventListener('emoji-click', onClick)
      container.appendChild(element)
      picker = element
      // Con la tastiera si parte dalla ricerca
      element.shadowRoot?.querySelector<HTMLInputElement>('input.search')?.focus()
    })

    return () => {
      cancelled = true
      picker?.removeEventListener('emoji-click', onClick)
      picker?.remove()
    }
  }, [])

  return <div ref={host} className="rs-emoji-picker" />
}
