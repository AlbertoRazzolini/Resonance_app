import { useState } from 'react'
import { AnimateIcon } from '@animate-ui/react/icons'
import { LogOut } from '@/components/animate-ui/icons/log-out'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useLogoutMutation } from '@/features/auth/api/authApi'

/**
 * Pulsante «Esci» con l'icona animata (decisione dello studente, 25 ottobre): `side` in fondo alla colonna a sinistra, da
 * 768 px, con la scritta come le altre voci; `bar` solo icona nella barra in alto, sul telefono (da 768 px lo nasconde il
 * CSS). Prima di chiudere la sessione una finestra chiede conferma. L'animazione sta sul pulsante intero e parte anche al tocco.
 */
export function LogoutButton({ variant = 'side' }: { variant?: 'side' | 'bar' }) {
  const [logout] = useLogoutMutation()
  const [confirming, setConfirming] = useState(false)

  return (
    <>
      <AnimateIcon animateOnHover animateOnTap asChild>
        {variant === 'side' ? (
          <button type="button" className="rs-side-item rs-side-logout" onClick={() => setConfirming(true)}>
            <LogOut size={22} />
            <span>Esci</span>
          </button>
        ) : (
          <button type="button" className="rs-logout--bar" aria-label="Esci" onClick={() => setConfirming(true)}>
            <LogOut size={22} />
          </button>
        )}
      </AnimateIcon>
      <ConfirmDialog
        show={confirming}
        title="Vuoi uscire?"
        body="Dovrai accedere di nuovo per tornare."
        confirmLabel="Esci"
        onConfirm={() => {
          setConfirming(false)
          void logout()
        }}
        onCancel={() => setConfirming(false)}
      />
    </>
  )
}
