import { Button } from 'react-bootstrap'
import { visiblePages } from '@/lib/visiblePages'

type PaginationProps = {
  /** Pagina corrente, da 0. */
  page: number
  totalPages: number
  /** Chiamata con l'indice da 0 della pagina scelta. */
  onChange: (page: number) => void
}

/**
 * Numeri di pagina per gli elenchi dell'area admin (adattato da `Paginazione` di NoseY, stile Bootstrap): «Precedente»,
 * i numeri con la pagina corrente segnata e «Successivo». Con una sola pagina non disegna niente.
 */
export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <nav className="rs-pagination" aria-label="Pagine">
      <Button variant="outline-light" size="sm" disabled={page === 0} onClick={() => onChange(page - 1)}>
        Precedente
      </Button>
      <ul className="rs-pagination__pages">
        {visiblePages(page, totalPages).map((index, position) =>
          index === null ? (
            <li key={`gap-${position}`} aria-hidden="true" className="rs-pagination__gap">
              …
            </li>
          ) : (
            <li key={index}>
              <Button
                variant={index === page ? 'primary' : 'outline-light'}
                size="sm"
                aria-label={`Pagina ${index + 1}`}
                aria-current={index === page ? 'page' : undefined}
                onClick={() => onChange(index)}
              >
                {index + 1}
              </Button>
            </li>
          ),
        )}
      </ul>
      <Button variant="outline-light" size="sm" disabled={page >= totalPages - 1} onClick={() => onChange(page + 1)}>
        Successivo
      </Button>
    </nav>
  )
}
