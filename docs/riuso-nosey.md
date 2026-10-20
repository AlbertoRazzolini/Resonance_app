# Resonance - Mappa del riuso di NoseY

Per ogni classe o pattern di NoseY: dove finisce in Resonance, con quale nome e in quale card.
Nelle sessioni di sviluppo si consulta questa mappa e si leggono da NoseY **solo** i file necessari
alla card corrente, senza rileggere l'intero progetto.

- Sorgente NoseY (esterno al repository, non si modifica):
  `C:\Users\VGit\OneDrive\Desktop\Appunti e coding\UPLOADxGIT\Back-end\BW5\NoseY`
- Percorsi NoseY qui sotto relativi a `be/src/main/java/it/epicode/nosey/` salvo diversa indicazione.
- Package Resonance relativi a `it.epicode.resonance`.
- Categorie: **R** = riuso quasi com'è (traduzione dei nomi in inglese) · **A** = da adattare.
- Versioni verificate: Spring Boot 4.1.1 e Java 25 in entrambi i progetti; jjwt 0.13.0; Jackson 3
  (`tools.jackson`).

## Configurazione e infrastruttura

| NoseY | Resonance | Cat. | Card | Note |
|---|---|---|---|---|
| `be/pom.xml` | `Resonance_BE/pom.xml` | A | F0-01 | Stesse versioni. Senza `hibernate-maven-plugin`, Actuator e dipendenze AI. springdoc aggiunto in F6-02. |
| `be/src/main/resources/application.yml` | `application.yml` + `-dev`, `-prod`, `-test` | A | F0-01 | Tenere `server.port: ${PORT:8080}`, `ddl-auto: validate`, `open-in-view: false`, `time_zone: UTC`, esclusione `UserDetailsServiceAutoConfiguration`, `log-resolved-exception: false`. Togliere multipart, Gemini, SMTP Gmail. Porta dev 5433. |
| `NoseyApplication` | `ResonanceApplication` | R | F0-01 | Chiama `DatabaseUrl.applyIfPresent()` prima di Spring. |
| `config/DatabaseUrl` | `config.DatabaseUrl` (`applyIfPresent`) | R | F0-02 | Mai la password nel log. |
| `common/ClockConfig` | `config.ClockConfig` | R | F0-01 | |
| `config/AsyncConfig` | `config.AsyncConfig` | R | F0-01 | |
| `config/SchedulingConfig` | `config.SchedulingConfig` | R | F0-01 | |
| `config/CorsConfig` | `config.CorsConfig` | A | F1-01 | `allowCredentials(true)`, header espliciti; origini solo in dev. |
| `config/SecurityConfig` | `config.SecurityConfig` | A | F1-01 | Stateless, niente httpBasic/formLogin, endpoint pubblici espliciti, `/ws/**` e `/error` permessi, EntryPoint/AccessDenied con `ErrorResponse`. `RoleHierarchy` solo `SUPERADMIN > ADMIN`. Regola `GET` statici in F6-03. |
| `config/WebSocketConfig` | `config.WebSocketConfig` | R | F5-01 | `/ws` senza SockJS, broker `/queue`, prefissi `/app` e `/user`; aggiungere decorator per il registro sessioni. |
| `web/StatoController` | `web.HealthController` (`GET /api/health`) | A | F0-02 | Risposta `{status, database}`, 503 se il DB non risponde. |
| `be/Dockerfile` | `Resonance_BE/Dockerfile` | A | F0-03 | Stage JDK/JRE invariati, `MaxRAMPercentage=60` (era 75) e utente non root aggiunto; contesto di build alla radice; stage Node (`node:24-alpine`) aggiunto in FE-01, che copia `dist/` in `static/` prima del `package`. |
| `be/.dockerignore` | `.dockerignore` (radice) | A | F0-03 | Aggiungere `docs`, `postman`, `**/node_modules`, `**/dist`. |
| `render.yaml` (radice) | `render.yaml` (radice) | A | F0-03 | Database + un solo servizio web; `dockerContext: .`; via `GEMINI_API_KEY`, `JWT_DURATA`, `ALLOWED_ORIGIN`; aggiunti `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL`, `SUPERADMIN_*`, `GEOCODING_CONTACT`; tenere i commenti su JWT_SECRET, profilo prod e Brevo. |

## Errori, paginazione, validazione, limiti

| NoseY | Resonance | Cat. | Card | Note |
|---|---|---|---|---|
| `common/ApplicazioneException` | `common.AppException` | R | F0-03 | Aggiungere `details` (mappa) per `ACCOUNT_SUSPENDED`. |
| `common/CodiceErrore` | `common.ErrorCode` | A | F0-03 | Catalogo di Resonance (progettazione, sezione 6.2); codici aggiunti card per card. |
| `common/ErroreResponse` | `common.ErrorResponse` | A | F0-03 | Campi `status, code, error, message, fields, details, timestamp`. |
| `common/GestoreErrori` | `common.GlobalExceptionHandler` | R | F0-03 | Tenere la lettura del nome del vincolo da `PSQLException`; togliere i casi multipart. |
| `common/GestoreErroriStomp` | `common.StompErrorHandler` | R | F5-01 | |
| `common/GestoreErroriWebSocket` | `common.WebSocketExceptionHandler` | R | F5-01 | |
| `common/ErroreWebSocket` | `common.WsError` | R | F5-01 | |
| `common/PaginaResponse` | `common.PageResponse` | R | F0-03 | Campi `content, page, size, totalElements, totalPages`. |
| `common/NonVuoto` | `common.NotBlankIfPresent` | R | F0-03 | Usato dal `PATCH` del profilo. |
| `common/Limite`, `common/LimitiService` | `common.RateLimit`, `common.RateLimitService` | R | F0-03 | Limiti: `LOGIN_FAILED`, `CHAT_MESSAGES`, `CONVERSATIONS_CREATED`, `COLLAB_APPLICATIONS`; dalla decisione 59 anche `FRIEND_REQUESTS` (F4-04), `USER_SEARCH` (F4-05), `EVENT_CONTACTS` (F5-04). |
| `common/Haversine` | `geo.Haversine` | R | F3-01 | Oracolo dei test della query SQL. |

## Autenticazione

| NoseY | Resonance | Cat. | Card | Note |
|---|---|---|---|---|
| `auth/TokenService` | `auth.AccessTokenService` | A | F1-01 | Solo `sub`, `iat`, `exp` (15 min); niente `jti`, ruolo e tabella. Tenere HS256 fisso e segreto senza default. |
| — (nuovo) | `auth.RefreshTokenService`, `auth.RefreshToken`, `auth.RefreshCookieFactory` | nuovo | F1-02 | Progettazione, sezioni 4.2, 4.3, 4.8, 4.9. Pulizia programmata ripresa da `TokenService.cancellaScaduti`. |
| `auth/JwtFilter` | `auth.JwtFilter` | A | F1-01 | Comportamento "prosegue senza autenticare" invariato; ruoli e stato da `UserAccessService`. Non è un `@Component`. |
| `auth/UtenteAutenticato` | `auth.AuthenticatedUser` | A | F1-01 | `id`, `roles`, `accessTokenExpiresAt`. |
| `auth/AuthService` | `auth.AuthService` + `auth.EmailCodeService` | A | F1-02, F1-03, F1-04 | Ordine dei controlli di login, verifica e reset invariato; codici spostati in `email_codes`; token a due livelli. |
| `auth/AuthController` | `auth.AuthController` | A | F1-02, F1-03, F1-04 | Logout = `DELETE /api/auth/refresh`. |
| `auth/PasswordMax72Byte`, `auth/PasswordMax72ByteValidator` | `auth.PasswordMax72Bytes` + validatore | R | F1-03 | |
| `auth/RegisterRequest`, `VerifyRequest`, `LoginRequest`, `EmailRequest`, `ReimpostaPasswordRequest` | DTO in `auth` | A | F1-02, F1-03, F1-04 | Registrazione: `email, password, displayName`. Normalizzazione nel costruttore del record. |
| `user/ScopoCodice` | `auth.EmailCodePurpose` | A | F1-03 | `EMAIL_VERIFICATION`, `PASSWORD_RESET`. |
| `user/UtenteRepository.consumaTentativoCodice` | `auth.EmailCodeRepository` | A | F1-03 | Stesso `UPDATE` atomico, sulla tabella `email_codes`. |
| `auth/JwtChannelInterceptor` | `auth.JwtChannelInterceptor` | A | F5-01 | Regole SEND/SUBSCRIBE invariate; CONNECT con `UserAccessService`. |
| — (nuovo) | `auth.SuperadminBootstrap` | nuovo | F1-04 | Progettazione, sezione 4.12. |

## Utenti e amministrazione

| NoseY | Resonance | Cat. | Card | Note |
|---|---|---|---|---|
| `user/Utente` | `user.User` | A | F0-02 | Campi del brief + sospensione; niente immagini in bytea. |
| `user/Ruolo` | `user.Role` (enum) + `user.UserRole` | A | F0-02 | Ruoli multipli in `user_roles`. |
| `user/StatoUtente` | `user.UserStatus` | A | F0-02 | Solo `ACTIVE`, `SUSPENDED`. |
| `user/AdminUtenteService` | `admin.AdminUserService` | A | F2-02 | Elenco con filtri e `escapeLike` invariati; sospensione estesa (progettazione, sezione 5.5). |
| `user/AdminUtenteService.verificaRuoloInferiore` | `user.PlatformLevelPolicy` | A | F2-02 | Livelli calcolati dai ruoli di piattaforma. |
| `user/AdminUtenteController` | `admin.AdminUserController`, `admin.SuperadminController` | A | F2-02 | Endpoint di Resonance (progettazione, sezione 6.10). |
| `user/CambiaStatoUtenteRequest` | `admin.SuspendUserRequest` | A | F2-02 | `reason`, `suspendedUntil?`, `durationDays?`. |
| `user/CambiaRuoloRequest` | — | non portato | — | Sostituito da endpoint dedicati di nomina/revoca ADMIN. |
| `user/AdminUtenteService` (`escapeLike`) | `friendship.UserSearchService` | A | F4-05 | Stesso escape di `%`, `_` e `\` già portato nell'elenco admin, ora in `common.LikePattern` (decisione 64); ricerca solo su `displayName`. |

## Amicizie (decisione 59)

| NoseY | Resonance | Cat. | Card | Note |
|---|---|---|---|---|
| `friendship/AmiciziaService` | `friendship.FriendshipService` | A | F4-04 | Si tengono: stati persistenti, lock della coppia (`findConLockByCoppia`), `saveAndFlush` per le richieste incrociate, riapertura della riga, rifiuto silenzioso (`richiestaMascherata` → `request_masked`), regole di `statoVisto`. Si tolgono: evento e ticket come prerequisito, chat creata all'accettazione, notifiche persistenti e il loro segnare lette. `RITIRATA` → `CANCELLED`, `RIMOSSA` → `REMOVED`. |
| `friendship/Amicizia`, `StatoAmicizia` | `friendship.Friendship`, `FriendshipStatus` | A | F4-04 | Senza `evento`; costruttore con i campi obbligatori (decisione 41). |
| `friendship/StatoAmiciziaVista`, `RelazioneAmicizia` | `friendship.FriendshipView`, `FriendshipRelation` | A | F4-04 | `NONE`, `OUTGOING`, `INCOMING`, `FRIENDS`, `UNAVAILABLE`; senza `chatId`. |
| `friendship/AmiciziaRepository` | `friendship.FriendshipRepository` | A | F4-04 | Coppia canonica con `LEAST`/`GREATEST` invece dell'ordine nelle colonne. |
| `friendship/AmiciziaController` | `friendship.FriendshipController` | A | F4-04 | Endpoint della progettazione, sezione 6.14. |
| `be/src/test/.../friendship/AmiciziaServiceTest` | casi di `FriendshipIntegrationTest` | A | F4-04 | Solo come elenco dei casi da coprire. |

## Real-time e notifiche

| NoseY | Resonance | Cat. | Card | Note |
|---|---|---|---|---|
| `chat/ChatWebSocketController` | `chat.ChatWebSocketController` | A | F5-02 | Ordine dei controlli token → limite → body nel service; nessuna risposta diretta. |
| `chat/ChatService.invia` | `chat.ChatService.send` | A | F5-02 | Controllo token = scadenza + stato dal DB; al posto dell'amicizia obbligatoria di NoseY, il permesso di scrittura (amici o sblocco aperto, decisione 59). |
| `chat/MessaggioRepository.trovaPiuRecenti`, `trovaPrimaDi` | `chat.ChatMessageRepository` | R | F5-02 | Cursore su `(sent_at, id)`. |
| `chat/MessaggiResponse` | `chat.MessagePageResponse` (`messages`, `hasMore`) | R | F5-02 | |
| `chat/MessaggioLiveEvent`, `MessaggioLiveListener` | `chat.ChatMessageEvent`, `chat.ChatMessageListener` | R | F5-02 | |
| `notification/NotificaLiveEvent`, `NotificaLiveListener` | `notification.LiveNotificationEvent`, `notification.LiveNotificationListener` | R | F5-03 | `@TransactionalEventListener(AFTER_COMMIT)` + `convertAndSendToUser`. |
| — (nuovo) | `websocket.WebSocketSessionRegistry`, `websocket.UserSuspendedSessionCloser` | nuovo | F5-01 | Progettazione, sezione 7.8. |
| `be/src/test/.../chat/ChatWebSocketTest` | modello dei test STOMP | A | F5-01, F5-02 | `WebSocketStompClient` su porta casuale. |

## Email

| NoseY | Resonance | Cat. | Card | Note |
|---|---|---|---|---|
| `mail/EmailService` | `mail.EmailService` | A | F1-03 | Tre email: codice di verifica, codice di reset, password cambiata. |
| `mail/EmailHtmlService` | `mail.HtmlEmailService` | R | F1-03 | Mittente "Resonance". |
| `mail/LogEmailService` | `mail.LogEmailService` (`@Profile("!prod")`) | R | F1-03 | |
| `mail/BrevoEmailService` | `mail.BrevoEmailService` (`@Profile("prod")`) | R | F1-03 | Timeout 5 s; mai il corpo nel log. |
| `mail/EmailEventListener` | `mail.EmailEventListener` | R | F1-03 | `@Async` + `AFTER_COMMIT`. |
| `mail/CodiceVerificaEmailEvent`, `CodiceResetEmailEvent`, `PasswordCambiataEmailEvent` | `VerificationCodeEmailEvent`, `PasswordResetCodeEmailEvent`, `PasswordChangedEmailEvent` | R | F1-03, F1-04 | |
| `be/src/main/resources/templates/mail/codice-verifica.html`, `codice-reset.html`, `password-cambiata.html` | `templates/mail/verification-code.html`, `password-reset-code.html`, `password-changed.html` | A | F1-03, F1-04 | Testi in italiano adattati a Resonance. |

## Frontend

Percorsi NoseY relativi a `fe/`; percorsi Resonance relativi a `Resonance_FE/`. Si copia e si adatta la
logica con i nomi in inglese; gli stili di NoseY (Tailwind) non si portano mai: in Resonance si usano
Bootstrap e le custom properties `--rs-*` (decisione 78).

| NoseY | Resonance | Cat. | Card | Note |
|---|---|---|---|---|
| `vite.config.ts` | `vite.config.ts` | A | FE-01 | Si tiene il proxy `/api` e `/ws` (`ws: true`) verso la 8080, esteso anche a `vite preview`, con la CSP della decisione 76 in `preview.headers`. Si toglie Tailwind e il plugin che rimuoveva il service worker di MSW. |
| `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` | `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` | A | FE-01 | Alias `@/`; aggiunti `strict` e i tipi di Vitest e jest-dom. |
| struttura di `src/` (`App.tsx`, `router.tsx`, `main.tsx`) | `src/app/`, `src/components/layout/` | A | FE-01 | Cartelle "a forma fissa" (decisione 78); store in `app/store.ts`; rotte in `app/routes.ts`; pagine caricate in modo differito. |
| `hooks/redux.ts` | `hooks/redux.ts` | R | FE-01 | `useAppDispatch` e `useAppSelector` tipizzati sullo store. |
| `hooks/useMediaQuery.ts` | `hooks/useMediaQuery.ts` | R | FE-01 | Nomi in inglese. |
| `store/apiSlice.ts` | `lib/api/apiSlice.ts`, `lib/api/baseQuery.ts`, `lib/api/tags.ts` | A | FE-02 | Si tiene lo schema (una sola `createApi`, endpoint aggiunti con `injectEndpoints`). Il `baseQuery` è nuovo: NoseY chiudeva la sessione al primo 401, Resonance rinnova il token con il refresh (uno alla volta, retry su 409, rinnovo anticipato). |
| `lib/codiciErrore.ts`, `lib/errori.ts` | `lib/errors/errorMessages.ts`, `lib/errors/getErrorMessage.ts`, `components/ui/ErrorAlert.tsx`, `types/common.ts` | A | FE-02 | Si tiene l'idea: un testo per codice, decisione sempre sul codice e mai sul messaggio. Codici e testi nuovi dalla sezione 6.2; `ErrorResponse` con `code`, `fields`, `details`. Non si porta il catalogo italiano dei codici di NoseY. |
| `components/layout/Protezioni.tsx` | `components/guards/RequireAuth.tsx`, `components/guards/RequireRole.tsx` | A | FE-02 | Si tiene l'idea (rotte che rimandano al login). La pagina richiesta passa nello stato del router, non in `?redirect=`; ruoli additivi, con SUPERADMIN che vale anche come ADMIN; chi non ha il ruolo vede una pagina "Accesso negato" (`components/ui/AccessDenied.tsx`), non un reindirizzamento. |
| `features/accesso/CampoCodiceOtp.tsx` | `features/auth/components/OtpField.tsx` | A | FE-03 | Sei caselle, solo cifre, incolla e Backspace come in NoseY. Stili con Bootstrap e `--rs-*`; l'errore sta sotto le caselle (`FieldError`); senza il testo "6 cifre · vale 15 minuti". |
| `features/accesso/ReinvioCodice.tsx` | `features/auth/components/ResendCode.tsx` | A | FE-03 | L'attesa di 60 secondi sta sul pulsante ("Invia di nuovo il codice (42 s)"). Parte subito se il codice è appena partito (segno `codeSent` nello stato del router, non il `sessionStorage` di NoseY: decisione 83). Un solo componente per verifica e reset (`purpose`). |
| `features/accesso/validaRegistrazione.ts` | `features/auth/validation.ts` | A | FE-03 | Regole del backend (nome 3–30, email 255, password 8–72 caratteri e 72 byte, niente emoji: decisione 84). Senza conferma password, data di nascita, indirizzo e termini, che Resonance non ha. |
| `components/ui/CampoPassword.tsx` | `features/auth/components/PasswordField.tsx` | A | FE-03 | Occhio e contatore dei byte (`N / 72 byte`); senza `TextField` e senza Tailwind. |
| `features/profilo/FormDatiPersonali.tsx` | `features/users/components/ProfileForm.tsx` | A | FE-04 | Si tiene l'idea: PATCH con i soli campi cambiati, «Salva» spento senza modifiche, errori dei campi del server sotto i campi. Campi di Resonance (nome visibile, bio, città, indirizzo della foto); senza `TextField`, `DateTimeField` e Tailwind. Dopo il salvataggio si torna a `/profilo` con l'avviso (decisione 86). |
| `features/profilo/validaProfilo.ts` | `features/users/profilePatch.ts` | A | FE-04 | `valoriProfilo`, `modificheProfilo` e `validaProfilo` diventano `profileValues`, `buildProfilePatch` e `validateProfile`, con le regole di Resonance (stringa vuota per svuotare, avatar solo `http`/`https`) e il PATCH della posizione arrotondata. Senza il cambio password, che Resonance non ha. |
| `features/eventi/usePosizioneUtente.ts` | `hooks/useBrowserPosition.ts` | A | FE-04 | Stessa idea (posizione chiesta solo con un pulsante, non precisa, tempo massimo di 10 s); `request()` restituisce una promessa con la posizione o `null`, e lo stato è `idle`, `pending`, `granted`, `denied` o `unavailable`. |
| `components/ui/Avatar.tsx` | `components/ui/Avatar.tsx` | A | FE-04 | Foto o iniziale (anche un'emoji intera); se la foto non si carica torna all'iniziale. Cerchio giallo con Bootstrap e `--rs-*`, due misure (`sm` per la barra, `lg` per il profilo); senza il pallino «online». |
| `components/mappa/index.tsx`, `components/mappa/Mappa.tsx`, `components/mappa/tipi.ts` | `components/map/index.ts`, `components/map/Map.tsx`, `lib/format/distance.ts` | A | FE-05 | Si tengono MapLibre GL + react-map-gl + OpenFreeMap, il caricamento differito, il worker come file (`setWorkerUrl`), l'attribuzione sempre aperta e il poligono del cerchio (`circlePolygon`). Nomi in inglese, stile `dark`, fumetto del marker con `Popup` al posto della scelta del punto. Non si porta `CercaIndirizzo` (la geocodifica la fa il backend). |
| `components/mappa/IconaMarker.tsx` | `components/map/markers.tsx` | A | FE-05 | Marker come pulsanti (Tab, Invio, barra spaziatrice); concerti e indie distinti da icona (stella e nota) e nome, non solo dal colore, con legenda. Non si porta il colore per stato né i POI. |
| `components/mappa/mappa.css` | `components/map/map.css` | A | FE-05 | Controlli, attribuzione e fumetto riscritti con i token `--rs-*`; senza il filtro «fiord». |

**Non consultati in FE-05:** `features/eventi/ListaEventiMappa` e `components/eventi/CardEvento`: l'elenco e la card di Resonance sono nuovi, disegnati dal mock-up Stitch (NoseY ha stati e POI degli eventi, Resonance no).

**Non portato nel frontend:** stili e configurazione Tailwind, MSW nel browser (`mocks/`,
`public/mockServiceWorker.js`: in Resonance MSW serve solo ai test), `qrcode.react` e le schermate dei
ticket, le funzioni AI, la "ragnatela" delle connessioni.

## Documentazione e Postman

| NoseY | Resonance | Note |
|---|---|---|
| `docs/decisioni.md` | `docs/decisioni.md` | Stesso formato Scelta / Motivazione / Alternative scartate. |
| `docs/NoseY-progettazione.md` | `docs/progettazione.md` | Sezioni numerate citate dai commenti. |
| `docs/report-sicurezza.md` | `docs/report-sicurezza.md` (F6-02) | Struttura di riferimento: verifica statica, poi dinamica, per tipo di attacco. |
| `postman/NoseY.postman_collection.json` | `postman/resonance.postman_collection.json` | Solo come esempio di struttura e degli script di test. |

## Non portato

AI/Gemini (`ai/*`), `friendship/AmiciziaConChat` (la chat non è legata all'amicizia), ticket e partecipanti (`ticket/*`, riferimento per
Post-V1), anonimizzazione (`AnonimizzazioneService`, `AnonimizzazioneEventiService*`), artisti, POI,
foto ed eventi di NoseY (`event/*`), notifiche persistenti (`notification/Notifica*`,
`NotificheService*`), storage e immagini (`StorageService*`, `VersioneContenuto`,
`ImmagineValidata`, `ImmagineContenuto`: riferimento per Post-V1), `SmtpEmailService`, blacklist
`TokenJwt`/`TokenJwtRepository`, `CambiaRuoloRequest`, `ModificaUtenteRequest`,
`CambioPasswordRequest`, plugin `hibernate-maven-plugin`, Actuator.
