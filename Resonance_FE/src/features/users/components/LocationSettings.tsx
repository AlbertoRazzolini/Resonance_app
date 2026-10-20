import { Alert, Button } from 'react-bootstrap'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { selectCurrentUser } from '@/features/auth/authSlice'
import { useAppSelector } from '@/hooks/redux'
import { useBrowserPosition } from '@/hooks/useBrowserPosition'
import { useRemoveLocationMutation, useUpdateProfileMutation } from '../api/usersApi'
import { buildLocationPatch } from '../profilePatch'

/**
 * Condivisione della posizione (progettazione, decisione 30): il pulsante chiede la posizione al browser e invia
 * latitudine e longitudine insieme con il `PATCH`; «Smetti di condividere» usa `DELETE /api/users/me/location`,
 * perché nel `PATCH` `null` vuol dire «invariato». Le coordinate non si mostrano mai: si dice solo se si condivide.
 */
export function LocationSettings() {
  const user = useAppSelector(selectCurrentUser)
  const { status, request } = useBrowserPosition()
  const [updateProfile, update] = useUpdateProfileMutation()
  const [removeLocation, remove] = useRemoveLocationMutation()

  // RequireAuth non mostra questa pagina senza sessione: l'utente c'è sempre
  if (!user) return null

  // Una coordinata sola non è una posizione: il backend le salva sempre insieme
  const shared = user.latitude !== null && user.longitude !== null
  const busy = status === 'pending' || update.isLoading || remove.isLoading

  async function share() {
    update.reset()
    remove.reset()
    const position = await request()
    if (!position) return
    try {
      await updateProfile(buildLocationPatch(position)).unwrap()
    } catch {
      // L'errore lo mostra la sezione, dallo stato della mutazione
    }
  }

  async function stopSharing() {
    update.reset()
    remove.reset()
    try {
      await removeLocation().unwrap()
    } catch {
      // L'errore lo mostra la sezione, dallo stato della mutazione
    }
  }

  return (
    <div className="rs-location">
      <p className="rs-location__state">
        {shared ? 'Posizione condivisa' : 'Non stai condividendo la tua posizione'}
      </p>
      {status === 'denied' && (
        <Alert variant="warning">
          Hai negato l'accesso alla posizione. Puoi riattivarlo dalle impostazioni del browser.
        </Alert>
      )}
      {status === 'unavailable' && (
        <Alert variant="warning">Non riesco a trovare la tua posizione. Riprova tra poco.</Alert>
      )}
      <ErrorAlert error={update.error ?? remove.error} />
      {shared ? (
        <Button variant="outline-light" disabled={busy} onClick={() => void stopSharing()}>
          Smetti di condividere
        </Button>
      ) : (
        <Button variant="primary" disabled={busy} onClick={() => void share()}>
          {status === 'pending' ? 'Sto cercando la tua posizione…' : 'Condividi la mia posizione'}
        </Button>
      )}
    </div>
  )
}
