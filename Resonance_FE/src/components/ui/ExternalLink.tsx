import { useState, type ReactNode } from 'react'
import { Button, Modal } from 'react-bootstrap'
import { hostOf, parseHttpUrl } from '@/lib/urls'

type ExternalLinkProps = {
  /** Indirizzo scritto da un utente: solo `http` e `https` diventano un collegamento. */
  href: string
  /** Testo del pulsante; senza, si mostra il dominio. */
  children?: ReactNode
}

/**
 * Collegamento a un sito esterno (progettazione, sezione 4.13). È un pulsante, non un `<a>`: il clic apre una conferma
 * con il dominio e solo «Continua» apre la nuova scheda, senza `Referer` né accesso a questa pagina (`noopener
 * noreferrer`). Un indirizzo che non è `http`/`https` (`javascript:`, `data:`…) resta testo inerte.
 */
export function ExternalLink({ href, children }: ExternalLinkProps) {
  const [confirming, setConfirming] = useState(false)
  const url = parseHttpUrl(href)

  if (!url) return <span>{children ?? href}</span>

  const host = hostOf(url)
  return (
    <>
      <Button variant="link" className="p-0 align-baseline" onClick={() => setConfirming(true)}>
        {children ?? host}
      </Button>
      <Modal show={confirming} onHide={() => setConfirming(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Stai uscendo da Resonance</Modal.Title>
        </Modal.Header>
        <Modal.Body>Aprirai {host} in una nuova scheda.</Modal.Body>
        <Modal.Footer>
          <Button variant="outline-light" onClick={() => setConfirming(false)}>
            Annulla
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              window.open(url.href, '_blank', 'noopener,noreferrer')
              setConfirming(false)
            }}
          >
            Continua
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  )
}
