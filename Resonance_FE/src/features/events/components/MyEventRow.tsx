import { Button } from 'react-bootstrap'
import { Link } from 'react-router'
import { concertPath, indieEventPath } from '@/app/routes'
import { formatEventDate } from '@/lib/format/dates'
import type { IndieEventResponse, OfficialConcertResponse } from '@/types/events'

/** Un evento dell'utente nelle sue schede: il tipo decide il dettaglio e se c'è la bozza. */
export type MyEvent =
  | { kind: 'official'; event: OfficialConcertResponse }
  | { kind: 'indie'; event: IndieEventResponse }

type MyEventRowProps = {
  item: MyEvent
  /** Istante di riferimento per «Concluso» (millisecondi): lo sceglie la scheda, così la riga non legge l'orologio. */
  now: number
  /** Un'azione è in corso su qualche riga: i pulsanti sono spenti. */
  busy: boolean
  onPublish: (event: IndieEventResponse) => void
  onDelete: (item: MyEvent) => void
}

/**
 * Riga compatta di un evento dell'utente (decisione 77): data, etichette «Bozza» e «Concluso», titolo che porta al
 * dettaglio, locale e le azioni del proprietario. «Pubblica» c'è solo per le bozze degli indie event.
 */
export function MyEventRow({ item, now, busy, onPublish, onDelete }: MyEventRowProps) {
  const { event } = item
  const detailPath = item.kind === 'official' ? concertPath(event.id) : indieEventPath(event.id)
  const isDraft = item.kind === 'indie' && item.event.status === 'DRAFT'
  const isPast = new Date(event.eventDate).getTime() < now

  return (
    <article className="rs-my-event" aria-label={event.title}>
      <div className="rs-my-event__main">
        <p className="rs-event-card__meta">
          <time dateTime={event.eventDate}>{formatEventDate(event.eventDate)}</time>
          {isDraft && <span className="rs-event-card__kind">Bozza</span>}
          {isPast && <span className="rs-event-card__kind">Concluso</span>}
        </p>
        <h3 className="rs-my-event__title">
          <Link to={detailPath}>{event.title}</Link>
        </h3>
        <p className="rs-event-card__venue">{event.venueName}</p>
      </div>
      <div className="rs-my-event__actions">
        {item.kind === 'indie' && isDraft && (
          <Button variant="primary" size="sm" disabled={busy} onClick={() => onPublish(item.event)}>
            Pubblica<span className="visually-hidden">: {event.title}</span>
          </Button>
        )}
        <Button variant="outline-light" size="sm" disabled={busy} onClick={() => onDelete(item)}>
          Cancella<span className="visually-hidden">: {event.title}</span>
        </Button>
      </div>
    </article>
  )
}
