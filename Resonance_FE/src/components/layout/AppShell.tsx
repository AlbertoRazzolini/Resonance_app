import { Container } from 'react-bootstrap'
import { Outlet } from 'react-router'
import { ConfirmationBar } from '@/components/ui/ConfirmationBar'
import { NoticeBar } from '@/components/ui/NoticeBar'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { Footer } from './Footer'
import { NavBar } from './NavBar'
import { SideNav } from './SideNav'
import { TabBar } from './TabBar'

/**
 * Struttura comune a tutte le pagine (decisione 83): sotto 768 px barra in alto, contenuto e tab in basso; da 768
 * px barra in alto, colonna a sinistra e contenuto in una griglia (il CSS decide le aree); da 1200 px il logo passa
 * dalla barra alla colonna. Le classi `rs-*` dicono a index.css dove va il bagliore da palco (decisione 80).
 */
export function AppShell() {
  const hasSideNav = useMediaQuery('(min-width: 768px)')
  const isDesktop = useMediaQuery('(min-width: 1200px)')

  return (
    <div className={hasSideNav ? 'rs-app rs-app--side' : 'rs-app'}>
      <NavBar showLogo={!isDesktop} />
      {hasSideNav && <SideNav showLogo={isDesktop} />}
      <main className="rs-main">
        <Container className="py-4">
          <NoticeBar />
          <ConfirmationBar />
          <Outlet />
        </Container>
      </main>
      <Footer />
      {!hasSideNav && <TabBar />}
    </div>
  )
}
