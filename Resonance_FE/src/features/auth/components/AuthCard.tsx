import type { ReactNode } from 'react'

/** Scheda delle pagine di accesso (decisione 83): striscia gialla in alto, titolo con il punto giallo e, a destra, un collegamento. */
export function AuthCard({
  title,
  aside,
  children,
}: {
  title: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rs-auth-card">
      <header className="rs-auth-card__head">
        <h1 className="rs-auth-card__title">
          {title}
          <span className="rs-auth-card__dot" aria-hidden="true" />
        </h1>
        {aside && <p className="rs-auth-card__aside">{aside}</p>}
      </header>
      {children}
    </section>
  )
}
