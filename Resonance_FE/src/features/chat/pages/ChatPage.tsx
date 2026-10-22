import { useParams } from 'react-router'
import { EmptyState } from '@/components/ui/EmptyState'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { ConversationList } from '../components/ConversationList'
import { ConversationView } from '../components/ConversationView'

/**
 * Messaggi (progettazione, sezione 6.9): da 1200 px l'elenco e la conversazione stanno affiancati; su telefono e tablet
 * un pannello alla volta (l'elenco su `/chat`, la conversazione su `/chat/:id`). Sul desktop senza conversazione scelta
 * il pannello lo dice.
 */
export function Component() {
  const { id } = useParams()
  const isDesktop = useMediaQuery('(min-width: 1200px)')

  return (
    <div className="rs-chat">
      {(isDesktop || !id) && <ConversationList activeId={id} />}
      {(isDesktop || id) && (
        <div className="rs-chat__panel">
          {id ? <ConversationView key={id} conversationId={id} /> : <EmptyState title="Scegli una conversazione" />}
        </div>
      )}
    </div>
  )
}
