import { useEffect, useState } from 'react'

/**
 * Il valore, ma aggiornato solo dopo `delayMs` millisecondi senza cambiamenti: serve alle ricerche «mentre si scrive»,
 * dove la richiesta deve partire quando l'utente si ferma e non a ogni tasto.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}
