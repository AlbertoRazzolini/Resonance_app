import { useId } from 'react'

/**
 * Tre frecce verso il basso che si accendono in sequenza dall'alto, con un giallo che scurisce scendendo (a dire «vai
 * giù»). È un pulsante «Scorri verso il basso»: porta alla schermata successiva. Con «riduci animazioni» restano ferme.
 */
export function ScrollArrows({ onClick }: { onClick: () => void }) {
  // Un gradiente per istanza: gli id con i due punti di useId non sono validi in un url(#...)
  const gradient = `rs-cue-${useId().replace(/:/g, '')}`

  return (
    <button
      type="button"
      className="rs-landing__cue"
      aria-label="Scorri verso il basso"
      onClick={onClick}
    >
      <svg className="rs-landing__arrows" viewBox="0 0 60 72" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={gradient} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="72">
            <stop offset="0" stopColor="#fff2a8" />
            <stop offset="0.5" stopColor="#ffd60a" />
            <stop offset="1" stopColor="#a67c00" />
          </linearGradient>
        </defs>
        <g stroke={`url(#${gradient})`}>
          <path className="rs-landing__arrow-1" d="M2 2 L30 32 L58 2" />
          <path className="rs-landing__arrow-2" d="M2 22 L30 52 L58 22" />
          <path className="rs-landing__arrow-3" d="M2 42 L30 72 L58 42" />
        </g>
      </svg>
    </button>
  )
}
