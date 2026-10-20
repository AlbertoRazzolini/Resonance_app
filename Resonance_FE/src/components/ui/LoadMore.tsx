import { Button } from 'react-bootstrap'

type LoadMoreProps = {
  /** Ci sono altre pagine da caricare. */
  hasMore: boolean
  /** Una pagina è in arrivo: il pulsante si spegne per non chiederne due uguali. */
  loading: boolean
  onClick: () => void
}

/** "Carica altri" in fondo agli elenchi a pagine: sparisce quando le pagine sono finite. */
export function LoadMore({ hasMore, loading, onClick }: LoadMoreProps) {
  if (!hasMore) return null
  return (
    <div className="d-flex justify-content-center my-3">
      <Button variant="outline-light" disabled={loading} aria-busy={loading} onClick={onClick}>
        Carica altri
      </Button>
    </div>
  )
}
