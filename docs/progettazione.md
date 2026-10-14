# Resonance — Progettazione del backend

> **Stato: APPROVATO (13 ottobre).** È il riferimento principale per lo sviluppo. Le modifiche
> successive si fanno solo per cambiamenti approvati, registrandole anche in `docs/decisioni.md`.
> I commenti nel codice citano le sezioni con il formato "progettazione, sezione N".
>
> Fonti: `docs/brief.md` (requisiti e vincoli), codice di NoseY (riuso), risposte del brainstorming.

## Indice

1. Decisioni e vincoli
2. Architettura applicativa
3. Schema del database
4. Autenticazione: token, cookie e flussi
5. Ruoli, utenti e amministrazione
6. Contratti REST
7. Contratti WebSocket/STOMP
8. Sicurezza e autorizzazioni
9. Email
10. Geolocalizzazione
11. Test
12. Deploy e configurazione
13. Documentazione del progetto
14. Roadmap e ticket
15. Funzionalità future (Post-V1 e Post-V2)

---

## 1. Decisioni e vincoli

### 1.1 Decisioni già prese nel brief (sezione 9)

| # | Decisione | Sintesi |
|---|---|---|
| D1 | Deploy (**nuova versione**, sostituisce quella del brief) | Un solo servizio web Render (Docker) su `onrender.com` che serve API e build del frontend React. Dockerfile multi-stage (Node → JDK → JRE). Fallback SPA verso `index.html` escluse `/api/**` e `/ws/**`. Fino al 20 ottobre il servizio contiene solo il backend. Stessa origine: cookie di refresh di prima parte `SameSite=Lax`, nessun CORS in produzione. `render.yaml` con database + un solo servizio web. Nessun dominio personalizzato. |
| D2 | Immagini | Solo URL (`avatar_url`, `cover_image_url`, `image_url`). Nessun upload. Cloudinary escluso. |
| D3 | Geocodifica | Nominatim sincrono alla pubblicazione, timeout breve, errore chiaro. |
| D4 | Blacklist access token | Nessuna. Bastano revoca dei refresh token e lettura di ruoli/stato dal DB. |
| D5 | Documentazione API | springdoc-openapi + Swagger UI in F6 (taglio n. 2 se in ritardo); Postman resta obbligatoria. |
| D6 | Contenuti moderati | `hidden_at` / `hidden_by` sulle tabelle moderabili; le query pubbliche li escludono; l'ADMIN ripristina. |

I vincoli VINCOLANTI del brief (stack, ruoli, autenticazione, schema, real-time, metodo di lavoro)
valgono integralmente e non vengono ripetuti qui se non dove servono al design.

**D1 sostituita dallo studente (13 ottobre).** La D1 del brief (dominio personalizzato con `app.` e
`api.`, due servizi Render) è sostituita dalla versione della tabella. Alternative scartate: due
servizi Render con dominio personalizzato (costo e configurazione DNS); due servizi su
`onrender.com` (siti diversi per il browser: cookie di refresh di terze parti, bloccato da
Safari/iOS e, con `SameSite=Lax`, non inviato da nessun browser). Le parti del brief che citano
`app.`, `api.` e il dominio personalizzato (§4.4, §4.8, §8.2-O, §10.7, F6) vanno lette alla luce di
questa sostituzione.

### 1.2 Punti chiusi durante il brainstorming

| # | Scelta |
|---|---|
| P1 | Package base `it.epicode.resonance`, groupId `it.epicode` (artifactId proposto: `resonance-be`). |
| P2 | Tabella separata `email_codes` con campo `purpose` (enum `EMAIL_VERIFICATION`, `PASSWORD_RESET`), estendibile al 2FA (Post-V2). Logica di NoseY: scadenza 15 min, 5 tentativi, limiti di invio, confronto a tempo costante. |
| P3 | Logout con `DELETE /api/auth/refresh`: revoca il refresh token del dispositivo e cancella il cookie. |
| P4 | Finestra di tolleranza di 10 s per refresh concorrenti: colonne `revoked_at` e `replaced_by` in `refresh_tokens`. |
| P5 | Colonna `address` in `official_concerts` e `indie_events`, geocodificata e mostrata dal frontend. |
| P6 | Candidatura collab: `POST /api/collab-posts/{id}/applications`, senza tabella nuova: messaggio in chat all'autore + notifica live. |
| P7 | Bozze degli indie event e chiusura degli annunci collab; `DELETE` del proprietario come soft delete (`hidden_at`/`hidden_by`); nessuna modifica dei contenuti nell'MVP. |
| P8 | Regola di NoseY: si agisce solo su utenti con livello di piattaforma inferiore, mai su se stessi. Il SUPERADMIN non è sospendibile via API. |
| P9 | A ogni SEND STOMP si controllano scadenza dell'access token del CONNECT e stato ACTIVE; token scaduto → errore e riconnessione del client. |
| P10 | Test sullo stesso container Docker, database separato `resonance_test`. |
| P11 | Coordinate di utenti e post del feed facoltative, inviate dal client; `city` testo libero; filtro per raggio facoltativo nel feed. |

Dettagli aggiuntivi decisi:

- **Moderazione admin**: nascondere = `hidden_at`/`hidden_by` + `hidden_reason`, obbligatorio quando
  nasconde un admin, facoltativo quando nasconde il proprietario. Nessuna cancellazione fisica.
  L'admin può ripristinare.
- **Sospensione**: in `users` i campi `suspended_at`, `suspended_by`, `suspension_reason`
  (obbligatorio), `suspended_until` (facoltativo, `null` = a tempo indeterminato). L'admin indica una
  durata o una data di fine. Riattivazione automatica "pigra" (sezione 5.5), senza job. Riattivazione
  manuale anticipata possibile. Nessuno stato `BANNED`: la sospensione equivale al ban.
- **Utente sospeso a login/refresh**: codice `ACCOUNT_SUSPENDED` con `suspensionReason` e
  `suspendedUntil`. La richiesta di riattivazione (appeal) è Post-V1.
- **Profilo con `PATCH /api/users/me`**: si modificano solo i campi inviati. Campo assente o `null` =
  invariato; stringa vuota = svuota il campo (solo campi di testo facoltativi: `bio`, `city`,
  `avatarUrl`). Stesso criterio per ogni altro aggiornamento parziale (sezione 6.1).
- **Posizione dell'utente**: `latitude`/`longitude` facoltative (null finché l'utente non condivide
  la posizione), sempre insieme e nei range; si impostano con il `PATCH` inviando entrambe; si
  rimuovono solo con `DELETE /api/users/me/location`. Le funzioni basate sulla distanza usano solo
  `lat`/`lng` passati nella richiesta, mai le coordinate salvate nel profilo.
- Tutte le colonne e tabelle aggiunte vanno in `docs/schema-db.md` e in `docs/decisioni.md`.

### 1.3 Scelte tecniche approvate con questo documento

Proposte nel documento di design e approvate insieme al documento (13 ottobre).

1. Health check custom `GET /api/health` senza Actuator (come NoseY, decisione D19).
2. Ricerca per raggio con la formula di Haversine **in SQL** (query nativa con prefiltro a bounding
   box e paginazione); la classe `Haversine` di NoseY resta come riferimento e oracolo dei test
   (sezione 10.3).
3. Ricerche "vicino a me" separate per tipo: `/api/official-concerts/nearby` e
   `/api/indie-events/nearby` (le due entità restano distinte anche in lettura).
4. Valori degli enum PostgreSQL in maiuscolo, coerenti con gli enum Java: `indie_event_status` =
   `DRAFT | PUBLISHED` (il brief li scrive in minuscolo).
5. Letture pubbliche (senza login) per eventi, feed, annunci collab e profili pubblici; tutto il
   resto richiede autenticazione.
6. Frontend servito da Spring come risorse statiche (`classpath:/static/`) con un resolver che
   restituisce `index.html` per i percorsi senza estensione fuori da `/api/` e `/ws`; in Spring
   Security le richieste `GET` fuori da `/api/**` e `/ws/**` sono pubbliche (sono file statici, non
   dati). L'elenco esplicito senza wildcard resta valido per tutti gli endpoint `/api/**` (sezione 8.4).
7. Chat avviata con `POST /api/chats` (trova o crea la conversazione), invio via STOMP su
   `/app/chats/{conversationId}/send` come in NoseY.
8. Il nuovo messaggio genera sia il messaggio su `/user/queue/messages` (mittente e destinatario) sia
   una notifica `NEW_MESSAGE` su `/user/queue/notifications` (solo destinatario).
9. Il ripristino da parte di un admin vale solo per contenuti nascosti da un admin, non per quelli
   cancellati dal proprietario (sezione 5.7).
10. Limiti anti-spam in memoria anche per nuove conversazioni e candidature (sezione 8.8).
11. Spring Mail incluso nelle dipendenze come da stack, ma nell'MVP il trasporto effettivo è il log
    (dev) o Brevo via HTTP (prod): `SmtpEmailService` di NoseY non viene portato.

### 1.4 Questioni ancora aperte (non bloccanti per F0–F5)

- **Indirizzo di contatto per i ricorsi** mostrato dal frontend agli utenti sospesi: è una
  configurazione del frontend; il backend non lo espone.
- **Versione di springdoc-openapi** compatibile con Spring Boot 4.1.1: da verificare all'inizio di F6.
- **Plugin Strix** per la verifica dinamica: disponibilità da verificare in F6.
- **Rischio di tempo**: il brief assegna F0 e F1 allo stesso giorno (14 ottobre). Il calendario
  della sezione 14 anticipa F0 alla sera del 13 ottobre e riporta una stima per ogni card; gli
  sforamenti si segnalano subito, come previsto dalla sezione 1-BIS del brief.

---

## 2. Architettura applicativa

### 2.1 Panoramica

Monolite Spring Boot 4.1.1 su Java 25, organizzato **per dominio** (come NoseY): ogni package
contiene entity, repository, service, controller e DTO del proprio dominio. Strati:

- **Controller** (REST o STOMP): solo mappatura HTTP/STOMP ↔ DTO, validazione `@Valid`, nessuna logica.
- **Service**: regole di business, transazioni (`@Transactional`), pubblicazione degli eventi applicativi.
- **Repository**: Spring Data JPA; query native solo dove servono (Haversine, `ON CONFLICT`), sempre
  con parametri legati.
- **DTO**: `record` Java con metodo statico `from(...)`; le entity non escono mai dai controller.
  Normalizzazione (trim, email minuscola) nel costruttore compatto del record, come in NoseY.
- **Entity**: Lombok `@Getter`/`@Setter`, id `@GeneratedValue(strategy = GenerationType.UUID)`.

Componenti trasversali: gestione centralizzata degli errori, `Clock` iniettato, limiti di frequenza
in memoria, eventi applicativi con `@TransactionalEventListener(AFTER_COMMIT)` per email e push live.

### 2.2 Package

Base: `it.epicode.resonance`. Ogni package ha il suo `package-info.java` con una riga di responsabilità.

| Package | Responsabilità (riga del package-info) | Contenuto principale |
|---|---|---|
| `(base)` | Avvio dell'applicazione. | `ResonanceApplication` (chiama `DatabaseUrl` prima di Spring). |
| `config` | Configurazione di sicurezza, CORS, WebSocket, async, scheduling e database. | `SecurityConfig`, `CorsConfig`, `WebSocketConfig`, `AsyncConfig`, `SchedulingConfig`, `ClockConfig`, `DatabaseUrl`, `OpenApiConfig` (F6). |
| `common` | Errori, paginazione, validazioni e limiti di frequenza condivisi da tutti i domini. | `AppException`, `ErrorCode`, `ErrorResponse`, `GlobalExceptionHandler`, `StompErrorHandler`, `WebSocketExceptionHandler`, `WsError`, `PageResponse`, `RateLimit`, `RateLimitService`, `HttpUrl` e `NotBlankIfPresent` (validatori). |
| `auth` | Autenticazione: registrazione, codici email, login, token e filtri JWT. | `AuthController`, `AuthService`, `AccessTokenService`, `RefreshTokenService`, `RefreshToken`, `RefreshCookieFactory`, `EmailCode`, `EmailCodeService`, `EmailCodePurpose`, `JwtFilter`, `JwtChannelInterceptor`, `AuthenticatedUser`, `UserAccessService`, `SuperadminBootstrap`, `PasswordMax72Bytes`, DTO. |
| `user` | Utenti, ruoli, profilo e livelli di piattaforma. | `User`, `UserRole`, `UserRoleId`, `Role`, `UserStatus`, `UserRepository`, `UserRoleRepository`, `UserController`, `UserService`, `PlatformLevelPolicy`, DTO. |
| `admin` | Amministrazione utenti: elenco, sospensione, nomina e revoca degli ADMIN. | `AdminUserController`, `SuperadminController`, `AdminUserService`, `UserSuspendedEvent`, DTO. |
| `moderation` | Nascondere e ripristinare i contenuti (admin e proprietario). | `Moderation` (`@Embeddable`: `hidden_at`, `hidden_by`, `hidden_reason`), `ModeratedContentType`, `ModerationController`, `ModerationService`, DTO. |
| `geo` | Geocodifica Nominatim e calcolo delle distanze. | `Haversine`, `GeoPoint`, `GeocodingService`, `NominatimGeocodingService`, `NearbyQuery`. |
| `event` | Concerti ufficiali (HOST) e indie event (MUSICIAN). | `OfficialConcert`, `IndieEvent`, `IndieEventStatus`, repository, service, controller, DTO. |
| `collab` | Annunci di collaborazione e candidature. | `CollabPost`, `CollabPostRepository`, `CollabService`, `CollabController`, DTO. |
| `feed` | Post del feed e like. | `FeedPost`, `PostLike`, `PostLikeId`, repository, `FeedService`, `FeedController`, DTO. |
| `chat` | Conversazioni e messaggi privati 1:1 (REST e STOMP). | `ChatConversation`, `ChatMessage`, repository, `ChatService`, `ChatController`, `ChatWebSocketController`, `ChatMessageEvent`, `ChatMessageListener`, DTO. |
| `notification` | Notifiche live non persistenti. | `LiveNotification`, `NotificationType`, `LiveNotificationEvent`, `LiveNotificationListener`. |
| `websocket` | Registro delle sessioni WebSocket e chiusura alla sospensione. | `WebSocketSessionRegistry`, `UserSuspendedSessionCloser`. |
| `mail` | Email a eventi con template Thymeleaf. | `EmailService`, `HtmlEmailService`, `LogEmailService`, `BrevoEmailService`, `EmailEventListener`, eventi email. |
| `web` | Endpoint tecnici e distribuzione del frontend (fallback SPA). | `HealthController`, `SpaResourceConfig` (risorse statiche + fallback a `index.html`). |

Dipendenze ammesse: i domini (`event`, `collab`, `feed`, `chat`) dipendono da `user`, `common`,
`geo`, `moderation`, `notification`; `moderation` dipende da `user` (regola dei livelli) e
`common`; `auth` dipende da `user`, `mail`, `common`; nessun package dipende da `admin` (è `admin`
a dipendere da `user` e `auth`).

### 2.3 Configurazione e profili

`application.yml` sostituisce l'`application.properties` creato da Initializr.

| File | Contenuto |
|---|---|
| `application.yml` | Comune: `server.port: ${PORT:8080}`, shutdown graceful, `ddl-auto: validate`, `open-in-view: false`, `jdbc.time_zone: UTC`, esclusione `UserDetailsServiceAutoConfiguration`, `log-resolved-exception: false`, blocco `app.*` (JWT, cookie, CORS, limiti, geocoding, mail, bootstrap). |
| `application-dev.yml` | DB `jdbc:postgresql://localhost:5433/resonance`, cookie `secure: false`, origini ammesse `http://localhost:5173` (dev server Vite, per l'handshake WebSocket e per chiamate dirette senza proxy), email nel log. |
| `application-prod.yml` | Cookie `secure: true`, Brevo, nessuna origine esterna ammessa (stessa origine), nessun default per i segreti. |
| `application-test.yml` | DB `resonance_test` sulla porta 5433, geocoding sostituito da uno stub, email nel log. |

I segreti arrivano solo da variabili d'ambiente (sezione 12.4); nessun file versionato contiene
valori segreti.

### 2.4 Riuso di NoseY

La mappa completa (classe NoseY → classe Resonance, categoria, note) sta in `docs/riuso-nosey.md`.
Sintesi:

- **Quasi com'è** (traduzione in inglese): gestione errori (HTTP e STOMP), `PageResponse`,
  `Haversine`, `DatabaseUrl`, `RateLimitService`, `ClockConfig`, `AsyncConfig`, `SchedulingConfig`,
  sistema email a eventi, pattern live post-commit, `WebSocketConfig`, logica dei codici email e del
  login di `AuthService`, validatore dei 72 byte, `NonVuoto` → `NotBlankIfPresent` (per il `PATCH`),
  `.dockerignore`, stage JDK e JRE del Dockerfile.
- **Da adattare**: `TokenService` → `AccessTokenService` + nuovo `RefreshTokenService`; `JwtFilter` e
  `JwtChannelInterceptor` (ruoli/stato dal DB); `SecurityConfig` (gerarchia solo
  SUPERADMIN > ADMIN); `CorsConfig` (credenziali, header espliciti); `AdminUtenteService`
  (ruoli multipli, sospensione estesa); `ChatWebSocketController` (senza amicizie); cursore della
  chat; Dockerfile (contesto di build alla radice del repository, stage Node per il frontend);
  `render.yaml` (un solo servizio web).
- **Non portato**: AI/Gemini, amicizie, ticket/partecipanti, anonimizzazione, artisti, POI, foto,
  storage delle immagini, notifiche persistenti, `SmtpEmailService`, plugin di enhancement di
  Hibernate, Actuator, blacklist `TOKEN_JWT`.

### 2.5 Commenti nel codice

Le scelte non ovvie hanno un commento breve che rimanda alla sezione di questo documento
("progettazione, sezione 4.6"), senza copiarne i paragrafi.

---

## 3. Schema del database

PostgreSQL. Tutte le chiavi primarie ed esterne sono `uuid`, generate da Hibernate
(`GenerationType.UUID`); le migrazioni impostano anche `DEFAULT gen_random_uuid()` per gli
inserimenti SQL diretti. Timestamp sempre `timestamptz` (UTC). Nomi dei vincoli espliciti
(`pk_`, `uq_`, `fk_`, `ck_`, `ix_`): il `GlobalExceptionHandler` li traduce in codici d'errore.

### 3.1 Enum PostgreSQL

| Tipo | Valori | Mappatura Java |
|---|---|---|
| `user_role` | `FAN`, `MUSICIAN`, `HOST`, `ADMIN`, `SUPERADMIN` | `Role` |
| `user_status` | `ACTIVE`, `SUSPENDED` | `UserStatus` |
| `email_code_purpose` | `EMAIL_VERIFICATION`, `PASSWORD_RESET` | `EmailCodePurpose` (Post-V2: `+ TWO_FACTOR` con `ALTER TYPE ... ADD VALUE`) |
| `indie_event_status` | `DRAFT`, `PUBLISHED` | `IndieEventStatus` |

In JPA: `@Enumerated(EnumType.STRING)` + `@JdbcTypeCode(SqlTypes.NAMED_ENUM)`, come in NoseY.
`text[]` con `@JdbcTypeCode(SqlTypes.ARRAY)` su `List<String>`.

### 3.2 Tabelle

Legenda: **[brief]** = campo del brief; **[P#]/[dett.]** = aggiunta approvata nel brainstorming;
**[tecnico]** = dettaglio tecnico proposto in questo documento.

#### users

| Colonna | Tipo | Vincoli | Origine |
|---|---|---|---|
| id | uuid | PK | brief |
| email | varchar(255) | NOT NULL, `uq_users_email`, sempre minuscola | brief |
| password_hash | varchar(100) | NOT NULL (BCrypt) | brief |
| display_name | varchar(50) | NOT NULL | brief |
| avatar_url | varchar(2048) | NULL, solo http/https | brief |
| email_verified | boolean | NOT NULL DEFAULT false | brief |
| status | user_status | NOT NULL DEFAULT 'ACTIVE' | brief |
| bio | varchar(500) | NULL | brief |
| city | varchar(100) | NULL, testo libero | brief |
| latitude | double precision | NULL finché l'utente non condivide la posizione, −90..90 | brief |
| longitude | double precision | NULL finché l'utente non condivide la posizione, −180..180 | brief |
| created_at | timestamptz | NOT NULL DEFAULT now() | brief |
| suspended_at | timestamptz | NULL | dett. sospensione |
| suspended_by | uuid | NULL, `fk_users_suspended_by` → users | dett. sospensione |
| suspension_reason | varchar(500) | NULL | dett. sospensione |
| suspended_until | timestamptz | NULL (null = indeterminata) | dett. sospensione |

Vincoli: `ck_users_coordinates` (latitudine e longitudine entrambe presenti o entrambe nulle, nei
range); `ck_users_suspension`: se `status = 'ACTIVE'` i quattro campi di sospensione sono nulli; se
`status = 'SUSPENDED'` `suspended_at`, `suspended_by`, `suspension_reason` sono valorizzati.
Nell'MVP la riattivazione svuota i campi (nessuno storico delle sospensioni).

#### user_roles

| Colonna | Tipo | Vincoli |
|---|---|---|
| user_id | uuid | `fk_user_roles_user` → users ON DELETE CASCADE |
| role | user_role | NOT NULL |
| granted_at | timestamptz | NOT NULL DEFAULT now() |

PK composta `pk_user_roles (user_id, role)`. Indice `ix_user_roles_role (role)` (ricerca
dell'esistenza di un SUPERADMIN, elenchi admin). Entity `UserRole` con `@EmbeddedId UserRoleId`.

#### email_codes [P2]

Una riga per coppia (utente, scopo): contiene il codice attivo e i contatori dei limiti di invio.

| Colonna | Tipo | Vincoli |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | NOT NULL, `fk_email_codes_user` → users ON DELETE CASCADE |
| purpose | email_code_purpose | NOT NULL |
| code | varchar(6) | NULL (null = nessun codice attivo, dopo l'uso) |
| sent_at | timestamptz | NULL (ultimo invio: limite dei 60 s e scadenza dei 15 min) |
| attempts | int | NOT NULL DEFAULT 0 |
| sends_count | int | NOT NULL DEFAULT 0 |
| sends_window_start | timestamptz | NULL (inizio della finestra di 24 h) |
| created_at | timestamptz | NOT NULL DEFAULT now() |

`uq_email_codes_user_purpose (user_id, purpose)`; `ck_email_codes_code` (se `code` non è nullo,
`sent_at` non è nullo). Il codice è salvato in chiaro come in NoseY: 6 cifre hanno troppa poca
entropia perché un hash protegga davvero; la protezione è data da scadenza, tentativi e limiti.

#### refresh_tokens

| Colonna | Tipo | Vincoli | Origine |
|---|---|---|---|
| id | uuid | PK | brief |
| user_id | uuid | NOT NULL, `fk_refresh_tokens_user` → users ON DELETE CASCADE | brief |
| token_hash | char(64) | NOT NULL, `uq_refresh_tokens_hash` (SHA-256 esadecimale) | brief |
| expires_at | timestamptz | NOT NULL | brief |
| revoked | boolean | NOT NULL DEFAULT false | brief |
| created_at | timestamptz | NOT NULL DEFAULT now() | brief |
| revoked_at | timestamptz | NULL | P4 |
| replaced_by | uuid | NULL, `fk_refresh_tokens_replaced_by` → refresh_tokens ON DELETE SET NULL | P4 |

`ck_refresh_tokens_revoked`: `revoked = (revoked_at IS NOT NULL)`; `replaced_by` valorizzato solo se
`revoked`. Indici `ix_refresh_tokens_user (user_id)`, `ix_refresh_tokens_expires (expires_at)`.

#### official_concerts

| Colonna | Tipo | Vincoli | Origine |
|---|---|---|---|
| id | uuid | PK | brief |
| host_id | uuid | NOT NULL, `fk_official_concerts_host` → users | brief |
| title | varchar(150) | NOT NULL | brief |
| description | varchar(5000) | NULL | brief |
| venue_name | varchar(150) | NOT NULL | brief |
| address | varchar(255) | NOT NULL | P5 |
| latitude, longitude | double precision | NOT NULL, nei range | brief |
| event_date | timestamptz | NOT NULL | brief |
| genre_tags | text[] | NOT NULL DEFAULT '{}' | brief |
| cover_image_url | varchar(2048) | NULL | brief |
| external_ticket_url | varchar(2048) | NULL | brief |
| created_at | timestamptz | NOT NULL DEFAULT now() | brief |
| hidden_at | timestamptz | NULL | D6 |
| hidden_by | uuid | NULL, FK → users | D6 |
| hidden_reason | varchar(500) | NULL | dett. moderazione |

#### indie_events

Come `official_concerts`, con `musician_id` (NOT NULL, FK → users) al posto di `host_id`, senza
`external_ticket_url`, più:

| Colonna | Tipo | Vincoli |
|---|---|---|
| is_free | boolean | NOT NULL DEFAULT false |
| status | indie_event_status | NOT NULL DEFAULT 'PUBLISHED' |

#### collab_posts

| Colonna | Tipo | Vincoli | Origine |
|---|---|---|---|
| id | uuid | PK | brief |
| musician_id | uuid | NOT NULL, FK → users | brief |
| title | varchar(150) | NOT NULL | brief |
| description | varchar(5000) | NOT NULL | brief |
| role_needed | varchar(100) | NOT NULL | brief |
| genre_tags | text[] | NOT NULL DEFAULT '{}' | brief |
| location | varchar(150) | NULL, testo libero | brief |
| is_open | boolean | NOT NULL DEFAULT true | brief |
| created_at | timestamptz | NOT NULL DEFAULT now() | brief |
| hidden_at, hidden_by, hidden_reason | | come sopra | D6 + dett. |

#### feed_posts

| Colonna | Tipo | Vincoli | Origine |
|---|---|---|---|
| id | uuid | PK | brief |
| author_id | uuid | NOT NULL, FK → users | brief |
| body | varchar(2000) | NOT NULL | brief |
| image_url | varchar(2048) | NULL | brief |
| latitude, longitude | double precision | NULL, entrambe o nessuna | brief |
| likes_count | int | NOT NULL DEFAULT 0, `ck_feed_posts_likes >= 0` | brief |
| created_at | timestamptz | NOT NULL DEFAULT now() | brief |
| hidden_at, hidden_by, hidden_reason | | come sopra | D6 + dett. |

#### post_likes

| Colonna | Tipo | Vincoli |
|---|---|---|
| user_id | uuid | FK → users |
| post_id | uuid | FK → feed_posts |
| created_at | timestamptz | NOT NULL DEFAULT now() |

PK composta `pk_post_likes (user_id, post_id)`; indice `ix_post_likes_post (post_id)`.

#### chat_conversations

| Colonna | Tipo | Vincoli |
|---|---|---|
| id | uuid | PK |
| user_a_id | uuid | NOT NULL, FK → users |
| user_b_id | uuid | NOT NULL, FK → users |
| created_at | timestamptz | NOT NULL DEFAULT now() |
| last_message_at | timestamptz | NULL |

Coppia canonica: `ck_chat_conversations_order (user_a_id < user_b_id)` e
`uq_chat_conversations_pair (user_a_id, user_b_id)`: una sola conversazione per coppia, qualunque
dei due la apra. Indice `ix_chat_conversations_user_b (user_b_id)`.

#### chat_messages

| Colonna | Tipo | Vincoli |
|---|---|---|
| id | uuid | PK |
| conversation_id | uuid | NOT NULL, FK → chat_conversations |
| sender_id | uuid | NOT NULL, FK → users |
| body | varchar(2000) | NOT NULL |
| read_at | timestamptz | NULL |
| sent_at | timestamptz | NOT NULL DEFAULT now() |

Indice `ix_chat_messages_cursor (conversation_id, sent_at DESC, id DESC)`: serve la paginazione a
cursore.

#### Vincoli comuni di moderazione (4 tabelle moderabili)

`ck_<tabella>_hidden`: `(hidden_at IS NULL) = (hidden_by IS NULL)` e `hidden_reason` nullo se
`hidden_at` è nullo. L'obbligatorietà di `hidden_reason` per gli admin è controllata nel service
(il database non sa se chi nasconde è un admin). Mappatura JPA con l'`@Embeddable Moderation`.

Indici dei contenuti: autore (`ix_<tabella>_<autore>`), `(latitude, longitude)` per il prefiltro
geografico di eventi e feed, `event_date` per gli eventi, `(created_at DESC, id DESC)` per feed e
collab.

### 3.3 Relazioni (ER)

```mermaid
erDiagram
    USERS ||--o{ USER_ROLES : "ha ruoli"
    USERS ||--o{ EMAIL_CODES : "riceve codici"
    USERS ||--o{ REFRESH_TOKENS : "possiede"
    REFRESH_TOKENS |o--o| REFRESH_TOKENS : "sostituito da"
    USERS |o--o{ USERS : "sospeso da"
    USERS ||--o{ OFFICIAL_CONCERTS : "pubblica (HOST)"
    USERS ||--o{ INDIE_EVENTS : "pubblica (MUSICIAN)"
    USERS ||--o{ COLLAB_POSTS : "pubblica (MUSICIAN)"
    USERS ||--o{ FEED_POSTS : "scrive"
    USERS ||--o{ POST_LIKES : "mette like"
    FEED_POSTS ||--o{ POST_LIKES : "riceve"
    USERS ||--o{ CHAT_CONVERSATIONS : "utente A / utente B"
    CHAT_CONVERSATIONS ||--o{ CHAT_MESSAGES : "contiene"
    USERS ||--o{ CHAT_MESSAGES : "invia"
    USERS |o--o{ OFFICIAL_CONCERTS : "nasconde (hidden_by)"
    USERS |o--o{ INDIE_EVENTS : "nasconde (hidden_by)"
    USERS |o--o{ COLLAB_POSTS : "nasconde (hidden_by)"
    USERS |o--o{ FEED_POSTS : "nasconde (hidden_by)"
```

### 3.4 likes_count denormalizzato

Like e unlike aggiornano il contatore nella stessa transazione, in modo atomico nel database:

1. Like: `INSERT INTO post_likes ... ON CONFLICT DO NOTHING`; solo se ha inserito una riga →
   `UPDATE feed_posts SET likes_count = likes_count + 1 WHERE id = ?`.
2. Unlike: `DELETE FROM post_likes WHERE ...`; solo se ha cancellato una riga →
   `UPDATE ... SET likes_count = likes_count - 1`.

L'incremento fatto dal database (non "leggi, somma, salva" in Java) evita aggiornamenti persi con
like simultanei; il "solo se ha inserito" rende le operazioni idempotenti. Il vincolo `>= 0` è una
rete di sicurezza.

### 3.5 Contenuti nascosti nelle query

- Tutte le query pubbliche e le liste del proprietario filtrano `hidden_at IS NULL`.
- Il dettaglio di un contenuto nascosto risponde 404 a chiunque, tranne agli endpoint admin.
- Like e candidature su contenuti nascosti → 404.
- I contenuti di un utente sospeso restano visibili salvo moderazione esplicita (il brief non
  chiede di nasconderli).

### 3.6 Migrazioni Flyway

Una migrazione per card che modifica lo schema; mai modifiche a migrazioni già applicate (le
correzioni vanno in una nuova `V`); nessuna credenziale nelle migrazioni.

| Versione | Card | Contenuto |
|---|---|---|
| `V1__users_and_roles.sql` | F0-02 | enum `user_role`, `user_status`; tabelle `users` (con campi di sospensione), `user_roles`. |
| `V2__refresh_tokens.sql` | F1-02 | tabella `refresh_tokens`. |
| `V3__email_codes.sql` | F1-03 | enum `email_code_purpose`; tabella `email_codes`. |
| `V4__official_concerts.sql` | F3-02 | tabella `official_concerts`. |
| `V5__indie_events.sql` | F3-03 | enum `indie_event_status`; tabella `indie_events`. |
| `V6__collab_posts.sql` | F4-01 | tabella `collab_posts`. |
| `V7__feed_and_likes.sql` | F4-02 | tabelle `feed_posts`, `post_likes`. |
| `V8__chat.sql` | F5-02 | tabelle `chat_conversations`, `chat_messages`. |

Ogni migrazione dipende solo da `users` (V1) e, per `post_likes`/`chat_messages`, dalle tabelle
create nella stessa migrazione. Nessuna tabella Post-V1/Post-V2 viene creata.

### 3.7 Allineamento di docs/schema-db.md

`docs/schema-db.md` descrive lo schema **effettivamente applicato**: a ogni migrazione che modifica
lo schema, nello stesso sotto-task, si aggiornano tabelle, vincoli e diagramma ER Mermaid. La
sezione 3 di questo documento è il modello di riferimento; `schema-db.md` è lo stato reale. Un test
di avvio con `ddl-auto: validate` verifica che entity e migrazioni coincidano.

---

## 4. Autenticazione: token, cookie e flussi

### 4.1 Access token

- JWT firmato HS256 con jjwt 0.13.0, segreto `JWT_SECRET` (almeno 32 byte, nessun default).
- Claim: `sub` = id utente, `iat`, `exp` (default 15 minuti, `ACCESS_TOKEN_TTL`). **Nessun ruolo né
  stato nei claim** (vincolo 3.5): il token identifica l'utente e basta.
- Restituito nel body di verify, login e refresh; il frontend lo tiene solo in memoria (Redux).
- Usato come `Authorization: Bearer` nelle richieste REST e nell'header del frame STOMP CONNECT.

### 4.2 Refresh token

- Valore: 32 byte casuali da `SecureRandom`, codificati base64url (43 caratteri). È opaco: non è un JWT.
- Nel database solo `token_hash` = SHA-256 esadecimale. Un hash veloce è sufficiente perché il
  token ha 256 bit di entropia (non è indovinabile come una password) e permette la ricerca diretta
  per hash; BCrypt servirebbe solo per segreti deboli.
- Durata 10 giorni con scadenza scorrevole (`REFRESH_TOKEN_TTL`): ogni refresh crea un token nuovo
  con 10 giorni pieni e revoca il precedente.

### 4.3 Cookie del refresh token

Costruito da `RefreshCookieFactory` (`ResponseCookie` di Spring):

| Attributo | Valore |
|---|---|
| Nome | `resonance_refresh` |
| HttpOnly | sì |
| Path | `/api/auth/refresh` |
| Max-Age | 864000 (10 giorni) |
| Secure | `true` in prod, `false` in dev (`app.auth.refresh-cookie.secure`) |
| SameSite | `Lax` |
| Domain | non impostato: cookie del solo host (`<servizio>.onrender.com` in produzione) |

Cancellazione: stesso nome, Path, SameSite e Secure, `Max-Age=0`. Una risposta di qualunque endpoint
dello stesso host può cancellarlo (serve per il reset della password).

Perché funziona con la nuova D1: frontend e API sono serviti dallo **stesso servizio e dalla stessa
origine**, quindi il cookie è di prima parte e il browser lo invia con `SameSite=Lax` (anche
Safari/iOS). In sviluppo il dev server Vite inoltra `/api` e `/ws` a `localhost:8080` (proxy):
anche lì il browser vede una sola origine (`localhost:5173`) e il cookie, con `Secure=false`,
funziona su HTTP.

### 4.4 Registrazione

`POST /api/auth/register` `{email, password, displayName}` → 201 `{userId, email}`.

1. Email normalizzata (trim, minuscole); password 8–72 caratteri e massimo 72 byte UTF-8.
2. Lock sulla riga dell'utente con quell'email (`SELECT ... FOR UPDATE`).
3. Email già verificata o account sospeso → 409 `EMAIL_ALREADY_REGISTERED`.
4. Email esistente ma non verificata: controllo dei limiti di invio (4.6), poi i nuovi dati
   sovrascrivono quelli in sospeso (come in NoseY: nessuno ha ancora dimostrato di possederla).
5. Utente nuovo: riga in `users` + riga `user_roles (FAN)` (FAN automatico e non rimovibile).
6. Codice `EMAIL_VERIFICATION` generato in `email_codes`; `saveAndFlush` (una registrazione
   concorrente sulla stessa email nuova fa scattare `uq_users_email` → 409).
7. Evento `VerificationCodeEmailEvent` → email inviata dopo il commit, in modo asincrono.

### 4.5 Verifica email

`POST /api/auth/verify` `{email, code, password}` → 200 `LoginResponse` + cookie di refresh.
Transazione con `noRollbackFor = AppException`: il tentativo consumato resta salvato anche se la
verifica fallisce. Ordine dei controlli (da NoseY):

1. Utente inesistente → 400 `CODE_INVALID`.
2. Già verificato → 409 `ALREADY_VERIFIED`.
3. Sospeso → 403 `ACCOUNT_SUSPENDED`.
4. Nessun codice utilizzabile (assente, oltre 15 minuti, 5 tentativi usati) → 400 `CODE_EXPIRED`.
5. Tentativo consumato **prima** del confronto con un `UPDATE ... SET attempts = attempts + 1 WHERE
   attempts < 5` atomico (0 righe → `CODE_EXPIRED`).
6. Confronto a tempo costante (`MessageDigest.isEqual`) → 400 `CODE_INVALID`.
7. Password diversa da quella della registrazione → 400 `WRONG_PASSWORD`.
8. Successo: `email_verified = true`, `code = null`, emissione dei token (4.7, passo 5).

### 4.6 Codici email: limiti

Per ogni riga `email_codes` (cioè per utente e per scopo):

- un codice valido 15 minuti, al massimo 5 tentativi;
- al massimo 1 invio ogni 60 secondi e 5 invii in 24 ore → 429 `TOO_MANY_REQUESTS`;
- un nuovo invio sostituisce il codice precedente e azzera i tentativi;
- generazione con `SecureRandom`, formato `%06d`.

`POST /api/auth/resend-code` `{email}` → sempre 204 (non rivela se l'email esiste); invia solo se
l'utente esiste, non è verificato ed è ACTIVE.

### 4.7 Login

`POST /api/auth/login` `{email, password}` → 200 `LoginResponse` + cookie.

1. Limite `LOGIN_FAILED` per email (10 fallimenti in 15 minuti) → 429.
2. Utente inesistente o password errata → 401 `INVALID_CREDENTIALS` (stessa risposta, registra il
   fallimento). Password oltre 72 byte → trattata come errata senza chiamare BCrypt.
3. Email non verificata → 403 `EMAIL_NOT_VERIFIED`.
4. Sospeso: se `suspended_until` è passato → riattivazione pigra (5.5) e si prosegue; altrimenti
   403 `ACCOUNT_SUSPENDED` con `details` `{suspensionReason, suspendedUntil}`.
5. Azzera i fallimenti; crea una riga `refresh_tokens`; firma l'access token; risponde con
   `LoginResponse {accessToken, accessTokenExpiresAt, user: MeResponse}` e `Set-Cookie`.

I controlli 3 e 4 avvengono solo dopo una password corretta, così non rivelano quali email esistono.

### 4.8 Refresh con rotazione

`POST /api/auth/refresh` (cookie + header `X-Requested-With: XMLHttpRequest`) → 200 `LoginResponse`
+ nuovo cookie. Tutto in una transazione:

1. Header `X-Requested-With` assente → 403 `CSRF_HEADER_MISSING`. Header `Origin` presente ma
   diverso dall'origine del servizio e non fra le origini ammesse in configurazione (in prod
   nessuna) → 403 `ACCESS_DENIED`.
2. Cookie assente → 401 `REFRESH_TOKEN_INVALID` + cancellazione del cookie.
3. Hash del valore; `SELECT ... FOR UPDATE` per `token_hash`. Non trovato → 401
   `REFRESH_TOKEN_INVALID` + cancellazione.
4. Token revocato:
   - se `replaced_by` è valorizzato e `now − revoked_at ≤ 10 s` (`app.auth.refresh-grace`) → 409
     `REFRESH_CONFLICT`, **senza** emettere token, **senza** revocare nulla e **senza** cancellare il
     cookie (il browser ha già quello nuovo);
   - altrimenti è un riuso → revoca di **tutti** i refresh token dell'utente, 401
     `REFRESH_TOKEN_REUSED` + cancellazione, log di warning (senza il valore del token).
5. Scaduto → 401 `REFRESH_TOKEN_EXPIRED` + cancellazione.
6. Utente non ACTIVE (dopo la riattivazione pigra) → revoca di tutti i suoi token, 403
   `ACCOUNT_SUSPENDED` con i dettagli + cancellazione.
7. Rotazione: nuova riga (10 giorni pieni); vecchia riga `revoked = true`, `revoked_at = now`,
   `replaced_by = nuova`; nuovo access token; `Set-Cookie` con il nuovo valore.

Le revoche dei passi 4 e 6 devono restare salvate anche se la richiesta termina con errore: il
service restituisce un esito e il controller lo traduce nella risposta, invece di lanciare
un'eccezione che annullerebbe la transazione (in alternativa `noRollbackFor`, come in NoseY).

**Concorrenza.** Due refresh simultanei con lo stesso cookie (due schede) vengono serializzati dal
lock di riga: il primo ruota, il secondo trova il token appena sostituito e riceve 409. Il frontend
ritenta una volta dopo un breve intervallo e il browser invia il cookie nuovo. Un attaccante che
presenta il token rubato entro i 10 secondi non ottiene comunque alcun token; oltre i 10 secondi
scatta la revoca totale.

### 4.9 Logout

`DELETE /api/auth/refresh` (cookie + `X-Requested-With`) → sempre 204 + cancellazione del cookie.
Se il cookie corrisponde a un token valido, lo revoca (`revoked_at`, `replaced_by` nullo). Non
richiede il Bearer: è idempotente e funziona anche ad access token scaduto. L'access token già
emesso resta valido fino alla scadenza (massimo 15 minuti, D4): il frontend lo elimina dalla memoria.

### 4.10 Password dimenticata e reset

- `POST /api/auth/password/forgot` `{email}` → sempre 204; invia un codice `PASSWORD_RESET` solo a
  utenti verificati e ACTIVE, con i limiti di 4.6.
- `POST /api/auth/password/reset` `{email, code, newPassword}` → 204. Stesso schema di controlli di
  4.5 (tentativo consumato prima del confronto, confronto a tempo costante). In caso di successo:
  nuovo hash, `code = null`, **revoca di tutti i refresh token**, cancellazione del cookie nella
  risposta, evento `PasswordChangedEmailEvent`. Non effettua il login.

### 4.11 Casi di revoca totale

| Evento | Revoca | Cookie | Altro |
|---|---|---|---|
| Logout | solo il token del dispositivo | cancellato | — |
| Reset della password | tutti | cancellato nella risposta | email di avviso |
| Sospensione | tutti | (non c'è richiesta dell'utente) | chiusura delle sessioni WebSocket dopo il commit |
| Riuso di un token revocato | tutti | cancellato | log di warning |

Pulizia: `@Scheduled(fixedDelay = 24h)` cancella i refresh token scaduti da più di un giorno
(`fixedDelay` gira anche all'avvio, utile perché su Render il servizio si sospende).

### 4.12 Bootstrap del primo SUPERADMIN

`SuperadminBootstrap` (`ApplicationRunner`) all'avvio:

1. Se esiste già una riga `user_roles` con `SUPERADMIN` → non fa nulla.
2. Se `SUPERADMIN_EMAIL` o `SUPERADMIN_PASSWORD` mancano → log di warning e nessuna azione.
3. Password non valida (meno di 8 caratteri o oltre 72 byte) → l'avvio fallisce con un messaggio chiaro.
4. Se esiste un utente con quell'email → gli assegna `SUPERADMIN` (e `FAN` se manca), lo marca
   verificato e ACTIVE e imposta la password dalla variabile d'ambiente.
5. Altrimenti crea l'utente (`display_name` "Superadmin", verificato, ACTIVE, ruoli FAN +
   SUPERADMIN).

Le credenziali non compaiono mai in migrazioni, file versionati o log.

### 4.13 Responsabilità backend / frontend

| Backend | Frontend |
|---|---|
| Emette, ruota, revoca e cancella i refresh token; imposta e cancella il cookie | Tiene l'access token solo nello store Redux (mai `localStorage`) |
| Verifica firma e scadenza dell'access token; carica ruoli e stato dal DB | Chiama `/api/auth/refresh` con `credentials: 'include'` e `X-Requested-With` quando l'access token scade o all'avvio |
| Risponde 409 `REFRESH_CONFLICT` ai refresh concorrenti | Un solo refresh alla volta per scheda; su 409 ritenta una volta |
| Rifiuta i CONNECT STOMP non validi | Nel CONNECT usa sempre l'access token corrente; si riconnette dopo un refresh o su `TOKEN_INVALID` |

---

## 5. Ruoli, utenti e amministrazione

### 5.1 Modello

- `Role` (FAN, MUSICIAN, HOST, ADMIN, SUPERADMIN): una riga `user_roles` per ruolo attivo.
- Ruoli di community (FAN, MUSICIAN, HOST) indipendenti e additivi, senza gerarchia.
- Gerarchia solo di piattaforma: `RoleHierarchy` con `SUPERADMIN > ADMIN`. ADMIN e SUPERADMIN **non**
  ereditano MUSICIAN né HOST.
- Authority Spring Security `ROLE_<ruolo>` per ogni riga; controlli con `hasRole(...)`.

### 5.2 Caricamento a ogni richiesta

`UserAccessService.loadActive(userId)` legge con una sola query utente, stato, `email_verified`,
`suspended_until` e ruoli. Lo usano `JwtFilter` (ogni richiesta REST con Bearer),
`JwtChannelInterceptor` (CONNECT), il controllo a ogni SEND STOMP, login e refresh. Promozioni,
revoche e sospensioni hanno quindi effetto **dalla richiesta successiva**, senza attendere la
scadenza dell'access token.

### 5.3 Attivazione self-service MUSICIAN e HOST

- `POST /api/users/me/roles/musician` e `POST /api/users/me/roles/host` (autenticato) → 200
  `MeResponse`.
- Idempotenti: se il ruolo è già presente, nessuna modifica.
- Uno non implica l'altro. Nessun endpoint per rimuoverli nell'MVP.

### 5.4 Nomina e revoca degli ADMIN (solo SUPERADMIN)

- `POST /api/superadmin/users/{id}/admin` → aggiunge ADMIN; `DELETE` stesso percorso → lo rimuove.
- Regole: utente esistente, verificato e ACTIVE (409 `USER_NOT_VERIFIED`, `USER_NOT_ACTIVE`); mai su
  se stessi; regola dei livelli (5.6). Idempotenti.
- Nessuna revoca di token: i ruoli non sono nel JWT e vengono riletti a ogni richiesta.
- SUPERADMIN non si assegna mai via API.

### 5.5 Sospensione e riattivazione

`POST /api/admin/users/{id}/suspension` `{reason, suspendedUntil?, durationDays?}` → 200
`AdminUserResponse`.

- `reason` obbligatorio (1–500 caratteri). Al massimo uno fra `suspendedUntil` (istante futuro) e
  `durationDays` (1–3650); nessuno dei due = indeterminata. Entrambi → 400 `VALIDATION_ERROR`.
- In una transazione: lock dell'utente, regola dei livelli (5.6), controllo "ultimo SUPERADMIN"
  (409 `LAST_SUPERADMIN`, difesa aggiuntiva), stato SUSPENDED con `suspended_at`, `suspended_by`,
  `suspension_reason`, `suspended_until`; revoca di tutti i refresh token; evento
  `UserSuspendedEvent`.
- Dopo il commit, `UserSuspendedSessionCloser` invia `ACCOUNT_SUSPENDED` su `/user/queue/errors` e
  chiude tutte le sessioni WebSocket dell'utente (sezione 7.8).
- Utente già sospeso: i dettagli vengono aggiornati (es. prolungare la sospensione).

`DELETE /api/admin/users/{id}/suspension` → 200: riattivazione manuale anticipata (ACTIVE, campi di
sospensione svuotati). Idempotente.

**Riattivazione pigra.** Nessun job programmato. Dove `UserAccessService` trova un utente SUSPENDED
con `suspended_until` già passato, esegue
`UPDATE users SET status = 'ACTIVE', suspended_* = NULL WHERE id = ? AND status = 'SUSPENDED' AND
suspended_until <= now` (atomico, sicuro anche con richieste concorrenti) e lo considera attivo.
Succede in login, refresh, `JwtFilter`, CONNECT e SEND STOMP.

### 5.6 Regola dei livelli di piattaforma (P8)

`PlatformLevelPolicy`: livello 2 = SUPERADMIN, 1 = ADMIN, 0 = solo ruoli di community.
Chi agisce può farlo su un bersaglio solo se `bersaglio ≠ sé` e
`livello(bersaglio) < livello(chi agisce)`; altrimenti 403 `INSUFFICIENT_PLATFORM_LEVEL`.

| Azione | ADMIN | SUPERADMIN |
|---|---|---|
| Sospendere/riattivare utenti di community | sì | sì |
| Sospendere/riattivare un ADMIN | no | sì |
| Sospendere un SUPERADMIN | no | no (nessun livello superiore) |
| Nominare/revocare ADMIN | no | sì |
| Nascondere/ripristinare contenuti di utenti di community | sì | sì |
| Nascondere/ripristinare contenuti di un ADMIN | no | sì |

### 5.7 Moderazione dei contenuti e cancellazione del proprietario

Tipi moderabili: `official-concerts`, `indie-events`, `feed-posts`, `collab-posts`.

**Admin** (`/api/admin/moderation/**`, `hasRole("ADMIN")`):

- `POST /{type}/{id}/hide` `{reason}` (obbligatorio, 3–500) → 204. Contenuto già nascosto → 409
  `CONTENT_ALREADY_HIDDEN`. Regola dei livelli sull'autore.
- `POST /{type}/{id}/restore` → 204. Ammesso solo se il contenuto è stato nascosto da un admin
  (`hidden_by ≠ autore`); se l'ha cancellato il proprietario → 409 `RESTORE_NOT_ALLOWED`. Non
  nascosto → 409 `CONTENT_NOT_HIDDEN`.
- `GET /{type}/hidden?page&size` → `PageResponse<HiddenContentResponse>` (id, autore, titolo o
  estratto, `hiddenAt`, `hiddenBy`, `hiddenReason`, `deletedByOwner`), ordinati per `hidden_at` desc.

**Proprietario**: `DELETE /api/<tipo>/{id}` con body facoltativo `{reason}` → 204. Imposta
`hidden_at`, `hidden_by = sé`, `hidden_reason` facoltativo. Non proprietario → 403 `NOT_OWNER`; già
nascosto → 404. Nessuna cancellazione fisica.

---

## 6. Contratti REST

### 6.1 Convenzioni

- Prefisso `/api`, JSON in camelCase, id UUID, date ISO-8601 in UTC (`Instant`).
- **Paginazione uniforme** (offset): parametri `page` (da 0, default 0) e `size` (default 20,
  massimo 100). Risposta `PageResponse<T>`:
  `{content: [...], page, size, totalElements, totalPages}`. Mai il `Page` di Spring.
- **Paginazione a cursore** solo per i messaggi di chat (6.9).
- Ordinamenti fissi per endpoint (nessun parametro `sort` libero): più semplice da proteggere e da
  indicizzare.
- **Aggiornamenti parziali (`PATCH` con body)**: si modificano solo i campi inviati. Campo assente o
  `null` = invariato. Per i campi di testo facoltativi, la stringa vuota (anche dopo il trim) =
  svuota il campo (salvato come `NULL`). I campi obbligatori non si possono svuotare: stringa vuota
  → 400 `VALIDATION_ERROR` (`@NotBlankIfPresent`). I valori non testuali (numeri, coordinate) non
  si svuotano con il `PATCH`: servono endpoint espliciti (es. `DELETE /api/users/me/location`).
  Nell'MVP l'unico `PATCH` con body è `PATCH /api/users/me`; `PATCH .../publish` e `PATCH .../close`
  non hanno body.
- **Errori**: `ErrorResponse`
  `{status, code, error, message, fields, details, timestamp}`. `code` è la stringa stabile su cui
  decide il frontend (mai sul `message`); `fields` solo per `VALIDATION_ERROR`; `details` solo dove
  indicato (es. `ACCOUNT_SUSPENDED`). Mai stack trace o messaggi interni.

### 6.2 Codici d'errore

| Codice | HTTP | Quando |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Bean Validation, body illeggibile, parametri non validi |
| `UNAUTHENTICATED` | 401 | Bearer assente/non valido su endpoint protetto (EntryPoint) |
| `ACCESS_DENIED` | 403 | Ruolo insufficiente, origine non ammessa |
| `NOT_FOUND` | 404 | Risorsa inesistente o nascosta |
| `METHOD_NOT_ALLOWED` | 405 | Metodo non supportato |
| `CONFLICT` | 409 | Vincolo DB generico |
| `TOO_MANY_REQUESTS` | 429 | Limiti di frequenza |
| `INTERNAL_ERROR` | 500 | Errore inatteso (loggato) |
| `EMAIL_ALREADY_REGISTERED` | 409 | Registrazione |
| `ALREADY_VERIFIED` | 409 | Verifica |
| `CODE_INVALID` / `CODE_EXPIRED` | 400 | Verifica, reset |
| `WRONG_PASSWORD` | 400 | Verifica con password diversa |
| `INVALID_CREDENTIALS` | 401 | Login |
| `EMAIL_NOT_VERIFIED` | 403 | Login |
| `ACCOUNT_SUSPENDED` | 403 | Login, refresh, verifica; `details: {suspensionReason, suspendedUntil}` |
| `CSRF_HEADER_MISSING` | 403 | Refresh/logout senza `X-Requested-With` |
| `REFRESH_TOKEN_INVALID` / `REFRESH_TOKEN_EXPIRED` / `REFRESH_TOKEN_REUSED` | 401 | Refresh |
| `REFRESH_CONFLICT` | 409 | Refresh concorrente entro la finestra |
| `INSUFFICIENT_PLATFORM_LEVEL` | 403 | Regola dei livelli, azione su se stessi |
| `LAST_SUPERADMIN` | 409 | Sospensione/revoca dell'ultimo SUPERADMIN |
| `USER_NOT_VERIFIED` / `USER_NOT_ACTIVE` | 409 | Nomina ADMIN |
| `NOT_OWNER` | 403 | Azioni del proprietario |
| `CONTENT_ALREADY_HIDDEN` / `CONTENT_NOT_HIDDEN` / `RESTORE_NOT_ALLOWED` | 409 | Moderazione |
| `ADDRESS_NOT_FOUND` | 400 | Geocodifica senza risultati (`fields.address`) |
| `GEOCODING_UNAVAILABLE` | 502 | Nominatim in timeout o in errore |
| `EVENT_ALREADY_PUBLISHED` | 409 | Pubblicazione di un indie event già pubblicato |
| `EVENT_DATE_PAST` | 400 | Pubblicazione di una bozza con data passata |
| `COLLAB_CLOSED` | 409 | Candidatura su annuncio chiuso |
| `CANNOT_APPLY_OWN_POST` | 400 | Candidatura al proprio annuncio |
| `CANNOT_MESSAGE_SELF` | 400 | Conversazione con se stessi |
| `NOT_CONVERSATION_MEMBER` | 403 | Chat |
| `TOKEN_INVALID` | — | Solo WebSocket |

### 6.3 Accesso

Pubblici (elenco esplicito in `SecurityConfig`, senza wildcard): gli endpoint `POST` di auth e
`POST`/`DELETE /api/auth/refresh`, `GET /api/health`, i `GET` di lettura di eventi, feed, collab e
profili pubblici indicati sotto, `/ws` (autenticazione al CONNECT), `/error`; in F6 `/v3/api-docs/**`
e `/swagger-ui/**`. Sugli endpoint pubblici il Bearer è facoltativo: se presente e valido, l'utente
è riconosciuto (es. `likedByMe` nel feed).

Frontend (D1): le richieste `GET` con percorso **fuori** da `/api/**` e `/ws/**` sono pubbliche
perché servono solo file statici o `index.html`. Un percorso `/api/...` inesistente risponde sempre
404 `NOT_FOUND` in JSON, mai `index.html`.

### 6.4 Auth

| Metodo e percorso | Accesso | Request | Response |
|---|---|---|---|
| `POST /api/auth/register` | pubblico | `{email, password, displayName}` | 201 `{userId, email}` |
| `POST /api/auth/verify` | pubblico | `{email, code, password}` | 200 `LoginResponse` + cookie |
| `POST /api/auth/resend-code` | pubblico | `{email}` | 204 |
| `POST /api/auth/login` | pubblico | `{email, password}` | 200 `LoginResponse` + cookie |
| `POST /api/auth/refresh` | cookie + `X-Requested-With` | — | 200 `LoginResponse` + cookie |
| `DELETE /api/auth/refresh` | cookie + `X-Requested-With` | — | 204 + cookie cancellato |
| `POST /api/auth/password/forgot` | pubblico | `{email}` | 204 |
| `POST /api/auth/password/reset` | pubblico | `{email, code, newPassword}` | 204 + cookie cancellato |

`LoginResponse` = `{accessToken, accessTokenExpiresAt, user: MeResponse}`.
`MeResponse` = `{id, email, displayName, avatarUrl, bio, city, latitude, longitude, roles: [...],
status, createdAt}`.

Validazioni: email `@Email` max 255; password 8–72 caratteri e 72 byte; `displayName` 2–50; `code`
`\d{6}`.

### 6.5 Utenti

| Metodo e percorso | Accesso | Request | Response |
|---|---|---|---|
| `GET /api/users/me` | autenticato | — | `MeResponse` |
| `PATCH /api/users/me` | autenticato | `{displayName?, avatarUrl?, bio?, city?, latitude?, longitude?}` | 200 `MeResponse` |
| `DELETE /api/users/me/location` | autenticato | — | 200 `MeResponse` (`latitude` e `longitude` a `null`) |
| `POST /api/users/me/roles/musician` | autenticato | — | `MeResponse` |
| `POST /api/users/me/roles/host` | autenticato | — | `MeResponse` |
| `GET /api/users/{id}` | pubblico | — | `PublicUserResponse {id, displayName, avatarUrl, bio, city, roles (solo community)}` |

Regole di `PATCH /api/users/me` (sezione 6.1):

| Campo | Assente o `null` | Stringa vuota | Valore |
|---|---|---|---|
| `displayName` | invariato | 400 `VALIDATION_ERROR` | 2–50 caratteri |
| `bio` | invariato | svuota | massimo 500 |
| `city` | invariato | svuota | massimo 100 |
| `avatarUrl` | invariato | svuota | URL http/https, massimo 2048 |
| `latitude` + `longitude` | invariate se assenti o `null` **entrambe** | — | **entrambe** presenti, latitudine −90..90, longitudine −180..180; una sola → 400 `VALIDATION_ERROR` |

Body vuoto `{}` → 200 senza modifiche. Per smettere di condividere la posizione serve
`DELETE /api/users/me/location` (idempotente), perché nel `PATCH` `null` significa "invariato".
Un utente non verificato non è visibile in `GET /api/users/{id}` (404); le coordinate non compaiono
mai nel profilo pubblico.

### 6.6 Eventi

| Metodo e percorso | Accesso | Note |
|---|---|---|
| `POST /api/official-concerts` | `hasRole("HOST")` | 201 `OfficialConcertResponse`; geocodifica di `address` |
| `GET /api/official-concerts/nearby?lat&lng&radiusKm&page&size` | pubblico | solo futuri e non nascosti; per distanza, poi data |
| `GET /api/official-concerts/{id}` | pubblico | 404 se nascosto |
| `DELETE /api/official-concerts/{id}` | proprietario | soft delete (5.7) |
| `POST /api/indie-events` | `hasRole("MUSICIAN")` | 201; `status` facoltativo, default `PUBLISHED` |
| `GET /api/indie-events/nearby?lat&lng&radiusKm&page&size` | pubblico | solo `PUBLISHED`, futuri, non nascosti |
| `GET /api/indie-events/mine?page&size` | autenticato | bozze e pubblicati del chiamante, non nascosti |
| `GET /api/indie-events/{id}` | pubblico | una bozza è visibile solo al proprietario (altrimenti 404) |
| `PATCH /api/indie-events/{id}/publish` | proprietario | 200; già pubblicato → 409; data passata → 400 |
| `DELETE /api/indie-events/{id}` | proprietario | soft delete |

Request di creazione: `{title (3–150), description? (≤5000), venueName (≤150), address (≤255),
eventDate (futuro), genreTags (≤10 tag, ciascuno 1–30, normalizzati in minuscolo e senza
duplicati), coverImageUrl?, externalTicketUrl? (solo concerti), isFree (solo indie), status? (solo
indie)}`.

Response: `{id, host|musician: AuthorSummary {id, displayName, avatarUrl}, title, description,
venueName, address, latitude, longitude, eventDate, genreTags, coverImageUrl, externalTicketUrl |
isFree + status, createdAt, distanceKm}`. `distanceKm` è valorizzato solo nelle ricerche nearby.

Parametri nearby: `lat` −90..90, `lng` −180..180 (obbligatori), `radiusKm` 0,1–200 (default 25).

### 6.7 Collaborazioni

| Metodo e percorso | Accesso | Note |
|---|---|---|
| `POST /api/collab-posts` | `hasRole("MUSICIAN")` | `{title, description, roleNeeded, genreTags, location?}` → 201 |
| `GET /api/collab-posts?page&size` | pubblico | solo aperti e non nascosti, dal più recente |
| `GET /api/collab-posts/{id}` | pubblico | anche chiusi; 404 se nascosto |
| `PATCH /api/collab-posts/{id}/close` | proprietario | `is_open = false`, idempotente → 200 |
| `DELETE /api/collab-posts/{id}` | proprietario | soft delete |
| `POST /api/collab-posts/{id}/applications` | autenticato | `{message (1–2000)}` → 201 `{conversationId, messageId}` |

Candidatura (P6): annuncio esistente e non nascosto (404), aperto (409 `COLLAB_CLOSED`), autore ≠
candidato (400 `CANNOT_APPLY_OWN_POST`), limite `COLLAB_APPLICATIONS`. Nella stessa transazione:
trova o crea la conversazione candidato–autore e salva un messaggio con testo
`Candidatura per «<titolo>»:` seguito dal messaggio. Dopo il commit: messaggio su
`/user/queue/messages` a entrambi e notifica `COLLAB_APPLICATION` all'autore (non anche
`NEW_MESSAGE`, per non contarla due volte).

### 6.8 Feed e like

| Metodo e percorso | Accesso | Note |
|---|---|---|
| `POST /api/feed-posts` | autenticato | `{body (1–2000), imageUrl?, latitude?, longitude?}` → 201 |
| `GET /api/feed-posts?lat&lng&radiusKm&page&size` | pubblico | dal più recente; con il filtro geografico (tutti e tre i parametri o nessuno) solo post con coordinate nel raggio |
| `GET /api/feed-posts/{id}` | pubblico | 404 se nascosto |
| `DELETE /api/feed-posts/{id}` | proprietario | soft delete |
| `PUT /api/feed-posts/{id}/like` | autenticato | 200 `{likesCount, likedByMe: true}`, idempotente |
| `DELETE /api/feed-posts/{id}/like` | autenticato | 200 `{likesCount, likedByMe: false}`, idempotente |

`FeedPostResponse` = `{id, author: AuthorSummary, body, imageUrl, latitude, longitude, likesCount,
likedByMe, createdAt, distanceKm}`. Nuovo like (inserimento effettivo, autore ≠ chi mette like) →
notifica `NEW_LIKE` all'autore dopo il commit. Limite noto dell'MVP: con la paginazione a offset,
post nuovi pubblicati durante lo scorrimento possono spostare gli elementi fra le pagine.

### 6.9 Chat (REST)

| Metodo e percorso | Accesso | Note |
|---|---|---|
| `GET /api/chats?page&size` | autenticato | `PageResponse<ConversationResponse>` per `last_message_at` desc (nulli in fondo) |
| `POST /api/chats` | autenticato | `{recipientId}` → 200 `ConversationResponse` (trova o crea); destinatario inesistente o non verificato → 404; se stessi → 400 |
| `GET /api/chats/{id}/messages?before&size` | membro | cursore: `{messages: [...], hasMore}` dal più recente; `before` = id del messaggio più vecchio già caricato; `size` 1–100, default 30 |
| `PATCH /api/chats/{id}/read` | membro | 204: `read_at = now` sui messaggi dell'altro non letti |

`ConversationResponse` = `{id, otherUser: AuthorSummary, lastMessage: {body, senderId, sentAt} | null,
unreadCount, lastMessageAt}`. Non membro → 403 `NOT_CONVERSATION_MEMBER`; `before` di un'altra
conversazione → 404. Creazione concorrente della stessa coppia gestita con
`INSERT ... ON CONFLICT DO NOTHING` sulla coppia canonica e rilettura. Il cursore riusa la query di
NoseY: confronto su `(sent_at, id)` letto dal database nella stessa query. Limite
`CONVERSATIONS_CREATED` sulle nuove conversazioni.

### 6.10 Amministrazione

| Metodo e percorso | Accesso | Note |
|---|---|---|
| `GET /api/admin/users?search&status&page&size` | ADMIN | ricerca su email e displayName; `AdminUserResponse` |
| `POST /api/admin/users/{id}/suspension` | ADMIN | 5.5 |
| `DELETE /api/admin/users/{id}/suspension` | ADMIN | 5.5 |
| `POST /api/superadmin/users/{id}/admin` | SUPERADMIN | 5.4 |
| `DELETE /api/superadmin/users/{id}/admin` | SUPERADMIN | 5.4 |
| `POST /api/admin/moderation/{type}/{id}/hide` | ADMIN | 5.7 |
| `POST /api/admin/moderation/{type}/{id}/restore` | ADMIN | 5.7 |
| `GET /api/admin/moderation/{type}/hidden?page&size` | ADMIN | 5.7 |

`AdminUserResponse` = `{id, email, displayName, roles, status, emailVerified, createdAt,
suspendedAt, suspendedBy, suspensionReason, suspendedUntil}`. La gerarchia fa passare un
SUPERADMIN anche su `/api/admin/**`.

### 6.11 Tecnici

`GET /api/health` (pubblico) → `{status: "UP", database: "UP"}` dopo una `SELECT 1`; 503 se il
database non risponde. È il `healthCheckPath` di Render.

### 6.12 CORS

In produzione frontend e API hanno la stessa origine (D1): il browser non applica il CORS e
**nessuna origine esterna è ammessa**. Di conseguenza ogni richiesta cross-origin con credenziali o
con l'header `X-Requested-With` fallisce al preflight: è la restrizione richiesta dal brief (§4.6),
nella forma più stretta possibile.

`CorsConfig` su `/api/**` resta per lo sviluppo e per eventuali configurazioni future: origini da
`ALLOWED_ORIGIN` (lista separata da virgole; vuota in prod; `http://localhost:5173` in dev per chi
chiama il backend senza proxy Vite), `allowCredentials(true)`, metodi `GET, POST, PATCH, DELETE,
OPTIONS` (più `PUT` per il like), header `Authorization, Content-Type, X-Requested-With`, `maxAge`
3600. Con le credenziali le origini devono essere esplicite (mai `*`). Le stesse origini valgono per
l'handshake WebSocket; le richieste della stessa origine sono sempre ammesse.

### 6.13 MVP e fasi successive

Tutti gli endpoint di questa sezione sono MVP. Non esistono nell'MVP: modifica dei contenuti,
rimozione dei ruoli MUSICIAN/HOST, upload di immagini, follow, recensioni, ticket, storico delle
notifiche, appeal delle sospensioni (sezione 15).

---

## 7. Contratti WebSocket/STOMP

### 7.1 Connessione e broker

- Endpoint `/ws`, WebSocket nativo senza SockJS. In produzione il frontend si collega alla stessa
  origine (`wss://<servizio>.onrender.com/ws`); in sviluppo passa dal proxy Vite (`ws: true`) e
  l'origine `http://localhost:5173` è ammessa da configurazione.
- Simple broker su `/queue`; prefisso applicativo `/app`; prefisso utente `/user`.
- Il `Principal` di sessione è `AuthenticatedUser` (`getName()` = id utente), quindi
  `convertAndSendToUser(userId, ...)` raggiunge tutte le sessioni di quell'utente.

### 7.2 CONNECT

Header nativo `Authorization: Bearer <accessToken>`. `JwtChannelInterceptor`:

1. Verifica firma e scadenza del JWT.
2. `UserAccessService.loadActive` dal database: utente esistente, verificato e ACTIVE (con
   riattivazione pigra); ruoli caricati dal DB, mai dai claim.
3. Successo: `accessor.setUser(AuthenticatedUser{id, roles, accessTokenExpiresAt})`.
4. Errore: `AppException` (`TOKEN_INVALID` o `ACCOUNT_SUSPENDED`) → `StompErrorHandler` invia un
   frame ERROR (header `message` = codice, body `WsError`) e Spring chiude la connessione.

### 7.3 Regole sui frame

- SEND ammesso solo verso `/app/**`.
- SUBSCRIBE ammesso solo verso `/user/queue/messages`, `/user/queue/notifications`,
  `/user/queue/errors`.
- Frame non ammesso → scartato, errore `ACCESS_DENIED` su `/user/queue/errors` della sola sessione,
  connessione aperta. SEND o SUBSCRIBE senza CONNECT valido → `TOKEN_INVALID` e chiusura.

### 7.4 Destinazioni

| Direzione | Destinazione | Payload |
|---|---|---|
| client → server | `/app/chats/{conversationId}/send` | `{body}` |
| server → client | `/user/queue/messages` | `ChatMessageResponse {id, conversationId, senderId, body, sentAt, readAt}` |
| server → client | `/user/queue/notifications` | `LiveNotification {type, createdAt, actor: AuthorSummary, targetId, preview}` |
| server → client | `/user/queue/errors` | `WsError {code, message}` |

`LiveNotification.type`: `NEW_LIKE` (`targetId` = post), `NEW_MESSAGE` (`targetId` = conversazione,
`preview` = primi 100 caratteri), `COLLAB_APPLICATION` (`targetId` = annuncio).

### 7.5 Invio di un messaggio

`ChatWebSocketController` (`@MessageMapping("/chats/{conversationId}/send")`, payload facoltativo e
senza `@Valid`) delega a `ChatService.send`, che esegue i controlli **in questo ordine** (come NoseY):

1. **Token** (P9): `accessTokenExpiresAt` del Principal ancora nel futuro e utente ancora ACTIVE nel
   DB → altrimenti `TOKEN_INVALID` (o `ACCOUNT_SUSPENDED`).
2. **Rate limit** `CHAT_MESSAGES` (30 al minuto per utente) → `TOO_MANY_REQUESTS`.
3. **Validazione del body** (`body` 1–2000, non vuoto) con il `Validator` → `VALIDATION_ERROR`.
4. Conversazione esistente (`NOT_FOUND`) e chiamante membro (`NOT_CONVERSATION_MEMBER`).
5. Salvataggio del messaggio, aggiornamento di `last_message_at`, pubblicazione di
   `ChatMessageEvent` e `LiveNotificationEvent(NEW_MESSAGE)`.

Il controller non risponde mai direttamente: gli errori passano dal `WebSocketExceptionHandler`
(`@MessageExceptionHandler` + `@SendToUser("/queue/errors", broadcast = false)`), solo alla sessione
che ha inviato, connessione aperta.

### 7.6 Notifiche dopo il commit

Pattern di NoseY: il service pubblica l'evento **dentro** la transazione; i listener con
`@TransactionalEventListener(phase = AFTER_COMMIT)` chiamano `convertAndSendToUser`. Se la
transazione fallisce non parte nulla. Le notifiche non vengono salvate: un utente offline non le
riceve (storico in Post-V1).

### 7.7 Scadenza dell'access token durante la connessione (P9)

Dopo 15 minuti il Principal ha un token scaduto: la ricezione (SUBSCRIBE già attive) continua, ma
il primo SEND riceve `TOKEN_INVALID`. Il frontend si riconnette con l'access token corrente (con
`@stomp/stompjs`: `beforeConnect` legge il token dallo store, eventualmente dopo un refresh). In
pratica conviene riconnettersi subito dopo ogni refresh riuscito.

### 7.8 Sospensione e chiusura delle sessioni

- `WebSocketSessionRegistry` tiene la mappa id utente → sessioni WebSocket aperte. È alimentata da un
  decorator dell'handler WebSocket (registrato in `configureWebSocketTransport`) e dagli eventi
  `SessionConnectedEvent` / `SessionDisconnectEvent`.
- `UserSuspendedSessionCloser` ascolta `UserSuspendedEvent` dopo il commit: invia `ACCOUNT_SUSPENDED`
  su `/user/queue/errors` e chiude le sessioni con `CloseStatus.POLICY_VIOLATION`.
- Difesa aggiuntiva: anche se una chiusura fallisse, il controllo a ogni SEND (7.5, passo 1)
  rifiuta l'utente sospeso, e un nuovo CONNECT viene respinto.

### 7.9 Riconnessione e piano gratuito Render

- Il servizio gratuito si sospende dopo circa 15 minuti senza traffico HTTP: le connessioni
  WebSocket cadono e il primo accesso successivo richiede circa un minuto di avvio.
- Il frontend usa la riconnessione automatica di stompjs (`reconnectDelay` di qualche secondo) e
  rifà le SUBSCRIBE a ogni connessione.
- Nessuna promessa di disponibilità continua: per la demo il servizio si risveglia prima
  (sezione 12.7).

### 7.10 Verifica

STOMP non va nella collection Postman. Si verifica con test di integrazione Spring
(`WebSocketStompClient` su porta casuale, come `ChatWebSocketTest` di NoseY) e, facoltativamente,
con una pagina HTML minima con client STOMP in `tools/stomp-test/index.html`, fuori dal codice di
produzione.

---

## 8. Sicurezza e autorizzazioni

### 8.1 SecurityFilterChain

Stateless (`SessionCreationPolicy.STATELESS`), `httpBasic`, `formLogin` e `logout` disattivati,
`UserDetailsServiceAutoConfiguration` esclusa, `PasswordEncoder` BCrypt. Il CSRF di Spring è
disattivato perché l'autenticazione delle API viaggia nell'header `Authorization`, che il browser
non invia mai da solo; l'unico endpoint basato su cookie (refresh/logout) ha la protezione dedicata
di 8.5.

### 8.2 JwtFilter e AuthenticationEntryPoint

`JwtFilter` (non è un `@Component`, per non essere registrato due volte):

- Nessun Bearer o token non valido/scaduto → **prosegue senza autenticare**. Il 401
  `UNAUTHENTICATED` lo produce l'`AuthenticationEntryPoint` solo sugli endpoint protetti, così un
  token vecchio non blocca le pagine pubbliche.
- Token valido → `UserAccessService.loadActive`: utente inesistente, non verificato o sospeso →
  nessuna autenticazione (il frontend scopre la sospensione al refresh, che risponde
  `ACCOUNT_SUSPENDED` con i dettagli).
- Altrimenti `SecurityContext` con `AuthenticatedUser` e una authority `ROLE_*` per ruolo.

`AccessDeniedHandler` → 403 `ACCESS_DENIED`. Entrambi scrivono un `ErrorResponse`.

### 8.3 Regole di autorizzazione

- URL in `SecurityConfig`: `/api/admin/**` → `hasRole("ADMIN")`; `/api/superadmin/**` →
  `hasRole("SUPERADMIN")`; `POST /api/official-concerts` → `hasRole("HOST")`;
  `POST /api/indie-events` e `POST /api/collab-posts` → `hasRole("MUSICIAN")`; endpoint pubblici
  elencati uno per uno; tutto il resto `authenticated()`.
- Nel service: proprietà dei contenuti (`NOT_OWNER`), appartenenza alla conversazione, regola dei
  livelli.
- Permessi di community e di piattaforma restano separati: un ADMIN senza HOST non pubblica concerti.

### 8.4 Endpoint pubblici

Elenco esplicito per metodo e percorso, senza pattern generici, per tutti gli endpoint `/api/**`
(sezione 6.3). Unica regola generale: `GET` fuori da `/api/**` e `/ws/**` (file statici del
frontend e `index.html`, che non contengono dati). È una conseguenza della nuova D1: il vincolo
"senza wildcard" del brief resta rispettato per le API, che sono le uniche risorse con dati.

### 8.5 Cookie, CSRF e CORS

Il refresh e il logout si basano su un cookie, quindi un sito malevolo potrebbe provare a farli
eseguire al browser della vittima. Difese indipendenti:

1. `SameSite=Lax`: il browser non invia il cookie nelle richieste `POST`/`DELETE` partite da un
   altro sito.
2. Header custom `X-Requested-With` obbligatorio: un form HTML non può aggiungerlo; un `fetch`
   cross-origin con quell'header richiede un preflight CORS, che il backend nega alle origini non
   ammesse.
3. CORS ristretto: in produzione frontend e API hanno la stessa origine e nessuna origine esterna è
   ammessa (sezione 6.12); `allowCredentials` resta configurato per lo sviluppo.
4. Controllo lato server dell'header `Origin`, se presente: deve essere l'origine del servizio o una
   di quelle configurate.

Il cookie non è considerato protetto solo perché HttpOnly: HttpOnly impedisce a JavaScript di
leggerlo, non al browser di inviarlo. Access token e refresh token non viaggiano mai sullo stesso
canale.

### 8.6 Validazione dell'input

Bean Validation sui DTO (lunghezze, formati, range); normalizzazione nel costruttore dei record;
URL validati con `@HttpUrl` (solo `http`/`https`, massimo 2048): blocca gli URL `javascript:`. Il
testo libero è salvato com'è e restituito come JSON: la sanificazione in visualizzazione spetta al
frontend (DOMPurify); il backend non produce HTML, tranne le email, dove Thymeleaf fa l'escape con
`th:text`. Query solo con parametri legati (JPQL o native con `:param`), mai concatenazioni.

### 8.7 Immagini

Solo URL (D2). Nessun upload, nessun controllo dei byte nell'MVP; il controllo dei primi byte di
NoseY resta un riferimento per Post-V1.

### 8.8 Limiti di frequenza

`RateLimitService` in memoria, finestra scorrevole, chiave per email o id utente (si azzera al
riavvio: accettabile con una sola istanza). Valori in `application.yml` (`app.rate-limits.*`):

| Limite | Valore | Chiave |
|---|---|---|
| `LOGIN_FAILED` | 10 in 15 minuti | email |
| `CHAT_MESSAGES` | 30 al minuto | utente |
| `CONVERSATIONS_CREATED` | 20 in 24 ore | utente |
| `COLLAB_APPLICATIONS` | 10 in 24 ore | utente |

I limiti sui codici email sono nel database (sezione 4.6), quindi sopravvivono ai riavvii.

### 8.9 Segreti e log

- Segreti solo da variabili d'ambiente: `JWT_SECRET` (nessun default, almeno 32 byte),
  `SUPERADMIN_*`, `BREVO_API_KEY`, `DATABASE_URL`.
- Mai nei log: password, hash, access e refresh token, `DATABASE_URL` completa (`DatabaseUrl`
  stampa l'URL JDBC senza credenziali), corpo delle richieste a Brevo. Eccezione voluta: in dev
  `LogEmailService` scrive il codice di verifica nel log (non è attivo in prod).
- `spring.mvc.log-resolved-exception: false`: evita che la validazione finisca nel log con il
  valore rifiutato (es. una password).

### 8.10 Nessuna blacklist degli access token (D4)

Una sospensione o una revoca di ruolo hanno effetto alla richiesta successiva, perché il filtro
rilegge stato e ruoli dal database. L'unico caso in cui un access token resta utilizzabile dopo che
l'utente "è uscito" è il logout: al massimo 15 minuti, solo se il token è stato copiato prima.
Questo rischio residuo è accettato in cambio di zero scritture e zero tabelle aggiuntive a ogni
richiesta.

---

## 9. Email

- Eventi pubblicati nella transazione: `VerificationCodeEmailEvent`, `PasswordResetCodeEmailEvent`,
  `PasswordChangedEmailEvent` (record con destinatario, displayName ed eventuale codice).
- `EmailEventListener`: `@Async` + `@TransactionalEventListener(AFTER_COMMIT)` → l'email parte solo
  dopo il commit, senza rallentare la risposta; se l'invio fallisce si scrive nel log e la
  richiesta resta valida.
- `EmailService` con due implementazioni scelte dal profilo:
  - `LogEmailService` (`@Profile("!prod")`): scrive nel log, codice compreso, per sviluppare senza
    credenziali.
  - `BrevoEmailService` (`@Profile("prod")`): `POST https://api.brevo.com/v3/smtp/email` con
    `RestClient`, header `api-key`, timeout di 5 secondi; Render gratuito blocca SMTP, HTTPS no.
    Chiave o mittente mancanti → errore nel log, nessun invio.
- `HtmlEmailService`: oggetto e corpo HTML dai template Thymeleaf in `templates/mail/`
  (`verification-code.html`, `password-reset-code.html`, `password-changed.html`), in italiano,
  mittente "Resonance".
- Configurazione: `MAIL_FROM` (mittente confermato in Brevo), `BREVO_API_KEY`; nessun valore nei
  file versionati.

---

## 10. Geolocalizzazione

### 10.1 Geocodifica (D3)

- Interfaccia `GeocodingService.geocode(address) → GeoPoint(lat, lng)`; implementazione
  `NominatimGeocodingService`.
- Richiesta: `GET https://nominatim.openstreetmap.org/search?q=<address>&format=jsonv2&limit=1`,
  header `User-Agent: Resonance/1.0 (<GEOCODING_CONTACT>)` e `Accept-Language: it`.
- `RestClient` con client JDK: timeout di connessione 2 s e di lettura 3 s.
- **Una richiesta al secondo**: un lock condiviso garantisce almeno 1 secondo fra due chiamate (una
  sola istanza dell'applicazione); chi arriva prima del secondo attende il proprio turno.
- Esiti: lista vuota → 400 `ADDRESS_NOT_FOUND` (`fields.address`); timeout, errore di rete, risposta
  5xx o 429 → 502 `GEOCODING_UNAVAILABLE`. In entrambi i casi l'evento non viene salvato.
- La chiamata HTTP avviene **fuori** dalla transazione del database: prima si geocodifica, poi si
  apre la transazione di salvataggio, così una connessione al DB non resta occupata in attesa di
  Nominatim.
- Nel profilo `test` un `GeocodingService` stub sostituisce Nominatim.

### 10.2 Ricerca nelle vicinanze

Parametri `lat`, `lng`, `radiusKm`, `page`, `size`. Query nativa:

1. Prefiltro a bounding box sugli indici `(latitude, longitude)`: latitudine ± `radiusKm / 111.045`;
   longitudine ± `radiusKm / (111.045 · cos(lat))`.
2. Distanza esatta con la formula di Haversine in SQL (raggio terrestre 6371 km), la stessa della
   classe `Haversine`.
3. `WHERE distanza <= radiusKm` più i filtri del contenuto (non nascosto, futuro, `PUBLISHED` per gli
   indie event).
4. `ORDER BY distanza, event_date, id`, `LIMIT/OFFSET`; una query di conteggio con gli stessi filtri
   per `totalElements`.

Lo stesso meccanismo, ordinato per `created_at DESC`, serve il filtro facoltativo del feed.

Le funzioni basate sulla distanza usano **solo** `lat`/`lng` passati nella richiesta, mai le
coordinate salvate nel profilo: le ricerche nearby degli eventi li richiedono come parametri
obbligatori; nel feed, senza parametri, il filtro per raggio non si applica. Se l'utente non ha
condiviso la posizione, il frontend può chiedere quella del browser o mostrare i risultati senza
filtro. Gli utenti non hanno ricerca geografica nell'MVP. I casi limite
(poli, antimeridiano) non sono gestiti: il servizio è pensato per l'Italia.

### 10.3 Classe Haversine

Riusata da NoseY (`Haversine.km`). Nell'MVP fa da oracolo nei test: verifica che le distanze
calcolate dalla query SQL coincidano con quelle calcolate in Java.

---

## 11. Test

### 11.1 Strategia

- **Unit test** JUnit 5 + AssertJ, senza Spring, con `Clock` fisso o mutabile: `Haversine`,
  `PlatformLevelPolicy`, `RefreshCookieFactory`, `RateLimitService`, logica dei codici email,
  parsing di `DatabaseUrl`, normalizzazione dei DTO.
- **Test di integrazione** `@SpringBootTest` + MockMvc sul database `resonance_test` (P10): Flyway
  applica le migrazioni all'avvio (verifica anche le migrazioni), `ddl-auto: validate` verifica le
  entity. Pulizia fra i test con `TRUNCATE ... CASCADE`. Un bean `MutableClock` di test permette di
  "far passare il tempo" (15 minuti, 10 secondi, `suspended_until`). Email catturate con
  `@RecordApplicationEvents` per leggere i codici.
- **Test STOMP**: `WebSocketStompClient` su porta casuale.
- **Nominatim**: `MockRestServiceServer` per il client reale; stub nel resto dei test.

### 11.2 Casi obbligatori (per card)

| Area | Casi |
|---|---|
| Codici email | scadenza a 15 minuti, 5 tentativi, tentativo consumato anche se la verifica fallisce, limite di 60 s e di 5 in 24 h, confronto corretto |
| Login | credenziali errate, non verificato, sospeso con dettagli, sospensione scaduta → riattivazione pigra, limite dei fallimenti |
| Refresh | rotazione (vecchio revocato, nuovo con 10 giorni), scaduto, sconosciuto, riuso → revoca totale, concorrente entro 10 s → 409 senza revoche, header mancante → 403, attributi del cookie per profilo |
| Logout e reset | revoca del solo token / di tutti, cookie cancellato |
| JwtFilter | nessun token, token malformato, scaduto, utente sospeso, ruoli letti dal DB (promozione efficace subito) |
| Profilo | `PATCH`: campo assente o `null` invariato, stringa vuota svuota i facoltativi, `displayName` vuoto → 400, una sola coordinata → 400; `DELETE /location` |
| Fallback SPA | percorso del frontend → `index.html`; file statico servito; `/api/...` inesistente → 404 JSON |
| Ruoli | utente FAN+MUSICIAN+HOST pubblica entrambi gli eventi; ADMIN senza HOST → 403; SUPERADMIN passa su `/api/admin/**`; self-service non può assegnare ADMIN |
| Amministrazione | regola dei livelli, ultimo SUPERADMIN, sospensione con durata o data, riattivazione manuale |
| Bootstrap | crea un solo SUPERADMIN; secondo avvio senza effetti |
| Moderazione | contenuti nascosti esclusi da liste e dettaglio, motivo obbligatorio per admin, ripristino, ripristino vietato per cancellazioni del proprietario |
| Eventi | indirizzo non trovato, Nominatim non disponibile, bozza invisibile agli altri, pubblicazione |
| Haversine | distanze note (es. Firenze–Roma), raggio, paginazione, SQL ≈ Java |
| Feed | like idempotente, `likes_count` corretto con like concorrenti, filtro geografico |
| Chat | cursore (prima pagina, pagine successive, `hasMore`, `before` estraneo), non membro, ordine dei controlli STOMP (token → limite → body) |
| WebSocket | CONNECT senza token o con token scaduto, SUBSCRIBE non ammessa, messaggio a entrambi, chiusura delle sessioni alla sospensione |
| Notifiche | consegnate dopo il commit; nessuna consegna in caso di rollback; nessuna notifica a se stessi |

I test si scrivono nella card che introduce la funzionalità, non alla fine.

### 11.3 Postman e STOMP

Collection v2.1 in `postman/resonance.postman_collection.json` con cartelle Auth, Users, Admin,
Events, Collab, Feed, Chat; environment `local` e `render` con `baseUrl`; lo script di test del login
salva `accessToken`; il refresh usa il cookie jar di Postman (che non è soggetto a CORS: aggiunge
manualmente `X-Requested-With`). Per ogni endpoint: una richiesta di successo e almeno un errore
significativo. Nessun segreto nei file. Per la cartella Users sono previste: `PATCH /api/users/me`
con un solo campo (gli altri restano invariati), con `bio: ""` (svuota), con `displayName: ""` (400),
con una sola coordinata (400), con entrambe le coordinate; `DELETE /api/users/me/location`;
`PATCH` senza token (401). STOMP solo nei test di integrazione e nella pagina HTML
facoltativa.

---

## 12. Deploy e configurazione

### 12.1 PostgreSQL locale

`docker-compose.yml` nella radice: immagine `postgres:17` (stessa versione maggiore del database
Render da verificare alla creazione), porta `"127.0.0.1:5433:5432"` (solo sul computer locale; il
PostgreSQL di Windows occupa la 5432), database `resonance`, utente e password di sviluppo non sensibili, volume persistente
`resonance-db-data`, script di init `docker/postgres/init/01-create-test-db.sql` che crea
`resonance_test`. Connessione da pgAdmin su `localhost:5433`.

### 12.2 Profili e Flyway

Profili `dev`, `prod`, `test` (sezione 2.3). Flyway applica le migrazioni all'avvio;
`ddl-auto: validate`; mai `update`.

### 12.3 DatabaseUrl

`ResonanceApplication.main` chiama `DatabaseUrl.applyIfPresent()` prima di avviare Spring: converte
`DATABASE_URL` di Render (`postgresql://utente:password@host:porta/db`) in URL JDBC con
`sslmode=require` e credenziali separate; stampa solo l'URL JDBC, mai la password.

### 12.4 Variabili d'ambiente

| Variabile | Dove | Obbligatoria | Note |
|---|---|---|---|
| `SPRING_PROFILES_ACTIVE` | dev/prod | sì | `dev` in locale, `prod` su Render |
| `PORT` | prod | no | impostata da Render; default 8080 |
| `DATABASE_URL` | prod | sì | collegata al database dal Blueprint |
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | dev | no | override dei default di sviluppo |
| `JWT_SECRET` | tutti | sì | almeno 32 byte; generato da Render; in locale nella configurazione di avvio di IntelliJ |
| `ACCESS_TOKEN_TTL` | tutti | no | default `15m` |
| `REFRESH_TOKEN_TTL` | tutti | no | default `10d` |
| `ALLOWED_ORIGIN` | dev | no | origini esterne ammesse (CORS e handshake WebSocket); default dev `http://localhost:5173`; in prod non impostata (stessa origine) |
| `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD` | prod (e dev) | per il bootstrap | segreti `sync: false` |
| `BREVO_API_KEY`, `MAIL_FROM` | prod | sì | segreti |
| `GEOCODING_CONTACT` | tutti | sì | contatto nello User-Agent di Nominatim |

### 12.5 Dockerfile e render.yaml

- **Dockerfile** in `Resonance_BE/Dockerfile`, multi-stage, con **contesto di build alla radice del
  repository** (deve poter leggere sia `Resonance_BE` sia `Resonance_FE`):
  1. stage Node (`node:<LTS>`): `npm ci` e `npm run build` di `Resonance_FE` → `dist/`.
     **Aggiunto solo con la card FE-01**: fino al 20 ottobre `Resonance_FE` non esiste e il
     Dockerfile ha solo gli stage 2 e 3.
  2. stage JDK (`eclipse-temurin:25-jdk`, da NoseY): cache delle dipendenze Maven
     (`dependency:go-offline`), copia di `dist/` in `src/main/resources/static/` (quando c'è lo
     stage Node), `mvnw -DskipTests package`.
  3. stage JRE (`eclipse-temurin:25-jre`, da NoseY): solo il jar, `EXPOSE 8080`,
     `-XX:MaxRAMPercentage=75` per i 512 MB del piano gratuito.
- **`.dockerignore` alla radice del repository** (il contesto è la radice): esclude `.git`, `docs`,
  `postman`, `**/target`, `**/node_modules`, `**/dist`, `.idea`. Le regole di NoseY sono incluse.
- **Fallback SPA** (`SpaResourceConfig`, package `web`): risorse statiche da `classpath:/static/`;
  un percorso senza file corrispondente e senza estensione, fuori da `api/` e `ws`, restituisce
  `index.html` (routing di React Router). `index.html` con `Cache-Control: no-cache`, file in
  `/assets/` (nomi con hash di Vite) con cache lunga. Senza frontend (fino al 20 ottobre) non c'è
  `index.html` e questi percorsi rispondono 404 JSON.
- **`render.yaml`** nella radice, adattato da NoseY: database `resonance-db` (free, Frankfurt) e **un
  solo servizio web** `resonance` (`runtime: docker`, `dockerContext: .`,
  `dockerfilePath: ./Resonance_BE/Dockerfile`, `branch: main`, deploy automatico,
  `healthCheckPath: /api/health`, `buildFilter` su `Resonance_BE/**`, `Resonance_FE/**`,
  `.dockerignore` e `render.yaml`), variabili della tabella 12.4 (`JWT_SECRET` con
  `generateValue: true`, segreti con `sync: false`, nessun `ALLOWED_ORIGIN`), commenti di NoseY su
  WebSocket, profilo prod e Brevo, adattati alla stessa origine. Nessun servizio statico separato e
  nessun dominio personalizzato. Il nome del servizio determina l'indirizzo
  `https://<servizio>.onrender.com`, assegnato da Render alla creazione.
- **Sviluppo locale con il frontend** (dal 20 ottobre): backend con `mvnw spring-boot:run` (profilo
  dev, porta 8080); frontend con il dev server Vite su `localhost:5173`, con proxy di `/api` e `/ws`
  (`ws: true`) verso `localhost:8080`. Il browser vede una sola origine.

### 12.6 Strategia di deploy

1. **Primo deploy dopo F2**: Blueprint applicato su Render, servizio con il solo backend su
   `https://<servizio>.onrender.com`, verifica con Postman (environment `render`): health,
   registrazione (codice via Brevo), login, refresh, admin. Il cookie `Secure` funziona con Postman.
2. **Deploy dopo F3, F4, F5**: merge `develop → main` a fine fase, eseguito dallo studente.
3. **F6 — deploy finale del backend**: fallback SPA attivo (verificato con un `index.html` di prova
   nei test), verifica in un browser reale che il cookie di refresh venga salvato e inviato sulla
   stessa origine (anche Safari, se disponibile), con la pagina HTML di prova STOMP o con le
   richieste dalla console del browser.
4. **Integrazione (24 ottobre)**: con lo stage Node attivo (FE-01), lo stesso servizio distribuisce
   anche il frontend; verifica end-to-end di login, refresh silenzioso, WebSocket e demo.

Dopo ogni deploy: log di avvio (Flyway, bootstrap), health check, endpoint principali con Postman.

### 12.7 Spin-down e demo

- Il servizio gratuito si sospende dopo circa 15 minuti senza traffico; il risveglio richiede circa
  un minuto. Con un solo servizio si sospende **anche il frontend**: la prima apertura della pagina
  attende il risveglio. I job `@Scheduled` non girano mentre è sospeso (per questo usano
  `fixedDelay`, che parte all'avvio).
- Preparazione della demo: aprire `/api/health` qualche minuto prima, fare login con i tre account,
  verificare la connessione WebSocket.
- Account della demo: SUPERADMIN (dalle variabili d'ambiente), un utente da promuovere ad ADMIN, un
  utente da sospendere. I due utenti si registrano con il flusso normale prima della demo: nessuna
  credenziale nel repository.
- Rischio: il database gratuito di Render ha una scadenza dopo la creazione (da verificare sul piano
  attuale); va creato in tempo per la consegna e ricordato dopo.

### 12.8 Evoluzioni future (VPS o piano a pagamento)

Nessuna dipendenza specifica da Render oltre a `DATABASE_URL` (gestita anche come URL JDBC
diretto). Il servizio unico (API + frontend in un'immagine) si sposta su una VPS così com'è; un
eventuale dominio futuro richiede solo la configurazione DNS e, se frontend e API restano sulla
stessa origine, nessuna modifica a cookie e CORS. Configurazione solo da variabili d'ambiente, immagine Docker portabile, stato in memoria
limitato a limiti di frequenza e sessioni WebSocket (con più istanze servirebbero un broker esterno
e limiti condivisi: da progettare allora, non ora).

---

## 13. Documentazione del progetto

| Documento | Contenuto | Quando si aggiorna |
|---|---|---|
| `docs/brief.md` | Brief integrale | Non si modifica |
| `docs/progettazione.md` | Questo documento, sezioni numerate | Quando cambia in modo approvato il design |
| `docs/decisioni.md` | Una voce per decisione: Scelta, Motivazione, Alternative scartate | Nello stesso sotto-task in cui si prende la decisione |
| `docs/schema-db.md` | Tabelle, tipi, chiavi, vincoli, ER Mermaid dello schema applicato | A ogni migrazione che modifica lo schema, nello stesso sotto-task |
| `docs/riuso-nosey.md` | Mappa NoseY → Resonance | Quando si porta una classe non prevista o cambia la destinazione |
| `docs/report-sicurezza.md` | F6: analisi statica e verifica dinamica (SQL injection, XSS, CSRF, brute force, furto/riuso del refresh token, escalation di ruolo), risultati reali, correzioni, criticità aperte | F6 |
| `README.md` (radice) | Descrizione, backend, avvio locale con Docker e profilo dev (porta 5433), variabili d'ambiente senza valori, import Postman, link al deploy (solo quando esiste) | Quando cambiano avvio, variabili, struttura o deploy |
| `CLAUDE.md` (radice) | Regole permanenti di lavoro in forma sintetica | Quando cambiano le regole |
| `package-info.java` | Una riga di responsabilità per package | Alla creazione del package, nello stesso sotto-task |
| `render.yaml` | Blueprint Render | Quando cambia l'infrastruttura |
| `postman/` | Collection ed environment | A ogni endpoint REST nuovo o modificato |

Le card Trello che toccano decisioni, schema, package, avvio o deploy hanno il sotto-task
documentale esplicito; nessuna card finale "scrivere la documentazione". La documentazione descrive
solo ciò che è implementato.

`docs/decisioni.md` viene popolato subito con le decisioni del brief (D1–D6 e l'elenco della
sezione 10.2 del brief) e con quelle del brainstorming (P1–P11 e i dettagli della sezione 1.2). La
D1 viene registrata nella **nuova versione** (servizio unico), con la versione del brief fra le
alternative scartate; anche `CLAUDE.md` segnala che la D1 del brief è stata sostituita.

---

## 14. Roadmap e ticket

Card di circa 2–4 ore, un commit ciascuna, sotto-task di 30–60 minuti. La lista dettagliata dei
sotto-task e delle verifiche sta nel piano di implementazione (fonte di verità), di cui Trello è lo
specchio. Ogni card include, dove pertinente: test, Postman, `schema-db.md`, `decisioni.md`,
`package-info.java`, README, render.yaml.

### Calendario e stime

Stime realistiche comprensive di test, Postman e documentazione. Il calendario anticipa F0 alla
sera del 13 ottobre (richiesta dello studente) per scaricare il 14.

| Giorno | Card | Stima | Ore totali | Rischio |
|---|---|---|---|---|
| 13 ott (sera) | F0-01 · F0-02 | 2 h · 2 h | 4 h | medio: F0-02 può slittare al mattino del 14 |
| 14 ott | F0-03 · F1-01 · F1-02 · F1-03 | 2,5 h · 2,5 h · 3,5 h · 3 h | 11,5 h | **alto**: F1-03 può slittare al 15 |
| 15 ott | F1-04 · F2-01 · F2-02 · F2-03 | 2 h · 2,5 h · 3,5 h · 2 h | 10 h | **alto**: primo deploy a fine giornata |
| 16 ott | F3-01 · F3-02 · F3-03 | 2,5 h · 3 h · 2,5 h | 8 h | medio |
| 17 ott | F4-01 · F4-02 · F4-03 | 2 h · 3 h · 2,5 h | 7,5 h | basso: margine per recuperare ritardi |
| 18 ott | F5-01 · F5-02 · F5-03 | 3,5 h · 3,5 h · 3 h | 10 h | **alto**: WebSocket e chiusura sessioni |
| 19 ott | F6-01 · F6-02 · F6-03 | 3 h · 3 h · 2,5 h | 8,5 h | medio |

Totale backend circa 60 ore. Giorni a rischio: 14, 15 e 18. Se un giorno sfora, il primo margine
è il 17 (F4 più leggera); oltre quello si applica l'ordine dei tagli della sezione 1-BIS del brief
(verifica dinamica del report → Swagger → notifiche live → bacheca collab). Con il taglio delle
notifiche live, F5-03 si riduce alla sola candidatura (messaggio in chat senza notifica).

### F0 — Setup (13 sera – 14 ottobre)

| Card | Contenuto | Criterio di completamento |
|---|---|---|
| F0-01 · Progetto Maven, package e profili | Dipendenze dal pom di NoseY (stesse versioni, senza AI ed enhancement), package `it.epicode.resonance`, `application.yml` + dev/prod/test, `ClockConfig`/`AsyncConfig`/`SchedulingConfig`, `.gitignore` di radice, README iniziale, package-info | `mvnw -q verify` verde, contesto che si avvia |
| F0-02 · PostgreSQL in Docker, Flyway V1 e health | `docker-compose.yml` (5433, DB di test), V1, entity `User`/`UserRole`, `DatabaseUrl`, `HealthController`, `schema-db.md` | `docker compose up`, applicazione avviata in dev, `GET /api/health` 200, test di avvio verdi |
| F0-03 · Errori comuni, Dockerfile, Blueprint e Postman | `common` (errori, `PageResponse`, `@HttpUrl`, `@NotBlankIfPresent`, `RateLimitService`), Dockerfile (stage JDK e JRE, contesto alla radice), `.dockerignore` alla radice, `render.yaml` (database + un solo servizio web), collection Postman ed environment, `decisioni.md` | test del `GlobalExceptionHandler`, `docker build` dalla radice riuscito, Postman health ok |

### F1 — Autenticazione e ruoli (14–15 ottobre)

| Card | Contenuto | Criterio |
|---|---|---|
| F1-01 · Security, access token e JwtFilter | `SecurityConfig`, `CorsConfig`, `AccessTokenService`, `UserAccessService`, `JwtFilter`, EntryPoint, `RoleHierarchy` | test del filtro e delle regole 401/403 |
| F1-02 · Login, refresh con rotazione e logout | V2, `RefreshTokenService`, `RefreshCookieFactory`, login, refresh (409 e riuso), `DELETE /api/auth/refresh`, pulizia programmata | test della sezione 11.2 su login/refresh/logout, Postman |
| F1-03 · Registrazione, verifica email e mail | V3, `EmailCodeService`, register/verify/resend, package `mail` (log + Brevo + template) | test dei codici, Postman |
| F1-04 · Password dimenticata, reset e bootstrap SUPERADMIN | forgot/reset con revoca totale, `SuperadminBootstrap`, README variabili | test di reset e bootstrap, Postman |

### F2 — Utenti e amministrazione (15 ottobre)

| Card | Contenuto | Criterio |
|---|---|---|
| F2-01 · Profilo e ruoli self-service | `GET`/`PATCH /api/users/me` (semantica della sezione 6.1), `DELETE /api/users/me/location`, `GET /api/users/{id}`, attivazione MUSICIAN/HOST | test di assente/`null`/stringa vuota e delle coordinate, test dei ruoli multipli, Postman |
| F2-02 · Sospensione e nomina ADMIN | `AdminUserService`, `PlatformLevelPolicy`, sospensione (durata/data, riattivazione pigra e manuale), endpoint SUPERADMIN, `UserSuspendedEvent` | test sezione 11.2 Amministrazione, Postman |
| F2-03 · Primo deploy su Render | Blueprint applicato, variabili, environment Postman `render`, README con link reale | health e flusso auth verificati su Render; promemoria merge `develop → main` |

### F3 — Eventi e geolocalizzazione (16 ottobre)

| Card | Contenuto | Criterio |
|---|---|---|
| F3-01 · Nominatim e Haversine | package `geo`, client con limite di 1/s, timeout, errori, stub di test | test con `MockRestServiceServer` e Haversine |
| F3-02 · Concerti ufficiali | V4, create/nearby/detail/delete, query Haversine paginata | test di eventi e ricerca, Postman |
| F3-03 · Indie event | V5, bozze, publish, mine, nearby, delete | test, Postman; promemoria merge |

### F4 — Collaborazioni, feed e moderazione (17 ottobre)

| Card | Contenuto | Criterio |
|---|---|---|
| F4-01 · Annunci collab | V6, create/list/detail/close/delete | test, Postman |
| F4-02 · Feed e like | V7, create/list (geo)/detail/delete, like/unlike con `likes_count` atomico | test di concorrenza dei like, Postman |
| F4-03 · Moderazione admin dei contenuti | `moderation`: hide/restore/hidden list per i 4 tipi, regola dei livelli | test, Postman; promemoria merge |

### F5 — Real-time (18 ottobre)

| Card | Contenuto | Criterio |
|---|---|---|
| F5-01 · WebSocket, CONNECT e sessioni | `WebSocketConfig`, `JwtChannelInterceptor`, handler degli errori STOMP, registro sessioni e chiusura alla sospensione | test STOMP di connessione e sospensione |
| F5-02 · Chat | V8, REST (lista, crea, messaggi a cursore, letti), invio STOMP con ordine dei controlli, consegna dopo il commit | test REST e STOMP, Postman (solo REST) |
| F5-03 · Notifiche live e candidature | `notification`, notifiche like/messaggio/candidatura, `POST /applications`, pagina HTML STOMP facoltativa | test after-commit e rollback; promemoria merge |

### F6 — Hardening e rilascio (19 ottobre)

| Card | Contenuto | Criterio |
|---|---|---|
| F6-01 · Hardening e test | Revisione di sicurezza del codice (config, log, errori), test mancanti, build completa | `mvnw verify` verde |
| F6-02 · Swagger e report di sicurezza | springdoc + Swagger UI, `report-sicurezza.md` (statica + dinamica, Strix se disponibile) | report con risultati reali |
| F6-03 · Fallback SPA e deploy finale | `SpaResourceConfig` e regola di sicurezza per i `GET` statici, verifica del cookie in browser sulla stessa origine, preparazione degli account della demo, README finale | test del fallback (index di prova, `/api/...` inesistente → 404 JSON), deploy finale verificato; promemoria merge |

Ordine dei tagli in caso di ritardo (brief 1-BIS): verifica dinamica del report → Swagger →
notifiche live → bacheca collab. Mai tagliati: autenticazione a due token, ruoli e admin, eventi con
geolocalizzazione, feed con like, chat, demo di promozione e sospensione, documentazione essenziale.

### Dipendenze fra fasi

F0 → F1 → F2 (primo deploy) → F3 → F4 → F5 → F6. Le candidature (F5-03) richiedono chat (F5-02) e
collab (F4-01); le notifiche dei like richiedono il feed (F4-02); la chiusura delle sessioni (F5-01)
completa la sospensione di F2-02.

### Card FE (lista "FE in attesa", non sviluppate ora)

FE-01 Setup Vite/TS/Redux/Router/Bootstrap, proxy Vite verso `localhost:8080` e stage Node nel
Dockerfile · FE-02 Client API e refresh silenzioso · FE-03
Registrazione, verifica e login · FE-04 Profilo e ruoli · FE-05 Eventi vicini e mappa · FE-06
Pubblicazione eventi · FE-07 Feed e like · FE-08 Collab e candidature · FE-09 Chat e notifiche
STOMP · FE-10 Area di moderazione · FE-11 Deploy integrato (stesso servizio) e prova della demo.

### Demo finale

Promozione di un utente ad ADMIN da parte del SUPERADMIN; sospensione di un utente con motivo e
durata (login rifiutato con i dettagli, sessione WebSocket chiusa); riattivazione; nascondere e
ripristinare un contenuto; eventi vicini sulla mappa; feed con like; chat in tempo reale con
notifica.

---

## 15. Funzionalità future (Post-V1 e Post-V2)

**Nessuna di queste funzionalità è implementata nell'MVP.** Lo schema le rende possibili senza
modifiche distruttive.

### Post-V1

| Funzionalità | Predisposizione |
|---|---|
| `tickets` (QR, Stripe) | FK verso `official_concerts`; riferimento a Ticket/Partecipante di NoseY |
| `track_uploads` | storage delle immagini/file da scegliere (Cloudinary escluso); controllo dei primi byte di NoseY |
| `collab_matches` con `ai_score` | FK verso `collab_posts` e `users` |
| `reviews` | FK verso eventi e utenti |
| `follows` | tabella con PK composta (follower, followed), al posto delle amicizie di NoseY |
| `notifications` (storico) | i payload `LiveNotification` sono già il formato da salvare |
| `indie_events.official_concert_id` | colonna nullable aggiunta con una nuova migrazione |
| Appeal delle sospensioni | i campi di sospensione esistono già |
| Upload immagini | oggi solo URL |

### Post-V2

Notifiche push per browser e mobile; integrazione Spotify; acquisto dei biglietti dei concerti
ufficiali (Stripe); piano premium per HOST; personalizzazione dei biglietti con AI; 2FA (nuovo
valore `TWO_FACTOR` di `email_code_purpose`); GDPR e anonimizzazione; login social con Firebase Auth
limitato all'autenticazione (`password_hash` diventerebbe nullable, PostgreSQL resta il database
applicativo).
