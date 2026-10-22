// Percorsi dell'app: unico posto dove si scrivono (piano frontend, regole della struttura). In italiano e
// mai inizianti con "api" o "ws", che il backend riserva a API e WebSocket (decisione 74).
export const ROUTES = {
  home: '/',
  events: '/eventi',
  collab: '/collab',
  feed: '/feed',
  chat: '/chat',
  /** Modello della rotta di Messaggi: con o senza conversazione aperta; per un collegamento si usa `chatPath(id)`. */
  chatPage: '/chat/:id?',
  /** Modello di una conversazione aperta (con `:id`): serve a chi deve sapere se se ne sta guardando una. */
  chatConversation: '/chat/:id',
  friends: '/amici',
  userSearch: '/amici/cerca',
  profile: '/profilo',
  profileEdit: '/profilo/modifica',
  /** Modello della rotta; per un collegamento si usa `userPath(id)`. */
  publicUser: '/utenti/:id',
  newConcert: '/concerti/nuovo',
  newIndieEvent: '/indie/nuovo',
  newCollab: '/collab/nuovo',
  /** Modelli delle rotte dei dettagli; per un collegamento si usano `concertPath(id)` e `indieEventPath(id)`. */
  concert: '/concerti/:id',
  indieEvent: '/indie/:id',
  /** Modello della rotta del dettaglio di un annuncio; per un collegamento si usa `collabPath(id)`. */
  collabPost: '/collab/:id',
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

/** Percorso del dettaglio di un annuncio collab. */
export const collabPath = (id: string) => `/collab/${encodeURIComponent(id)}`

/** Percorso dell'elenco degli amici: la scheda sta nell'indirizzo, così la campanella apre «Ricevute» (decisione 78). */
export const friendsPath = (tab?: 'ricevute' | 'inviate') => (tab ? `/amici?scheda=${tab}` : '/amici')

/** Percorso di una conversazione aperta (`ROUTES.chatPage` con l'id), per i collegamenti da candidature, contatti e notifiche. */
export const chatPath = (conversationId: string) => `/chat/${encodeURIComponent(conversationId)}`
