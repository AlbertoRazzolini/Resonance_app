import { useEffect, useState } from 'react'
import { parseHttpUrl } from '@/lib/urls'

/** Attesa dopo l'ultimo tasto prima di provare a caricare l'immagine: non si contatta un sito a ogni lettera. */
const PROBE_DELAY_MS = 600

/**
 * Avviso del modulo «Nuovo post» (decisione 89): se l'indirizzo è `http`/`https` ma il browser non riesce a caricarlo
 * come immagine (per esempio una pagina di ricerca invece del file), lo dice sotto il campo. Non blocca la
 * pubblicazione. La prova non manda il `Referer`; gli errori di formato li dice il modulo, non questo avviso.
 */
export function ImageLoadWarning({ url }: { url: string }) {
  // Si ricorda l'indirizzo che ha fallito, non un booleano: con un indirizzo nuovo l'avviso sparisce da solo
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const valid = parseHttpUrl(url) !== null

  useEffect(() => {
    if (!valid) return
    let active = true
    const timer = setTimeout(() => {
      const image = new Image()
      image.referrerPolicy = 'no-referrer'
      image.onerror = () => {
        if (active) setFailedUrl(url)
      }
      image.src = url
    }, PROBE_DELAY_MS)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [url, valid])

  if (!valid || failedUrl !== url) return null
  return (
    <p className="rs-field-hint text-warning" role="status">
      Non riesco a caricare l'immagine: controlla l'indirizzo.
    </p>
  )
}
