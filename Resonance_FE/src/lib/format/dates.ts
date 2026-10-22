const SHORT_DATE = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/** Data breve tutta in numeri e in ora locale del browser (es. "30/10/2026", "05/11/2026") da un istante ISO-8601. */
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

const CHAT_WEEKDAY = new Intl.DateTimeFormat('it-IT', { weekday: 'short' })
const CHAT_DAY_MONTH = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' })
const CHAT_DAY_MONTH_YEAR = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
const CHAT_DAY_LONG = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
const CHAT_DAY_LONG_YEAR = new Intl.DateTimeFormat('it-IT', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const DAY_MS = 86_400_000

/** Mezzanotte del giorno di una data: serve a contare i giorni di calendario, non le ventiquattro ore. */
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

/** Giorni di calendario fra l'istante e `now`: 0 oggi, 1 ieri. */
const daysAgo = (date: Date, now: Date) => Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS)

/** Ora e minuti con due cifre (es. "08:05"), in ora locale del browser. */
export function formatClock(iso: string): string {
  return EVENT_TIME.format(new Date(iso))
}

/** Vero se i due istanti cadono nello stesso giorno di calendario locale. */
export function isSameDay(a: string, b: string): boolean {
  return startOfDay(new Date(a)) === startOfDay(new Date(b))
}

/**
 * Orario nell'elenco delle conversazioni: l'ora se è oggi, «Ieri», il giorno della settimana negli ultimi sei giorni,
 * poi giorno e mese (con l'anno se non è quello corrente). `now` si passa solo nei test.
 */
export function formatChatListTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  const days = daysAgo(date, now)
  if (days <= 0) return EVENT_TIME.format(date)
  if (days === 1) return 'Ieri'
  if (days < 7) return CHAT_WEEKDAY.format(date)
  return (date.getFullYear() === now.getFullYear() ? CHAT_DAY_MONTH : CHAT_DAY_MONTH_YEAR).format(date)
}

/**
 * Separatore di giorno nella conversazione: «Oggi», «Ieri» o il giorno per esteso (con l'anno se non è quello
 * corrente). `now` si passa solo nei test.
 */
export function formatChatDay(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  const days = daysAgo(date, now)
  if (days <= 0) return 'Oggi'
  if (days === 1) return 'Ieri'
  return (date.getFullYear() === now.getFullYear() ? CHAT_DAY_LONG : CHAT_DAY_LONG_YEAR).format(date)
}
