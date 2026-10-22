import { Nav, Tab } from 'react-bootstrap'
import { Link, useSearchParams } from 'react-router'
import { ROUTES } from '@/app/routes'
import type { FriendshipListType } from '@/types/friends'
import { FriendshipPages } from '../components/FriendshipPages'

/** Schede in ordine: la chiave è il valore di `?scheda=` (nessun parametro = «Amici»). */
const TABS: { key: string; title: string; type: FriendshipListType }[] = [
  { key: 'amici', title: 'Amici', type: 'FRIENDS' },
  { key: 'ricevute', title: 'Ricevute', type: 'INCOMING' },
  { key: 'inviate', title: 'Inviate', type: 'OUTGOING' },
]

/**
 * Amici e richieste (progettazione, sezione 6.14): le schede Amici, Ricevute e Inviate. La scheda aperta sta
 * nell'indirizzo (`?scheda=`), così la campanella porta a «Ricevute» e il ricarico non la perde; un valore sconosciuto
 * apre «Amici». Ogni elenco si carica solo quando la scheda è aperta.
 */
export function Component() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('scheda')
  const active = TABS.find((tab) => tab.key === requested) ?? TABS[0]

  return (
    <>
      <div className="rs-collab-head">
        <div>
          <h1>Amici</h1>
          <p className="text-body-secondary">Le persone con cui puoi scrivere e le richieste in attesa.</p>
        </div>
        <Link className="btn btn-outline-light" to={ROUTES.userSearch}>
          Cerca persone
        </Link>
      </div>

      <Tab.Container
        id="friends-tabs"
        activeKey={active.key}
        onSelect={(key) =>
          setSearchParams(key && key !== TABS[0].key ? { scheda: key } : {}, { replace: true })
        }
        mountOnEnter
        unmountOnExit
        transition={false}
      >
        <Nav variant="pills" className="rs-area-tabs">
          {TABS.map((tab) => (
            <Nav.Item key={tab.key}>
              <Nav.Link eventKey={tab.key}>{tab.title}</Nav.Link>
            </Nav.Item>
          ))}
        </Nav>
        <Tab.Content className="rs-area-content">
          {TABS.map((tab) => (
            <Tab.Pane key={tab.key} eventKey={tab.key}>
              <FriendshipPages type={tab.type} />
            </Tab.Pane>
          ))}
        </Tab.Content>
      </Tab.Container>
    </>
  )
}
