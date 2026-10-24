import { useRef } from 'react'
import { Link, Navigate } from 'react-router'
import { ROUTES } from '@/app/routes'
import { LegalLinks } from '@/components/layout/Footer'
import { MarkerLegend } from '@/components/map'
import '@/components/map/map.css'
import DesktopMagnet from '@/components/motion/DesktopMagnet'
import StarBorder from '@/components/motion/StarBorder'
import { LANDING_MAGNET_LOOK } from '@/components/motion/magnetLook'
import { STAR_BORDER_LOOK, STAR_BORDER_LOOK_LARGE } from '@/components/motion/starBorderLook'
import { Logo } from '@/components/ui/Logo'
import { useAppSelector } from '@/hooks/redux'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { BackToTop } from '../components/BackToTop'
import { LandingRings } from '../components/LandingRings'
import { RadarMap } from '../components/RadarMap'
import { ScrollArrows } from '../components/ScrollArrows'
import { useScreens } from '../hooks/useScreens'
import { useScrolledPast } from '../hooks/useScrolledPast'

/** I tre ruoli: il nome è il ruolo, la frase dice cosa si fa (testi veri, nessun numero inventato). */
const ROLES = [
  {
    name: 'Fan',
    title: 'Vai ai concerti',
    text: 'Trova chi suona vicino a te, segui i musicisti e scrivi agli amici per andare insieme. Cerca gli altri utenti, manda una richiesta di amicizia e organizzatevi in chat.',
  },
  {
    name: 'Musicista',
    title: 'Fatti trovare',
    text: 'Pubblica annunci per cercare una band o un compagno di palco e racconta cosa fai nel feed. Rispondi agli annunci degli altri con una candidatura: si apre la chat con chi li ha pubblicati.',
  },
  {
    name: 'Host',
    title: 'Organizza le serate',
    text: "Pubblica i tuoi eventi sulla mappa, con data, luogo e contatti, e fatti trovare dal pubblico. Chi vuole saperne di più ti scrive dalla scheda dell'evento e la conversazione si apre in chat.",
  },
]

/** Le quattro funzioni dell'app, nell'ordine delle tab. */
const FEATURES = [
  {
    title: 'Eventi vicini',
    text: 'Concerti e serate indipendenti intorno a te, scegliendo il raggio e guardando la mappa. Ufficiali e indie stanno nella stessa lista, ognuno col suo segnaposto.',
  },
  {
    title: 'Collab',
    text: 'La bacheca degli annunci: cerchi una band o un musicista? Pubblica e rispondi. Chi risponde invia una candidatura e si apre la chat con te.',
  },
  {
    title: 'Feed',
    text: 'Post dei musicisti che segui, con i mi piace per dire la tua. Scorri le novità della scena e metti il mi piace a quello che ti convince.',
  },
  {
    title: 'Chat',
    text: 'Messaggi con i tuoi amici e con chi ti contatta per un evento o una candidatura. Si scrive solo in questi casi: niente messaggi da sconosciuti.',
  },
]

/** I tre passi per cominciare. */
const STEPS = [
  {
    title: "Crea l'account",
    text: 'Email e password, poi un codice che ti arriva per email per confermare.',
  },
  {
    title: 'Scegli i ruoli',
    text: 'Fan, musicista, host: anche più di uno, e li cambi quando vuoi.',
  },
  {
    title: 'Entra in gioco',
    text: 'Guarda gli eventi vicini, rispondi agli annunci, scrivi agli amici.',
  },
]

/** Pulsante con bordo animato e contorno scuro, come «Accedi» nella barra dell'app. */
const OUTLINE_BUTTON = {
  backgroundColor: 'transparent',
  textColor: 'var(--rs-color-text)',
  borderColor: 'var(--rs-color-border-strong)',
} as const

/** Frecce in basso alla schermata, che portano alla successiva. */
function Cue({ onClick }: { onClick: () => void }) {
  return (
    <div className="rs-landing__cue-slot">
      <ScrollArrows onClick={onClick} />
    </div>
  )
}

/**
 * Landing page su «/» per chi non ha la sessione (FE-12): quattro schermate alte quanto lo schermo (presentazione,
 * ruoli, funzioni, tre passi con l'invito finale) e un footer statico. Da tablet in su la pagina scatta da una
 * schermata all'altra e dietro ci sono gli anelli animati (decisione 108). Contenuto statico, solo frontend; chi ha
 * già la sessione va direttamente agli Eventi (decisione 85). Sta fuori da `AppShell`: un anonimo non ha navigazione
 * né menu utente da usare.
 */
export function Component() {
  const status = useAppSelector((state) => state.auth.status)
  const tablet = useMediaQuery('(min-width: 768px)')
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const solid = useScrolledPast(8)
  const burst = useRef<(() => void) | null>(null)
  const { next: scrollNext, top: scrollTop } = useScreens(tablet && !reducedMotion, () =>
    burst.current?.(),
  )

  if (status === 'authenticated') return <Navigate to={ROUTES.events} replace />

  return (
    <div className="rs-app rs-landing">
      <LandingRings burstRef={burst} />

      <header className="rs-landing__bar" data-solid={solid}>
        <Link to={ROUTES.home} className="rs-landing__brand">
          <Logo />
        </Link>
        <div className="d-flex align-items-center gap-2">
          <StarBorder
            {...STAR_BORDER_LOOK}
            {...OUTLINE_BUTTON}
            as={Link}
            to={ROUTES.login}
            className="rs-nav-login"
          >
            Accedi
          </StarBorder>
          <Link to={ROUTES.register} className="btn btn-primary btn-sm">
            Registrati
          </Link>
        </div>
      </header>

      <main className="rs-landing__main">
        <section className="rs-landing__screen rs-landing__hero" data-screen>
          <div className="rs-landing__intro">
            <p className="rs-landing__eyebrow">Musica dal vivo e scena indie</p>
            <h1 className="rs-landing__title">
              <span>
                Trova la tua <em>scena</em>
              </span>{' '}
              <span>dal vivo</span>
            </h1>
            <p className="rs-landing__lead">
              Scopri i concerti vicino a te, cerca musicisti per la tua band, segui chi suona e
              scrivi agli amici. Tutto in un posto solo, gratis.
            </p>
            <div className="rs-landing__cta">
              <DesktopMagnet look={LANDING_MAGNET_LOOK}>
                <Link to={ROUTES.register} className="btn btn-primary btn-lg">
                  Crea il tuo account
                </Link>
              </DesktopMagnet>
              <StarBorder
                {...STAR_BORDER_LOOK_LARGE}
                {...OUTLINE_BUTTON}
                as={Link}
                to={ROUTES.events}
                className="rs-landing__outline"
              >
                Guarda gli eventi vicini
              </StarBorder>
            </div>
            <p className="rs-landing__hint">
              Hai già un account? <Link to={ROUTES.login}>Accedi</Link>
            </p>
          </div>
          <div className="rs-landing__showcase">
            <div className="rs-landing__map">
              <RadarMap />
              <MarkerLegend />
            </div>
            <aside className="rs-landing__tagline">
              <strong>Concerti sotto casa</strong>
              <span>Scegli il raggio e guarda sulla mappa cosa succede intorno a te.</span>
            </aside>
          </div>
          <Cue onClick={scrollNext} />
        </section>

        <section className="rs-landing__screen" data-screen>
          <h2>Fan, musicista o host</h2>
          <p className="rs-landing__sub">
            Un solo account. Scegli i ruoli che ti servono e li puoi cambiare dal profilo.
          </p>
          <div className="rs-landing__roles">
            {ROLES.map((role) => (
              <article key={role.name} className="rs-landing__role">
                <h3>{role.name}</h3>
                <p className="rs-landing__role-title">{role.title}</p>
                <p>{role.text}</p>
              </article>
            ))}
          </div>
          <Cue onClick={scrollNext} />
        </section>

        <section className="rs-landing__screen" data-screen>
          <h2>Quattro cose, una app</h2>
          <p className="rs-landing__sub">
            Niente di più: le funzioni che servono per vivere la musica dal vivo.
          </p>
          <div className="rs-landing__setlist">
            {FEATURES.map((feature) => (
              <article key={feature.title} className="rs-landing__setrow">
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
          <Cue onClick={scrollNext} />
        </section>

        <section className="rs-landing__screen rs-landing__final" data-screen>
          <h2>Tre passi</h2>
          <p className="rs-landing__sub">Ci vuole un minuto.</p>
          <ol className="rs-landing__steps">
            {STEPS.map((step) => (
              <li key={step.title}>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
          <div className="rs-landing__closing">
            <h2>
              Sali sul <span>palco</span>
            </h2>
            <div className="rs-landing__cta rs-landing__cta--center">
              <DesktopMagnet look={LANDING_MAGNET_LOOK}>
                <Link to={ROUTES.register} className="btn btn-primary btn-lg">
                  Registrati
                </Link>
              </DesktopMagnet>
              <StarBorder
                {...STAR_BORDER_LOOK_LARGE}
                {...OUTLINE_BUTTON}
                as={Link}
                to={ROUTES.login}
                className="rs-landing__outline"
              >
                Accedi
              </StarBorder>
            </div>
          </div>
        </section>
      </main>

      <BackToTop onClick={scrollTop} />

      <footer className="rs-landing__footer">
        <LegalLinks />
      </footer>
    </div>
  )
}
