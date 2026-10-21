import { useState } from 'react'
import { Alert, Button } from 'react-bootstrap'
import { useSearchParams } from 'react-router'
import { EmptyState } from '@/components/ui/EmptyState'
import { RadiusSelector } from '@/components/ui/RadiusSelector'
import { DEFAULT_RADIUS_KM, parseRadius, useSearchCenter } from '@/hooks/useSearchCenter'
import { NewPostPanel } from '../components/NewPostPanel'
import { PostPages, type FeedFilter } from '../components/PostPages'

/**
 * Feed (progettazione, sezione 6.8), aperto anche a chi non ha la sessione: i post dal più recente, «Carica altri» e il
 * filtro «Vicino a me» facoltativo, con centro e raggio come in Eventi vicini (`useSearchCenter`, livelli di raggio). Il
 * filtro sta nell'indirizzo (`?vicino=1&raggio=25`), così «Indietro» dal profilo di un autore lo ritrova.
 */
export function Component() {
  const [searchParams, setSearchParams] = useSearchParams()
  const nearby = searchParams.get('vicino') === '1'
  const radius = parseRadius(searchParams.get('raggio'))
  const { center, source, positionStatus, requestPosition } = useSearchCenter()
  const [notices, setNotices] = useState<string[]>([])

  /** Indirizzo con il filtro e il raggio dati; i valori iniziali non si scrivono. */
  function searchFor(nextNearby: boolean, nextRadius: number) {
    const next = new URLSearchParams()
    if (nextNearby) {
      next.set('vicino', '1')
      if (nextRadius !== DEFAULT_RADIUS_KM) next.set('raggio', String(nextRadius))
    }
    return next
  }

  const filter: FeedFilter | null = nearby ? { lat: center.latitude, lng: center.longitude, radiusKm: radius } : null

  return (
    <>
      <h1>Feed</h1>

      {notices.map((notice) => (
        <Alert key={notice} variant="success" role="status">
          {notice}
        </Alert>
      ))}

      <NewPostPanel onPublished={setNotices} />

      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 my-3">
        <Button
          variant="outline-light"
          size="sm"
          aria-pressed={nearby}
          onClick={() => setSearchParams(searchFor(!nearby, radius), { replace: true })}
        >
          Vicino a me
        </Button>
        {nearby && (
          <RadiusSelector value={radius} onChange={(next) => setSearchParams(searchFor(true, next), { replace: true })} />
        )}
      </div>

      {nearby && source === 'default' && (
        // `status`, non `alert`: è un'informazione fissa, non un errore da annunciare subito
        <Alert variant="secondary" role="status">
          Stai vedendo i post vicino a Firenze. Usa la tua posizione per vedere quelli più vicini a te.
        </Alert>
      )}
      {nearby && source !== 'browser' && (
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          <Button
            variant="outline-light"
            size="sm"
            disabled={positionStatus === 'pending'}
            onClick={() => void requestPosition()}
          >
            {positionStatus === 'pending' ? 'Cerco la posizione…' : 'Usa la mia posizione'}
          </Button>
          {positionStatus === 'denied' && (
            <span role="alert" className="text-danger">
              Permesso negato: abilitalo dalle impostazioni del browser.
            </span>
          )}
          {positionStatus === 'unavailable' && (
            <span role="alert" className="text-danger">
              Non riesco a trovare la tua posizione.
            </span>
          )}
        </div>
      )}

      {/* Con una ricerca diversa si riparte dalla prima pagina: cambiando la chiave lo stato delle pagine si azzera */}
      <section aria-label="Post del feed">
        <PostPages
          key={filter ? `${filter.lat},${filter.lng}|${filter.radiusKm}` : 'all'}
          source={{ kind: 'feed', filter }}
          emptyState={
            nearby ? (
              <EmptyState title={`Nessun post entro ${radius} km`} hint="Prova ad allargare il raggio." />
            ) : (
              <EmptyState title="Ancora nessun post." hint="Scrivi il primo!" />
            )
          }
          onDeleted={() => setNotices(['Post cancellato.'])}
        />
      </section>
    </>
  )
}
