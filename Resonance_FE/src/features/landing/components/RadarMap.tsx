import { ICON_PATHS } from '@/components/map/markerIcons'
import type { EventKind } from '@/components/map/markers'

/** Segnaposto di esempio: posizione nel disegno (viewBox 600x440) e tipo, con le stesse icone della mappa vera. */
const PINS: { kind: EventKind; x: number; y: number }[] = [
  { kind: 'official', x: 375, y: 160 },
  { kind: 'indie', x: 225, y: 285 },
  { kind: 'indie', x: 330, y: 320 },
]

/**
 * Mappa della landing: un disegno fisso, non una mappa vera. Mostra il raggio di ricerca, la posizione di chi guarda e
 * un concerto ufficiale con due indie event, con i segnaposto dell'app (stella piena gialla e nota con bordo giallo).
 * Non si può spostare né cliccare, come uno screenshot; i segnaposto sono inventati e il disegno lo dichiara.
 * Niente librerie né immagini esterne, quindi nessun problema con la CSP (decisione 76).
 */
export function RadarMap() {
  return (
    <figure
      className="rs-radar"
      role="img"
      aria-label="Esempio di mappa con un raggio di ricerca, un concerto ufficiale e due eventi indie"
    >
      <svg
        className="rs-radar__svg"
        viewBox="0 0 600 440"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
      >
        <rect className="rs-radar__ground" width="600" height="440" />
        <g className="rs-radar__block">
          <rect x="40" y="40" width="120" height="80" />
          <rect x="200" y="30" width="150" height="100" />
          <rect x="400" y="50" width="160" height="70" />
          <rect x="30" y="170" width="130" height="90" />
          <rect x="430" y="170" width="140" height="100" />
          <rect x="60" y="320" width="150" height="90" />
          <rect x="260" y="330" width="120" height="80" />
          <rect x="430" y="320" width="130" height="90" />
        </g>
        <path className="rs-radar__river" d="M-10 285 C120 300 180 250 300 275 S480 320 610 290" />
        <g className="rs-radar__road">
          <path className="rs-radar__road--main" d="M0 140h600M0 300h600M180 0v440M385 0v440" />
          <path d="M0 80h600M0 365h600M100 0v440M300 0v440M500 0v440M0 230L600 190M0 440L250 230L600 20" />
        </g>
        <circle className="rs-radar__range" cx="300" cy="225" r="150" />
        <circle className="rs-radar__you-halo" cx="300" cy="225" r="14" />
        <circle className="rs-radar__you" cx="300" cy="225" r="6" />
        {PINS.map(({ kind, x, y }) => (
          <g key={`${x}-${y}`} data-kind={kind} transform={`translate(${x} ${y})`}>
            <circle className={`rs-radar__pin rs-radar__pin--${kind}`} r="17" />
            <path
              className={`rs-radar__glyph rs-radar__glyph--${kind}`}
              transform="translate(-10 -10) scale(.84)"
              d={ICON_PATHS[kind]}
            />
          </g>
        ))}
        <g className="rs-radar__range-label">
          <rect x="264" y="52" width="72" height="22" rx="4" />
          <text x="300" y="68" textAnchor="middle">
            15 KM
          </text>
        </g>
      </svg>
      <figcaption className="rs-radar__caption">Esempio illustrativo</figcaption>
    </figure>
  )
}
