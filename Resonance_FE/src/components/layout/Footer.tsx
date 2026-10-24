import { Link } from 'react-router'
import { ROUTES } from '@/app/routes'
import { useScrolledToBottom } from '@/hooks/useScrolledToBottom'

/**
 * Le quattro pagine legali: privacy, cookie, copyright e termini di servizio. Le usano il footer a comparsa dell'app e
 * quello statico della landing.
 */
export function LegalLinks() {
  return (
    <nav aria-label="Informazioni legali" className="rs-footer__list">
      <Link to={ROUTES.privacy}>Informativa privacy</Link>
      <Link to={ROUTES.cookies}>Informativa cookie</Link>
      <Link to={ROUTES.copyright}>Copyright</Link>
      <Link to={ROUTES.terms}>Termini di servizio</Link>
    </nav>
  )
}

/**
 * Footer a comparsa (decisione 83): sale dal basso, da dietro le tab sul telefono, quando la pagina è scrollata in
 * fondo (o subito se non scorre) e scende risalendo. Nascosto è `inert`: non si raggiunge con la tastiera.
 */
export function Footer() {
  const visible = useScrolledToBottom()

  return (
    <footer className="rs-footer" data-visible={visible} inert={!visible}>
      <LegalLinks />
    </footer>
  )
}
