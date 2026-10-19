import { Container, Nav, Navbar } from 'react-bootstrap'
import { Link, NavLink } from 'react-router'
import { ROUTES } from '@/app/routes'
import { Logo } from '@/components/ui/Logo'
import { UserMenu } from './UserMenu'

/**
 * Barra di navigazione: sotto `md` il menu si apre e si chiude con il pulsante (react-bootstrap). Il menu utente sta
 * sempre in vista, a destra; la navigazione a tab del prototipo arriva con la card "Navigazione e footer" (decisione 83).
 */
export function NavBar() {
  return (
    <Navbar expand="md" className="rs-nav">
      <Container>
        <Navbar.Brand as={Link} to={ROUTES.home}>
          <Logo />
        </Navbar.Brand>
        {/* Sotto md prima del pulsante del menu, da md in poi in fondo a destra (order-md-last) */}
        <div className="order-md-last ms-auto me-2 me-md-0">
          <UserMenu />
        </div>
        <Navbar.Toggle aria-controls="main-nav" label="Apri il menu" />
        <Navbar.Collapse id="main-nav">
          <Nav className="me-auto">
            <Nav.Link as={NavLink} to={ROUTES.home} end>
              Home
            </Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  )
}
