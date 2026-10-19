/** Logo a due colori (RESO bianco, NANCE giallo); un solo nome accessibile, "Resonance". */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`rs-logo ${className}`.trim()} role="img" aria-label="Resonance">
      <span aria-hidden="true">RESO</span>
      <span aria-hidden="true" className="rs-logo__accent">
        NANCE
      </span>
    </span>
  )
}
