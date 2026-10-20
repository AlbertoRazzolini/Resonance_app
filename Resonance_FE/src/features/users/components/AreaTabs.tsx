import { useMemo, useState } from 'react'
import { Nav, Tab } from 'react-bootstrap'
import { useAppSelector } from '@/hooks/redux'
import { AREA_TABS, type AreaTab } from '../areaTabs'

/**
 * Schede dei contenuti dell'utente sotto il profilo: mostra quelle del registro `AREA_TABS` che spettano ai suoi
 * ruoli, con la prima aperta; il contenuto di una scheda si monta solo quando è aperta, così le card successive
 * caricano i loro elenchi (`/mine`) solo se l'utente li guarda.
 */
export function AreaTabs({ tabs = AREA_TABS }: { tabs?: AreaTab[] }) {
  const roles = useAppSelector((state) => state.auth.user?.roles)
  const visible = useMemo(
    () => tabs.filter((tab) => !tab.roles || tab.roles.some((role) => roles?.includes(role))),
    [tabs, roles],
  )
  const [selected, setSelected] = useState<string | null>(null)
  // Una scheda che sparisce (ruolo tolto) lascia la prima
  const active = visible.find((tab) => tab.key === selected) ?? visible[0]

  if (!active) return null

  return (
    <Tab.Container
      id="area-tabs"
      activeKey={active.key}
      onSelect={(key) => setSelected(key)}
      mountOnEnter
      unmountOnExit
      transition={false}
    >
      <Nav variant="pills" className="rs-area-tabs">
        {visible.map((tab) => (
          <Nav.Item key={tab.key}>
            <Nav.Link eventKey={tab.key}>{tab.title}</Nav.Link>
          </Nav.Item>
        ))}
      </Nav>
      <Tab.Content className="rs-area-content">
        {visible.map((tab) => (
          <Tab.Pane key={tab.key} eventKey={tab.key}>
            {tab.element}
          </Tab.Pane>
        ))}
      </Tab.Content>
    </Tab.Container>
  )
}
