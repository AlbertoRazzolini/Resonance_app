import { useEffect, useRef } from 'react'

/**
 * Dopo un invio con errori porta il cursore, e lo schermo, sul primo campo sbagliato del modulo (quello con
 * `aria-invalid="true"` più in alto nella pagina). Serve soprattutto sul telefono: «Pubblica» sta in fondo e il campo
 * sbagliato in cima, quindi senza questo l'errore comparirebbe fuori dallo schermo e sembrerebbe che non succeda niente.
 * `attempts` cresce a ogni invio fallito per errori dei campi; l'effetto parte dopo il disegno, quando gli errori ci sono.
 * Si mette il `ref` sul `<form>`.
 */
export function useFocusFirstInvalid(attempts: number) {
  const ref = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (attempts === 0) return
    const field = ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
    if (!field) return
    // `preventScroll` e poi lo scorrimento al centro: il solo focus lascerebbe il campo sotto la barra in alto
    field.focus({ preventScroll: true })
    field.scrollIntoView?.({ block: 'center' })
  }, [attempts])

  return ref
}
