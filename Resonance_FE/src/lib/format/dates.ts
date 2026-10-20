const SHORT_DATE = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** Data breve in italiano e in ora locale del browser (es. "30 ott 2026") da un istante ISO-8601. */
export function formatDate(iso: string): string {
  return SHORT_DATE.format(new Date(iso))
}
