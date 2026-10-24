/** Pulsante tondo con una freccia in su, nell'angolo in basso a destra dello schermo sopra il footer: riporta alla prima schermata. */
export function BackToTop({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="rs-landing__top"
      aria-label="Torna all'inizio"
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true" focusable="false">
        <path
          d="M5 15l7-7 7 7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
