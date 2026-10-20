// Percorsi dell'app: unico posto dove si scrivono (piano frontend, regole della struttura). In italiano e
// mai inizianti con "api" o "ws", che il backend riserva a API e WebSocket (decisione 74).
export const ROUTES = {
  home: '/',
  events: '/eventi',
  collab: '/collab',
  feed: '/feed',
  chat: '/chat',
  profile: '/profilo',
  profileEdit: '/profilo/modifica',
  /** Modello della rotta; per un collegamento si usa `userPath(id)`. */
  publicUser: '/utenti/:id',
  newConcert: '/concerti/nuovo',
  newIndieEvent: '/indie/nuovo',
  /** Modelli delle rotte dei dettagli; per un collegamento si usano `concertPath(id)` e `indieEventPath(id)`. */
  concert: '/concerti/:id',
  indieEvent: '/indie/:id',
  privacy: '/informativa-privacy',
  cookies: '/informativa-cookie',
  login: '/accesso',
  register: '/registrazione',
  verify: '/verifica',
  forgotPassword: '/password-dimenticata',
  resetPassword: '/password/reset',
} as const

/** Percorso del profilo pubblico di un utente. */
export const userPath = (id: string) => `/utenti/${encodeURIComponent(id)}`

/** Percorso del dettaglio di un concerto ufficiale. */
export const concertPath = (id: string) => `/concerti/${encodeURIComponent(id)}`

/** Percorso del dettaglio di un indie event. */
export const indieEventPath = (id: string) => `/indie/${encodeURIComponent(id)}`
