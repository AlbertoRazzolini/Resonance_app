import { Container, Nav, Navbar } from 'react-bootstrap'
import { Link, NavLink } from 'react-router'
import { ROUTES } from '@/app/routes'

/** Barra di navigazione: sotto `md` il menu si apre e si chiude con il pulsante (react-bootstrap). */
export function NavBar() {
  return (
    <Navbar expand="md" className="rs-nav">
      <Container>
        <Navbar.Brand as={Link} to={ROUTES.home}>
          Resonance
        </Navbar.Brand>
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
