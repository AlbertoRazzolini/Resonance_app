import { useState } from 'react'

const graphemes = new Intl.Segmenter('it', { granularity: 'grapheme' })

/** Prima lettera del nome in maiuscolo; con un'emoji prende l'emoji intera, non un carattere spezzato. */
function initialOf(displayName: string): string {
  const first = graphemes.segment(displayName.trim())[Symbol.iterator]().next()
  return first.done ? '?' : first.value.segment.toUpperCase()
}

type AvatarProps = {
  displayName: string
  avatarUrl: string | null
  /** `sm` per la barra (2,25 rem), `lg` per il profilo (6 rem). */
  size?: 'sm' | 'lg'
}

/**
 * Cerchio del profilo: la foto se c'è e si carica, altrimenti l'iniziale del nome. La foto è decorativa (alt vuoto, il
 * nome sta sempre accanto) e si carica senza `Referer`, così il sito che la ospita non sa da dove viene la visita.
 */
export function Avatar({ displayName, avatarUrl, size = 'sm' }: AvatarProps) {
  // Si ricorda l'indirizzo che ha fallito, non un booleano: un indirizzo nuovo riprova da solo
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const showImage = avatarUrl !== null && avatarUrl !== failedUrl

  return (
    <span className={`rs-avatar rs-avatar--${size}`}>
      {showImage ? (
        <img
          src={avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(avatarUrl)}
        />
      ) : (
        <span aria-hidden="true">{initialOf(displayName)}</span>
      )}
    </span>
  )
}
