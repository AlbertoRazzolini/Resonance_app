import { useState } from 'react'
import { Button } from 'react-bootstrap'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Pagination } from '@/components/ui/Pagination'
import { Skeleton, SkeletonLine } from '@/components/ui/Skeleton'
import type { ModeratedType } from '@/types/admin'
import { useGetHiddenContentQuery } from '../api/adminApi'
import { HiddenContentRow } from './HiddenContentRow'

/**
 * L'elenco dei contenuti nascosti di un tipo (progettazione, sezione 5.7), a numeri di pagina: tabella da `lg`, schede
 * sotto (CSS). Monta solo la scheda aperta, quindi chiede solo il suo tipo.
 */
export function HiddenContentList({ type }: { type: ModeratedType }) {
  const [page, setPage] = useState(0)
  const { data, error, isLoading, isFetching, refetch } = useGetHiddenContentQuery({ type, page })

  return (
    <>
      {isLoading && (
        <Skeleton>
          {[0, 1, 2].map((row) => (
            <SkeletonLine key={row} width={10} />
          ))}
        </Skeleton>
      )}

      {error && (
        <>
          <ErrorAlert error={error} />
          <Button variant="outline-light" size="sm" onClick={() => void refetch()}>
            Riprova
          </Button>
        </>
      )}

      {data && data.content.length === 0 && <EmptyState title="Nessun contenuto nascosto" />}

      {data && data.content.length > 0 && (
        <div className={`rs-admin-table-wrap${isFetching ? ' rs-admin-table-wrap--busy' : ''}`}>
          <table className="rs-admin-table">
            <caption className="visually-hidden">Contenuti nascosti, dal più recente</caption>
            <thead>
              <tr>
                <th scope="col">Contenuto</th>
                <th scope="col">Nascosto il</th>
                <th scope="col">Dettagli</th>
                <th scope="col">
                  <span className="visually-hidden">Azioni</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.content.map((item) => (
                <HiddenContentRow key={item.id} type={type} item={item} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />}
    </>
  )
}
