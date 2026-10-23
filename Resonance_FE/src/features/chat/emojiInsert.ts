/** Testo dopo l'inserimento e posizione del cursore. */
export type Inserted = { value: string; caret: number }

/**
 * Inserisce `text` nel punto del cursore o al posto della selezione. Lunghezze in unità UTF-16, come il contatore e
 * `maxLength` della casella: se il testo risultante supera `max` non inserisce niente (`null`). Gli estremi della
 * selezione si riordinano e si riportano dentro il testo.
 */
export function insertAtSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  text: string,
  max: number,
): Inserted | null {
  const start = Math.min(Math.max(Math.min(selectionStart, selectionEnd), 0), value.length)
  const end = Math.min(Math.max(Math.max(selectionStart, selectionEnd), 0), value.length)
  const next = value.slice(0, start) + text + value.slice(end)
  if (next.length > max) return null
  return { value: next, caret: start + text.length }
}
