import { Container } from 'react-bootstrap'
import { Outlet } from 'react-router'
import { NavBar } from './NavBar'

/**
 * Struttura comune a tutte le pagine: barra in alto e contenuto della rotta corrente. Le classi `rs-*`
 * dicono a index.css dove va il bagliore da palco nelle tre fasce di schermo (decisione 80).
 */
export function AppShell() {
  return (
    <div className="rs-app">
      <NavBar />
      <main className="rs-main">
        <Container className="py-4">
          <Outlet />
        </Container>
      </main>
    </div>
  )
}
