import { Container } from 'react-bootstrap'
import { Outlet, useMatch } from 'react-router'
import { NoticeBar } from '@/components/ui/NoticeBar'
import { ROUTES } from '@/app/routes'
import { LiveNotifications } from '@/features/notifications/components/LiveNotifications'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { Footer } from './Footer'
import { NavBar } from './NavBar'
import { SideNav } from './SideNav'
import { TabBar } from './TabBar'

/**
 * Struttura comune a tutte le pagine (decisione 83): sotto 768 px barra in alto, contenuto e tab in basso; da 768
 * px barra in alto, colonna a sinistra e contenuto in una griglia (il CSS decide le aree); da 1200 px il logo passa
 * dalla barra alla colonna. Le classi `rs-*` dicono a index.css dove va il bagliore da palco (decisione 80). Dentro una
 * conversazione (`/chat/:id`) non ci sono né le tab né il footer, che salirebbe sopra la casella di scrittura, e la
 * conversazione prende tutta l'altezza (scelta dello studente, FE-09b).
 */
export function AppShell() {
  const hasSideNav = useMediaQuery('(min-width: 768px)')
  const isDesktop = useMediaQuery('(min-width: 1200px)')
  const inConversation = useMatch(ROUTES.chatConversation) !== null
  const className = ['rs-app', hasSideNav && 'rs-app--side', inConversation && 'rs-app--conversation']
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className}>
      <LiveNotifications />
      <NavBar showLogo={!isDesktop} />
      {hasSideNav && <SideNav showLogo={isDesktop} />}
      <main className="rs-main">
        <Container className="py-4">
          <NoticeBar />
          <Outlet />
        </Container>
      </main>
      {!inConversation && <Footer />}
      {!hasSideNav && !inConversation && <TabBar />}
    </div>
  )
}
