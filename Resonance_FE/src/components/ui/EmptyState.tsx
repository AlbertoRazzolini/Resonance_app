import type { ReactNode } from 'react'

type EmptyStateProps = {
  title: string
  /** Suggerimento su cosa fare (es. allargare il raggio). */
  hint?: string
  /** Azione facoltativa sotto il testo. */
  children?: ReactNode
}

/** Elenco senza elementi: un titolo chiaro e, se c'è, cosa fare. */
export function EmptyState({ title, hint, children }: EmptyStateProps) {
  return (
    <div className="rs-empty">
      <p className="rs-empty__title">{title}</p>
      {hint && <p className="rs-empty__hint">{hint}</p>}
      {children}
    </div>
  )
}
