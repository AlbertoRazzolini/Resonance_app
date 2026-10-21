import { Fragment } from 'react'
import { ExternalLink } from './ExternalLink'

/** Un indirizzo `http` o `https` fino al primo spazio; la punteggiatura finale si toglie dopo. */
const URL_PATTERN = /https?:\/\/\S+/gi

/** Caratteri che chiudono una frase o una parentesi: se stanno in fondo all'indirizzo sono testo, non indirizzo. */
const TRAILING_PUNCTUATION = /[.,;:!?)]+$/

type UserTextProps = {
  /** Testo scritto da un utente: bio, descrizioni, post, annunci, messaggi. */
  text: string
}

/** Divide il testo in pezzi di testo semplice e indirizzi; la punteggiatura che segue un indirizzo torna testo. */
function split(text: string): { text: string; link: boolean }[] {
  const parts: { text: string; link: boolean }[] = []
  let last = 0
  for (const match of text.matchAll(URL_PATTERN)) {
    const url = match[0].replace(TRAILING_PUNCTUATION, '')
    if (match.index > last) parts.push({ text: text.slice(last, match.index), link: false })
    parts.push({ text: url, link: true })
    last = match.index + url.length
  }
  if (last < text.length) parts.push({ text: text.slice(last), link: false })
  return parts
}

/**
 * Unico punto in cui un testo degli utenti arriva sullo schermo (decisione 79, progettazione sezione 8.6): il testo è
 * sempre un nodo di React, con l'escape automatico, e mai HTML. Solo gli indirizzi `http`/`https` diventano
 * `ExternalLink`, con la conferma del dominio. Gli a capo li tiene lo stile (`white-space: pre-line`), non i `<br>`.
 */
export function UserText({ text }: UserTextProps) {
  return (
    <span className="rs-user-text">
      {split(text).map((part, index) => (
        <Fragment key={index}>{part.link ? <ExternalLink href={part.text}>{part.text}</ExternalLink> : part.text}</Fragment>
      ))}
    </span>
  )
}
