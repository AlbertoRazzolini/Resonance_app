import { Nav, Tab } from 'react-bootstrap'
import { useSearchParams } from 'react-router'
import { HiddenContentList } from '../components/HiddenContentList'
import { MODERATED_TYPES, moderatedTypeFromKey } from '../contentTypes'

/**
 * Contenuti nascosti (progettazione, sezione 5.7): una scheda per tipo (Concerti, Indie, Post, Annunci) con «Ripristina».
 * La scheda aperta sta nell'indirizzo (`?scheda=`), come in Amici: il ricarico non la perde e un valore sconosciuto apre
 * «Concerti». Ogni elenco si carica solo quando la scheda è aperta. Solo ADMIN e SUPERADMIN entrano da `RequireRole`.
 */
export function Component() {
  const [searchParams, setSearchParams] = useSearchParams()
  const active = moderatedTypeFromKey(searchParams.get('scheda')) ?? MODERATED_TYPES[0]

  return (
    <>
      <div className="rs-collab-head">
        <div>
          <h1>Contenuti nascosti</h1>
          <p className="text-body-secondary">Ripristina ciò che è stato nascosto da un admin.</p>
        </div>
      </div>

      <Tab.Container
        id="hidden-content-tabs"
        activeKey={active.key}
        onSelect={(key) => setSearchParams(key && key !== MODERATED_TYPES[0].key ? { scheda: key } : {}, { replace: true })}
        mountOnEnter
        unmountOnExit
        transition={false}
      >
        <Nav variant="pills" className="rs-area-tabs">
          {MODERATED_TYPES.map((entry) => (
            <Nav.Item key={entry.key}>
              <Nav.Link eventKey={entry.key}>{entry.title}</Nav.Link>
            </Nav.Item>
          ))}
        </Nav>
        <Tab.Content className="rs-area-content">
          {MODERATED_TYPES.map((entry) => (
            <Tab.Pane key={entry.key} eventKey={entry.key}>
              <HiddenContentList type={entry.type} />
            </Tab.Pane>
          ))}
        </Tab.Content>
      </Tab.Container>
    </>
  )
}
