// Percorsi dell'app: unico posto dove si scrivono (piano frontend, regole della struttura). In italiano e
// mai inizianti con "api" o "ws", che il backend riserva a API e WebSocket (decisione 74).
export const ROUTES = {
  home: '/',
  events: '/eventi',
  collab: '/collab',
  feed: '/feed',
  chat: '/chat',
  profile: '/profilo',
  privacy: '/informativa-privacy',
  cookies: '/informativa-cookie',
  login: '/accesso',
  register: '/registrazione',
  verify: '/verifica',
  forgotPassword: '/password-dimenticata',
  resetPassword: '/password/reset',
} as const
