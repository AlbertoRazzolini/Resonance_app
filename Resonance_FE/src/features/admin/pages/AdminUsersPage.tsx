import { useState } from 'react'
import { Button, Form } from 'react-bootstrap'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Pagination } from '@/components/ui/Pagination'
import { Skeleton, SkeletonLine } from '@/components/ui/Skeleton'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import type { UserStatus } from '@/types/users'
import { useGetAdminUsersQuery } from '../api/adminApi'
import { AdminRoleButton } from '../components/AdminRoleButton'
import { AdminUserActions } from '../components/AdminUserActions'
import { AdminUserRow } from '../components/AdminUserRow'

/** Attesa prima di cercare: la stessa della ricerca persone (decisione 64). */
const SEARCH_DELAY_MS = 400

/** Opzioni del filtro di stato; il valore vuoto non filtra. */
const STATUS_OPTIONS: { value: UserStatus | ''; label: string }[] = [
  { value: '', label: 'Tutti gli stati' },
  { value: 'ACTIVE', label: 'Attivi' },
  { value: 'SUSPENDED', label: 'Sospesi' },
]

/**
 * Elenco utenti dell'area admin (progettazione, sezione 6.10): ricerca su email e nome con attesa, filtro di stato e
 * numeri di pagina. La pagina scelta vale solo per i filtri con cui è stata scelta: cambiando ricerca o stato si torna
 * alla prima, senza un effetto che la azzeri. Tabella da `lg`, schede sotto (CSS). Solo interfaccia: ADMIN e SUPERADMIN
 * entrano da `RequireRole`, il controllo vero è nel backend.
 */
export function Component() {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<UserStatus | ''>('')
  const search = useDebouncedValue(text.trim(), SEARCH_DELAY_MS)
  const filters = `${search}|${status}`
  const [chosen, setChosen] = useState({ filters, page: 0 })
  const page = chosen.filters === filters ? chosen.page : 0

  const { data, error, isLoading, isFetching, refetch } = useGetAdminUsersQuery({
    search: search || undefined,
    status: status || undefined,
    page,
  })

  return (
    <>
      <div className="rs-collab-head">
        <div>
          <h1>Utenti</h1>
          <p className="text-body-secondary">Cerca un account, sospendilo o gestisci il ruolo di admin.</p>
        </div>
      </div>

      <div className="rs-admin-filters">
        <Form.Group controlId="admin-users-search">
          <Form.Label>Cerca</Form.Label>
          <Form.Control
            type="search"
            value={text}
            maxLength={100}
            placeholder="Email o nome"
            onChange={(event) => setText(event.target.value)}
          />
        </Form.Group>
        <Form.Group controlId="admin-users-status">
          <Form.Label>Stato</Form.Label>
          <Form.Select value={status} onChange={(event) => setStatus(event.target.value as UserStatus | '')}>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
      </div>

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

      {data && data.content.length === 0 && <EmptyState title="Nessun utente trovato" />}

      {data && data.content.length > 0 && (
        <div className={`rs-admin-table-wrap${isFetching ? ' rs-admin-table-wrap--busy' : ''}`}>
          <table className="rs-admin-table">
            <caption className="visually-hidden">Utenti, dal più recente</caption>
            <thead>
              <tr>
                <th scope="col">Utente</th>
                <th scope="col">Ruoli</th>
                <th scope="col">Stato</th>
                <th scope="col">Registrato il</th>
                <th scope="col">
                  <span className="visually-hidden">Azioni</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.content.map((user) => (
                <AdminUserRow key={user.id} user={user}>
                  <AdminUserActions user={user} />
                  <AdminRoleButton user={user} />
                </AdminUserRow>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && <Pagination page={data.page} totalPages={data.totalPages} onChange={(next) => setChosen({ filters, page: next })} />}
    </>
  )
}
