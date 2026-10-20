const SHORT_DATE = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** Data breve in italiano e in ora locale del browser (es. "30 ott 2026") da un istante ISO-8601. */
export function formatDate(iso: string): string {
  return SHORT_DATE.format(new Date(iso))
}

const EVENT_DAY = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
const EVENT_DAY_LONG = new Intl.DateTimeFormat('it-IT', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const EVENT_TIME = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' })

/** Data di un evento nelle card, in ora locale del browser (es. "ven 23 ott · 21:30") da un istante ISO-8601. */
export function formatEventDate(iso: string): string {
  const date = new Date(iso)
  return `${EVENT_DAY.format(date)} · ${EVENT_TIME.format(date)}`
}

/** Data di un evento nel dettaglio, con mese e anno per esteso (es. "venerdì 23 ottobre 2026 · 21:30"). */
export function formatEventDateLong(iso: string): string {
  const date = new Date(iso)
  return `${EVENT_DAY_LONG.format(date)} · ${EVENT_TIME.format(date)}`
}
