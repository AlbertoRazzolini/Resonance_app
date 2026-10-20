/** Tipo di evento mostrato sulla mappa: i concerti ufficiali e gli indie event hanno endpoint e icone distinti. */
export type EventKind = 'official' | 'indie'

/** Nome di ogni tipo nelle etichette dei marker e della legenda (stesse parole delle card). */
const KIND_LABELS: Record<EventKind, string> = {
  official: 'Ufficiale',
  indie: 'Indie',
}

// Due disegni diversi, così i tipi si distinguono anche senza vedere il colore (stella e nota musicale).
const ICON_PATHS: Record<EventKind, string> = {
  official: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  indie: 'M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z',
}

function KindIcon({ kind }: { kind: EventKind }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path d={ICON_PATHS[kind]} fill="currentColor" />
    </svg>
  )
}

type EventMarkerProps = {
  kind: EventKind
  /** Titolo dell'evento: il nome del marker per i lettori di schermo, con il tipo. */
  label: string
  selected?: boolean
  onSelect: () => void
}

/**
 * Marker di un evento: un vero pulsante, raggiungibile con Tab e attivabile con Invio e barra spaziatrice. Il tipo si
 * legge dall'icona e dal nome, non solo dal colore. Sta dentro il `Marker` di react-map-gl, che lo posiziona.
 */
export function EventMarker({ kind, label, selected = false, onSelect }: EventMarkerProps) {
  return (
    <button
      type="button"
      className={`rs-map-marker rs-map-marker--${kind}`}
      aria-label={`${label} (${KIND_LABELS[kind].toLowerCase()})`}
      aria-pressed={selected}
      title={label}
      onClick={onSelect}
    >
      <KindIcon kind={kind} />
    </button>
  )
}

/** Legenda sopra la mappa: l'icona di ogni tipo con il suo nome. */
export function MarkerLegend() {
  return (
    <ul className="rs-map-legend">
      {(Object.keys(KIND_LABELS) as EventKind[]).map((kind) => (
        <li key={kind}>
          <span className={`rs-map-marker rs-map-marker--${kind} rs-map-marker--static`} aria-hidden="true">
            <KindIcon kind={kind} />
          </span>
          <span>{KIND_LABELS[kind]}</span>
        </li>
      ))}
    </ul>
  )
}
