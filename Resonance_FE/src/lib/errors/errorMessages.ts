/**
 * Testo italiano per ogni `ErrorResponse.code` della tabella di progettazione, sezione 6.2 (TOKEN_INVALID solo
 * WebSocket). Il frontend decide sempre sul codice, mai sul `message` del backend (sezione 6.1): un codice
 * nuovo del backend ripiega sul suo messaggio finché non se ne aggiunge uno qui.
 */
export const ERROR_MESSAGES: Record<string, string> = {
  // Generali
  VALIDATION_ERROR: 'Dati non validi: controlla i campi evidenziati e riprova.',
  UNAUTHENTICATED: 'Sessione scaduta: accedi di nuovo per continuare.',
  ACCESS_DENIED: 'Non hai i permessi per fare questa operazione.',
  NOT_FOUND: 'Quello che cerchi non esiste o non è più disponibile.',
  METHOD_NOT_ALLOWED: 'Operazione non supportata.',
  UNSUPPORTED_MEDIA_TYPE: 'Formato della richiesta non supportato.',
  CONFLICT:
    'Operazione non possibile: i dati sono cambiati nel frattempo. Ricarica la pagina e riprova.',
  TOO_MANY_REQUESTS: 'Troppi tentativi: attendi un momento e riprova.',
  INTERNAL_ERROR: 'Si è verificato un problema imprevisto. Riprova tra poco.',

  // Registrazione, verifica, login
  EMAIL_ALREADY_REGISTERED: 'Esiste già un account con questa email.',
  // Errore del campo nome: lo scrive il form sotto il campo (getFieldErrors) e ErrorAlert non lo ripete
  DISPLAY_NAME_TAKEN: 'Nome già utilizzato.',
  ALREADY_VERIFIED: 'Questo account è già verificato: puoi accedere.',
  CODE_INVALID: "Il codice non è corretto. Controlla l'email e riprova.",
  CODE_EXPIRED: 'Il codice è scaduto o hai esaurito i tentativi. Richiedine uno nuovo.',
  // Generico di proposito (come INVALID_CREDENTIALS): non indica quale campo è sbagliato; dice cosa fare se la
  // password è dimenticata, perché "password dimenticata" non funziona per un account non ancora verificato
  WRONG_PASSWORD:
    'I dati inseriti non sono corretti: controlla il codice e la password. Se non ricordi la password, registrati di nuovo con la stessa email.',
  INVALID_CREDENTIALS: 'Email o password non corrette.',
  EMAIL_NOT_VERIFIED: 'Email non ancora verificata: inserisci il codice che ti abbiamo inviato.',
  ACCOUNT_SUSPENDED: 'Il tuo account è sospeso.',

  // Sessione
  CSRF_HEADER_MISSING: 'Richiesta non valida: ricarica la pagina e riprova.',
  REFRESH_TOKEN_INVALID: 'Sessione non valida: accedi di nuovo.',
  REFRESH_TOKEN_EXPIRED: 'Sessione scaduta: accedi di nuovo.',
  REFRESH_TOKEN_REUSED: 'Sessione non più valida: accedi di nuovo.',
  REFRESH_CONFLICT: 'Rinnovo della sessione in corso: riprova tra un istante.',
  TOKEN_INVALID: 'Connessione scaduta: accedi di nuovo.',

  // Amministrazione
  INSUFFICIENT_PLATFORM_LEVEL:
    'Puoi agire solo su account con un ruolo inferiore al tuo, e mai sul tuo.',
  LAST_SUPERADMIN: "È l'ultimo superadmin attivo: la piattaforma resterebbe senza amministratori.",
  USER_NOT_VERIFIED: "L'utente non ha ancora verificato l'email.",
  USER_NOT_ACTIVE: "L'utente non è attivo.",
  CONTENT_ALREADY_HIDDEN: 'Il contenuto è già nascosto.',
  CONTENT_NOT_HIDDEN: 'Il contenuto non è nascosto.',
  RESTORE_NOT_ALLOWED: 'Questo contenuto non si può ripristinare.',

  // Contenuti
  NOT_OWNER: "Solo chi l'ha creato può farlo.",
  ADDRESS_NOT_FOUND: 'Indirizzo non trovato: controllalo e riprova.',
  GEOCODING_UNAVAILABLE: 'Il servizio degli indirizzi non risponde: riprova tra poco.',
  EVENT_ALREADY_PUBLISHED: "L'evento è già pubblicato.",
  EVENT_DATE_PAST: "La data dell'evento è passata: scegline una futura.",
  EVENT_CLOSED: "L'evento è già iniziato: non si può più contattare l'organizzatore.",
  CANNOT_CONTACT_OWN_EVENT: "Non puoi contattare l'organizzatore del tuo stesso evento.",
  COLLAB_CLOSED: "L'annuncio è chiuso e non accetta più candidature.",
  COLLAB_ALREADY_APPLIED: 'Ti sei già candidato a questo annuncio.',
  CANNOT_APPLY_OWN_POST: 'Non puoi candidarti al tuo stesso annuncio.',

  // Amicizie e chat
  CANNOT_FRIEND_SELF: "Non puoi chiedere l'amicizia a te stesso.",
  FRIEND_REQUEST_ALREADY_SENT:
    'Hai già inviato una richiesta a questa persona: attendi la risposta.',
  FRIEND_REQUEST_ALREADY_RECEIVED:
    'Questa persona ti ha già inviato una richiesta: accettala dalle richieste ricevute.',
  ALREADY_FRIENDS: 'Siete già amici.',
  FRIENDSHIP_UNAVAILABLE: "Non puoi inviare la richiesta: l'altra persona ha rimosso l'amicizia.",
  FRIEND_REQUEST_NOT_PENDING: 'La richiesta non è più in attesa.',
  NOT_FRIENDSHIP_ADDRESSEE: 'Solo chi ha ricevuto la richiesta può rispondere.',
  NOT_FRIENDSHIP_REQUESTER: 'Solo chi ha inviato la richiesta può annullarla.',
  NOT_FRIENDS: "Non c'è un'amicizia accettata con questa persona.",
  CANNOT_MESSAGE_SELF: 'Non puoi scrivere a te stesso.',
  NOT_CONVERSATION_MEMBER: 'Questa conversazione non ti appartiene.',
  CHAT_LOCKED:
    "Per scrivere servono un'amicizia o uno sblocco aperto da una candidatura o dal contatto di un evento.",
}

/** Testo per le richieste che non hanno raggiunto il backend (rete assente, backend spento, proxy, riavvio di Render). */
export const NETWORK_ERROR_MESSAGE = 'Server non raggiungibile: controlla la connessione e riprova.'

/** Testo quando il server non risponde in tempo. */
export const TIMEOUT_ERROR_MESSAGE = 'Il server non ha risposto in tempo: riprova.'
