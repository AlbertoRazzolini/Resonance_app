import {
  LOGO_LETTERS,
  LOGO_MIC,
  LOGO_RINGS,
  LOGO_RING_WIDTH,
  LOGO_STAND_U,
  LOGO_STAND_WIDTH,
  LOGO_VIEW_BOX,
} from './logoShapes'

/** Marchio SVG: RES, microfono con tre anelli al posto della O, NANCE (decisione 111); un solo nome accessibile, "Resonance". */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`rs-logo ${className}`.trim()}
      viewBox={LOGO_VIEW_BOX}
      role="img"
      aria-label="Resonance"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g className="rs-logo__letters">
        {LOGO_LETTERS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g className="rs-logo__mic" strokeWidth={LOGO_RING_WIDTH}>
        {LOGO_RINGS.map((d) => (
          <path key={d} className="rs-logo__ring" d={d} />
        ))}
        <path className="rs-logo__stand" d={LOGO_STAND_U} strokeWidth={LOGO_STAND_WIDTH} />
        <path className="rs-logo__body" d={LOGO_MIC} />
      </g>
    </svg>
  )
}
