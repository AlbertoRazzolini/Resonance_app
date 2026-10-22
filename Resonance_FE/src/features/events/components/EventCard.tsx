import { Link } from 'react-router'
import { concertPath, indieEventPath } from '@/app/routes'
import type { EventKind } from '@/components/map'
import { formatEventDate } from '@/lib/format/dates'
import { HideContentButton } from '@/features/admin/components/HideContentButton'
import { formatDistance } from '@/lib/format/distance'
import type { IndieEventResponse, OfficialConcertResponse } from '@/types/events'

type EventCardProps =
  | { kind: 'official'; event: OfficialConcertResponse; highlighted?: boolean }
  | { kind: 'indie'; event: IndieEventResponse; highlighted?: boolean }

/** Nome di ogni tipo nell'etichetta della card (le stesse parole della legenda della mappa). */
const KIND_LABELS: Record<EventKind, string> = { official: 'Ufficiale', indie: 'Indie' }

/**
 * Card di un evento nell'elenco: data in ora locale, tipo, distanza dal centro cercato, titolo, locale, generi e link al
 * dettaglio, più «Nascondi» per gli admin (progettazione, sezione 5.7). Con `highlighted` è la card del marker aperto sulla
 * mappa. Nessun testo qui è scritto da altri utenti come HTML: React ne fa l'escape.
 */
export function EventCard(props: EventCardProps) {
  const { event, kind, highlighted = false } = props
  const detailPath = kind === 'official' ? concertPath(event.id) : indieEventPath(event.id)

  return (
    <article
      className={`rs-event-card${highlighted ? ' rs-event-card--highlighted' : ''}`}
      aria-current={highlighted ? 'true' : undefined}
    >
      <div className="rs-event-card__top">
        <p className="rs-event-card__meta">
          <time dateTime={event.eventDate}>{formatEventDate(event.eventDate)}</time>
          <span className={`rs-event-card__kind rs-event-card__kind--${kind}`}>{KIND_LABELS[kind]}</span>
          {kind === 'indie' && props.event.isFree && (
            <span className="rs-event-card__kind rs-event-card__kind--free">Gratis</span>
          )}
        </p>
        {event.distanceKm !== null && <span className="rs-event-card__distance">{formatDistance(event.distanceKm)}</span>}
      </div>
      <h3 className="rs-event-card__title">{event.title}</h3>
      <p className="rs-event-card__venue">{event.venueName}</p>
      <div className="rs-event-card__bottom">
        <ul className="rs-event-card__tags">
          {event.genreTags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
        <div className="rs-event-card__actions">
          <HideContentButton
            type={kind === 'official' ? 'official-concerts' : 'indie-events'}
            id={event.id}
            authorId={kind === 'official' ? props.event.host.id : props.event.musician.id}
            name={event.title}
          />
          <Link className="btn btn-outline-light btn-sm" to={detailPath}>
            Dettagli<span className="visually-hidden">: {event.title}</span>
          </Link>
        </div>
      </div>
    </article>
  )
}
