import { useState } from 'react'
import { Link } from 'react-router'
import { ROUTES, userPath } from '@/app/routes'
import type { EventKind } from '@/components/map'
import { ExternalLink } from '@/components/ui/ExternalLink'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatEventDateLong } from '@/lib/format/dates'
import { parseHttpUrl } from '@/lib/urls'
import type { IndieEventResponse, OfficialConcertResponse } from '@/types/events'

type EventDetailProps =
  | { kind: 'official'; event: OfficialConcertResponse }
  | { kind: 'indie'; event: IndieEventResponse }

/** Nome di ogni tipo nell'etichetta (le stesse parole delle card e della legenda). */
const KIND_LABELS: Record<EventKind, string> = { official: 'Ufficiale', indie: 'Indie' }

/**
 * Copertina dell'evento: un riquadro di caricamento finché l'immagine arriva, nessun riquadro se non c'è o non si
 * carica. L'indirizzo lo ha scritto un utente: si usa solo se è `http`/`https`, e l'immagine si chiede senza `Referer`.
 */
function Cover({ url, title }: { url: string | null; title: string }) {
  // Si ricorda l'indirizzo che ha fallito o che si è caricato, non un booleano: un indirizzo nuovo riparte da capo
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const safeUrl = parseHttpUrl(url)?.href ?? null
  if (safeUrl === null || safeUrl === failedUrl) return null
  const loaded = loadedUrl === safeUrl

  return (
    <div className="rs-cover">
      {!loaded && (
        <Skeleton>
          <div className="rs-cover__placeholder placeholder" />
        </Skeleton>
      )}
      <img
        src={safeUrl}
        alt={title}
        referrerPolicy="no-referrer"
        className={loaded ? undefined : 'visually-hidden'}
        onLoad={() => setLoadedUrl(safeUrl)}
        onError={() => setFailedUrl(safeUrl)}
      />
    </div>
  )
}

/**
 * Dettaglio di un concerto o di un indie event (progettazione, sezione 6.6). I testi scritti dall'organizzatore
 * (titolo, locale, descrizione) passano solo dall'escape di React; la descrizione va a capo con CSS. `UserText` (FE-07)
 * li sostituirà aggiungendo i link.
 */
export function EventDetail(props: EventDetailProps) {
  const { kind, event } = props
  const author = kind === 'official' ? props.event.host : props.event.musician
  // Il biglietto lo ha scritto un utente: senza un indirizzo http/https non si mostra niente
  const ticketUrl = kind === 'official' ? parseHttpUrl(props.event.externalTicketUrl)?.href : undefined

  return (
    <article className="rs-event-detail">
      <Link to={ROUTES.events}>Eventi</Link>
      <Cover url={event.coverImageUrl} title={event.title} />

      <p className="rs-event-detail__badges">
        <span className="rs-event-card__kind">{KIND_LABELS[kind]}</span>
        {kind === 'indie' && props.event.status === 'DRAFT' && <span className="rs-event-card__kind">Bozza</span>}
      </p>
      <h1>{event.title}</h1>

      <dl className="rs-event-detail__facts">
        <dt>Organizzato da</dt>
        <dd>
          <Link to={userPath(author.id)}>{author.displayName}</Link>
        </dd>
        <dt>Locale</dt>
        <dd>{event.venueName}</dd>
        <dt>Indirizzo</dt>
        <dd>{event.address}</dd>
        <dt>Quando</dt>
        <dd>
          <time dateTime={event.eventDate}>{formatEventDateLong(event.eventDate)}</time>
        </dd>
      </dl>

      {event.genreTags.length > 0 && (
        <ul className="rs-event-card__tags">
          {event.genreTags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      )}

      {kind === 'indie' && <p>{props.event.isFree ? 'Ingresso gratuito' : 'Ingresso a pagamento'}</p>}
      {ticketUrl && (
        <p>
          <ExternalLink href={ticketUrl}>Acquista il biglietto</ExternalLink>
        </p>
      )}

      {event.description && <div className="rs-event-detail__description">{event.description}</div>}
    </article>
  )
}
