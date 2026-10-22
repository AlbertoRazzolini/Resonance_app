import { useId, useState } from 'react'
import { Button } from 'react-bootstrap'
import { Link } from 'react-router'
import { userPath } from '@/app/routes'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { UserText } from '@/components/ui/UserText'
import { useGetPublicUserQuery } from '@/features/users/api/usersApi'
import { useAppDispatch } from '@/hooks/redux'
import { formatDate } from '@/lib/format/dates'
import { confirmationShown } from '@/lib/notices/confirmationSlice'
import type { HiddenContentResponse, ModeratedType } from '@/types/admin'
import { useRestoreContentMutation } from '../api/adminApi'

/** Chi ha nascosto: il nome dell'admin da una chiamata al profilo pubblico, «un admin» finché non arriva o se fallisce. */
function HiddenBy({ userId }: { userId: string }) {
  const { data } = useGetPublicUserQuery(userId)
  return <span>Nascosto da {data?.displayName ?? 'un admin'}</span>
}

/**
 * Una riga dell'elenco dei nascosti (progettazione, sezione 5.7): titolo e autore, quando, il motivo e chi ha nascosto.
 * Un contenuto eliminato dal proprietario lo dice («Eliminato dall'utente», senza cercare nessun profilo) e non si
 * ripristina (`RESTORE_NOT_ALLOWED`): «Ripristina» è spento con la spiegazione. Per gli altri «Ripristina» chiede conferma
 * e rilegge gli elenchi (`contentTags`). I testi scritti dagli utenti (titolo, motivo) passano da `UserText`.
 */
export function HiddenContentRow({ type, item }: { type: ModeratedType; item: HiddenContentResponse }) {
  const dispatch = useAppDispatch()
  const [restore, restoring] = useRestoreContentMutation()
  const [confirming, setConfirming] = useState(false)
  const hintId = useId()

  function close() {
    setConfirming(false)
    restoring.reset()
  }

  async function handleRestore() {
    try {
      await restore({ type, id: item.id }).unwrap()
      dispatch(confirmationShown('Contenuto ripristinato.'))
      close()
    } catch {
      // L'errore resta nello stato della mutazione e la finestra lo mostra
    }
  }

  return (
    <tr className="rs-admin-row">
      <td className="rs-admin-row__who">
        <div className="rs-admin-row__cell rs-admin-row__cell--stack">
          <span className="rs-admin-row__name">
            <UserText text={item.title} />
          </span>
          <Link className="rs-admin-row__email" to={userPath(item.author.id)}>
            {item.author.displayName}
          </Link>
        </div>
      </td>
      <td data-label="Nascosto il">
        <time dateTime={item.hiddenAt}>{formatDate(item.hiddenAt)}</time>
      </td>
      <td data-label="Dettagli">
        <p className="rs-admin-row__suspension">
          {item.deletedByOwner ? <span>Eliminato dall'utente</span> : <HiddenBy userId={item.hiddenBy} />}
          {item.hiddenReason && (
            <span>
              <UserText text={`Motivo: ${item.hiddenReason}`} />
            </span>
          )}
        </p>
      </td>
      <td className="rs-admin-row__actions">
        <div className="rs-admin-row__cell">
          {/* Il pulsante e la sua frase in colonna: la frase sta sotto, mai di fianco */}
          <div className="rs-admin-action">
            <Button
              variant="outline-light"
              size="sm"
              disabled={item.deletedByOwner}
              aria-label={`Ripristina ${item.title}`}
              aria-describedby={item.deletedByOwner ? hintId : undefined}
              onClick={() => setConfirming(true)}
            >
              Ripristina
            </Button>
            {item.deletedByOwner && (
              <span id={hintId} className="rs-admin-row__hint">
                Eliminato dall'utente: non si può ripristinare.
              </span>
            )}
          </div>
          <ConfirmDialog
            show={confirming}
            title="Ripristinare il contenuto?"
            body="Tornerà visibile a tutti."
            confirmLabel="Ripristina"
            busy={restoring.isLoading}
            error={restoring.error}
            onConfirm={() => void handleRestore()}
            onCancel={close}
          />
        </div>
      </td>
    </tr>
  )
}
