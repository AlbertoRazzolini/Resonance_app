import type { ReactNode } from 'react'

/** Icone della chat disegnate a mano in SVG: tratto da 2 px, colore del testo, decorative (il testo accanto dice già tutto). */
function Icon({ size, children }: { size: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

/** Lucchetto delle conversazioni in cui non si può scrivere. */
export function LockIcon({ size = 14 }: { size?: number }) {
  return (
    <Icon size={size}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Icon>
  )
}

/** Freccia a sinistra: torna dalla conversazione all'elenco. */
export function BackIcon({ size = 20 }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M15 5l-7 7 7 7" />
    </Icon>
  )
}

/** Faccina sorridente: apre il selettore di emoji. */
export function SmileIcon({ size = 20 }: { size?: number }) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14a4.5 4.5 0 0 0 8 0" />
      <path d="M9 9.5h.01M15 9.5h.01" />
    </Icon>
  )
}

/** Spunta singola: il messaggio è stato salvato dal server («inviato»). */
export function SentTick({ size = 16 }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M5 13l4 4L19 7" />
    </Icon>
  )
}

/** Doppia spunta: l'altra persona ha letto il messaggio («letto»). */
export function ReadTick({ size = 16 }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M2 13l4 4L16 7" />
      <path d="M10 15l1.5 1.5L22 7" />
    </Icon>
  )
}
