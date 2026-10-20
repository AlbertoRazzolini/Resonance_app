import { Button, ButtonGroup } from 'react-bootstrap'
import { RADIUS_LEVELS } from '../hooks/useSearchCenter'

type RadiusSelectorProps = {
  /** Raggio attuale in km. */
  value: number
  onChange: (radiusKm: number) => void
}

/**
 * Raggio di ricerca a pulsanti, uno per livello (decisione 78): pochi valori fissi invece di uno slider, così ogni
 * livello resta in cache e non parte una richiesta per ogni valore intermedio.
 */
export function RadiusSelector({ value, onChange }: RadiusSelectorProps) {
  return (
    <ButtonGroup role="group" aria-label="Raggio" className="rs-radius">
      {RADIUS_LEVELS.map((level) => (
        <Button
          key={level}
          variant="outline-light"
          size="sm"
          aria-pressed={level === value}
          onClick={() => onChange(level)}
        >
          {level} km
        </Button>
      ))}
    </ButtonGroup>
  )
}
