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
