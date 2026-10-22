import { useState } from 'react'
import { Button } from 'react-bootstrap'
import { useNavigate } from 'react-router'
import { chatPath } from '@/app/routes'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { useAppDispatch } from '@/hooks/redux'
import { useOpenConversationMutation } from '@/features/chat/api/chatApi'
import { errorCode } from '@/lib/api/baseQuery'
import { confirmationShown } from '@/lib/notices/confirmationSlice'
import type { FriendshipView } from '@/types/friends'
import {
  FRIENDSHIP_TAGS,
  friendsApi,
  useAcceptFriendshipMutation,
  useCancelFriendshipMutation,
  useDeclineFriendshipMutation,
  useRemoveFriendshipMutation,
  useRequestFriendshipMutation,
} from '../api/friendsApi'

type FriendshipButtonProps = {
  userId: string
  displayName: string
  status: FriendshipView
  /** C'è per `OUTGOING`, `INCOMING` e `FRIENDS`: serve ad annullare, accettare, rifiutare e rimuovere. */
  friendshipId: string | null
}

/** Etichetta con il nome della persona solo per i lettori di schermo, come «Candidati» nelle card collab. */
function Label({ text, name }: { text: string; name: string }) {
  return (
    <>
      {text}
      <span className="visually-hidden">: {name}</span>
    </>
  )
}

/** Un `ErrorResponse` 409 o 404: lo stato mostrato era vecchio, quindi si rileggono elenchi e ricerca. */
const isStale = (error: unknown) =>
  typeof error === 'object' && error !== null && 'status' in error && (error.status === 409 || error.status === 404)

/**
 * Pulsante dell'amicizia per i cinque stati visti da chi guarda (progettazione, sezione 6.14): `NONE` Aggiungi,
 * `OUTGOING` Annulla, `INCOMING` Accetta e Rifiuta, `FRIENDS` Rimuovi (con conferma) e Scrivi, `UNAVAILABLE` spento.
 * «Scrivi» trova o crea la conversazione (`POST /api/chats`) e apre la chat; un rifiuto (`NOT_FRIENDS`) resta scritto
 * nella riga. Una riuscita si conferma in cima alla pagina; un errore resta scritto nella riga. `FRIEND_REQUEST_ALREADY_RECEIVED` non è un errore: la ricerca si ricarica e mostra
 * «Accetta». Il componente non decide lo stato: arriva dal genitore e cambia quando gli elenchi si ricaricano.
 */
export function FriendshipButton({ userId, displayName, status, friendshipId }: FriendshipButtonProps) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [openConversation] = useOpenConversationMutation()
  const [request] = useRequestFriendshipMutation()
  const [accept] = useAcceptFriendshipMutation()
  const [decline] = useDeclineFriendshipMutation()
  const [cancel] = useCancelFriendshipMutation()
  const [remove] = useRemoveFriendshipMutation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)

  /** Esegue l'azione: conferma scritta se riesce, altrimenti l'errore nella riga (o l'invito, per la richiesta già ricevuta). */
  async function run(action: () => Promise<unknown>, doneText: string) {
    setBusy(true)
    setError(null)
    try {
      await action()
      dispatch(confirmationShown(doneText))
    } catch (failure) {
      const data = typeof failure === 'object' && failure !== null && 'data' in failure ? failure.data : undefined
      if (errorCode(data) === 'FRIEND_REQUEST_ALREADY_RECEIVED') {
        dispatch(confirmationShown('Questa persona ti ha già inviato una richiesta'))
      } else {
        setError(failure)
      }
      if (isStale(failure)) dispatch(friendsApi.util.invalidateTags([...FRIENDSHIP_TAGS]))
    } finally {
      setBusy(false)
    }
  }

  /** «Scrivi»: apre la conversazione con la persona e porta alla chat; l'errore resta nella riga. */
  async function writeTo() {
    setBusy(true)
    setError(null)
    try {
      const conversation = await openConversation(userId).unwrap()
      navigate(chatPath(conversation.id))
    } catch (failure) {
      setError(failure)
    } finally {
      setBusy(false)
    }
  }

  const act = (action: (id: string) => { unwrap: () => Promise<unknown> }, doneText: string) =>
    friendshipId ? run(() => action(friendshipId).unwrap(), doneText) : undefined

  return (
    <>
      <div className="rs-person__actions">
        {status === 'NONE' && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => void run(() => request(userId).unwrap(), 'Richiesta inviata')}
          >
            <Label text="Aggiungi" name={displayName} />
          </Button>
        )}

        {status === 'OUTGOING' && (
          <>
            <span className="rs-person__state">Richiesta inviata</span>
            <Button
              size="sm"
              variant="outline-light"
              disabled={busy || !friendshipId}
              onClick={() => void act(cancel, 'Richiesta annullata')}
            >
              <Label text="Annulla" name={displayName} />
            </Button>
          </>
        )}

        {status === 'INCOMING' && (
          <>
            <Button size="sm" disabled={busy || !friendshipId} onClick={() => void act(accept, 'Amicizia accettata')}>
              <Label text="Accetta" name={displayName} />
            </Button>
            <Button
              size="sm"
              variant="outline-light"
              disabled={busy || !friendshipId}
              onClick={() => void act(decline, 'Richiesta rifiutata')}
            >
              <Label text="Rifiuta" name={displayName} />
            </Button>
          </>
        )}

        {status === 'FRIENDS' && (
          <>
            <span className="rs-person__state">Amici</span>
            <Button size="sm" variant="outline-light" disabled={busy} onClick={() => void writeTo()}>
              <Label text="Scrivi" name={displayName} />
            </Button>
            <Button
              size="sm"
              variant="outline-light"
              disabled={busy || !friendshipId}
              onClick={() => setConfirmRemove(true)}
            >
              <Label text="Rimuovi" name={displayName} />
            </Button>
          </>
        )}

        {status === 'UNAVAILABLE' && (
          <Button size="sm" variant="outline-light" disabled>
            Non disponibile
          </Button>
        )}
      </div>

      {error !== null && (
        <div className="rs-person__error">
          <ErrorAlert error={error} />
        </div>
      )}

      <ConfirmDialog
        show={confirmRemove}
        title={`Rimuovere ${displayName} dagli amici?`}
        body={`La chat resta leggibile, ma nessuno dei due potrà più scrivere. ${displayName} non riceve nessun avviso.`}
        confirmLabel="Rimuovi"
        busy={busy}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => {
          void act(remove, 'Amicizia rimossa')?.then(() => setConfirmRemove(false))
        }}
      />
    </>
  )
}
