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
| D1 | Deploy (**nuova versione**, sostituisce quella del brief) | Un solo servizio web Render (Docker) su `onrender.com` che serve API e build del frontend React. Dockerfile multi-stage (Node → JDK → JRE). Fallback SPA verso `index.html` escluse `/api/**` e `/ws/**`. Fino alla card FE-01 (18 ottobre, dopo F7-03) il servizio contiene solo il backend. Stessa origine: cookie di refresh di prima parte `SameSite=Lax`, nessun CORS in produzione. `render.yaml` con database + un solo servizio web. Nessun dominio personalizzato. |
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

**Chat libera sostituita dallo studente (16 ottobre, decisione 59).** La regola del brief "chiunque può
scrivere a chiunque" (§7.1, §8.3-E, §8.4) è sostituita: i messaggi fra utenti richiedono un'amicizia
accettata (sezione 6.14) oppure uno sblocco aperto da una candidatura collab o dal contatto di un evento
(sezione 6.9); gli utenti si trovano con la ricerca (sezione 6.5). Le parti del brief sulla chat libera e
sul divieto delle amicizie vanno lette alla luce di questa sostituzione.

### 1.2 Punti chiusi durante il brainstorming

| # | Scelta |
|---|---|
| P1 | Package base `it.epicode.resonance`, groupId `it.epicode` (artifactId proposto: `resonance-be`). |
| P2 | Tabella separata `email_codes` con campo `purpose` (enum `EMAIL_VERIFICATION`, `PASSWORD_RESET`), estendibile al 2FA (Post-V2). Logica di NoseY: scadenza 15 min, 5 tentativi, limiti di invio, confronto a tempo costante. |
| P3 | Logout con `DELETE /api/auth/refresh`: revoca il refresh token del dispositivo e cancella il cookie. |
| P4 | Finestra di tolleranza di 10 s per refresh concorrenti: colonne `revoked_at` e `replaced_by` in `refresh_tokens`. |
| P5 | Colonna `address` in `official_concerts` e `indie_events`, geocodificata e mostrata dal frontend. |
| P6 | Candidatura collab: `POST /api/collab-posts/{id}/applications`, senza tabella nuova: messaggio in chat all'autore + notifica live. Dal 16 ottobre sblocca la chat candidato–autore finché l'annuncio è aperto (decisione 59). |
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
   `/app/chats/{conversationId}/send` come in NoseY. Dal 16 ottobre una conversazione nuova si crea solo
   fra amici e ogni invio richiede l'amicizia o uno sblocco aperto (sezione 6.9, decisione 59).
8. Il nuovo messaggio genera sia il messaggio su `/user/queue/messages` (mittente e destinatario) sia
   una notifica `NEW_MESSAGE` su `/user/queue/notifications` (solo destinatario).
9. Il ripristino da parte di un admin vale solo per contenuti nascosti da un admin, non per quelli
   cancellati dal proprietario (sezione 5.7).
10. Limiti anti-spam in memoria anche per nuove conversazioni e candidature (sezione 8.8).
11. Spring Mail incluso nelle dipendenze come da stack, ma nell'MVP il trasporto effettivo è il log
    (dev) o Brevo via HTTP (prod): `SmtpEmailService` di NoseY non viene portato.

### 1.4 Questioni ancora aperte (non bloccanti per F0–F5)

- **Indirizzo di contatto per i ricorsi** mostrato dal frontend agli utenti sospesi: è una
  configurazione del frontend; il backend non lo espone. Chiusa dalla decisione 78: costante in
  `Resonance_FE/src/config.ts`, scelta dallo studente in FE-03.
- **Versione di springdoc-openapi** compatibile con Spring Boot 4.1.1: da verificare all'inizio di F6.
- **Plugin Strix** per la verifica dinamica: disponibilità da verificare in F6.
- **Rischio di tempo**: il brief assegna F0 e F1 allo stesso giorno (14 ottobre). Il calendario
  della sezione 14 anticipa F0 alla sera del 13 ottobre e riporta una stima per ogni card; gli
  sforamenti si segnalano subito, come previsto dalla sezione 1-BIS del brief.
- **Rischio di tempo (16 ottobre)**: amicizie, ricerca utenti, sblocchi della chat e contatto degli eventi
  (decisione 59) aggiungono circa 8,5 ore a F4 e F5; il giorno di anticipo accumulato in F3 le assorbe senza
  margine residuo (sezione 14).

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
  Costruttore pubblico con i campi obbligatori e `@NoArgsConstructor(access = AccessLevel.PROTECTED)`
  per JPA (decisione 41). Mai `@AllArgsConstructor`: i costruttori si scrivono a mano.

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
| `friendship` | Amicizie fra utenti e ricerca degli utenti con lo stato della relazione. | `Friendship`, `FriendshipStatus`, `FriendshipView`, `FriendshipRelation`, `FriendshipRepository`, `FriendshipService`, `FriendshipController`, `UserSearchService`, `UserSearchController`, DTO. |
| `chat` | Conversazioni e messaggi privati 1:1 (REST e STOMP) e permesso di scrittura. | `ChatConversation`, `ChatMessage`, `ChatUnlock`, `ChatUnlockId`, `ChatUnlockSource`, repository, `ChatService`, `ChatController`, `ChatWebSocketController`, `ChatMessageEvent`, `ChatMessageListener`, DTO. |
| `notification` | Notifiche salvate con stato di lettura (decisione 97) e consegna live dopo il commit. | `Notification`, `NotificationType`, `NotificationRepository`, `NotificationService`, `NotificationController`, `LiveNotification`, `LiveNotificationEvent`, `LiveNotificationListener`, DTO. |
| `websocket` | Registro delle sessioni WebSocket e chiusura alla sospensione. | `WebSocketSessionRegistry`, `UserSuspendedSessionCloser`. |
| `mail` | Email a eventi con template Thymeleaf. | `EmailService`, `HtmlEmailService`, `LogEmailService`, `BrevoEmailService`, `EmailEventListener`, eventi email. |
| `web` | Endpoint tecnici e distribuzione del frontend (fallback SPA). | `HealthController`, `SpaResourceConfig` (risorse statiche + fallback a `index.html`). |

Dipendenze ammesse: i domini (`event`, `collab`, `feed`, `chat`) dipendono da `user`, `common`,
`geo`, `moderation`, `notification`; `moderation` dipende da `user` (regola dei livelli) e
`common`; `auth` dipende da `user`, `mail`, `common`; nessun package dipende da `admin` (è `admin`
a dipendere da `user` e `auth`). `friendship` dipende da `user` e `common` (la ricerca utenti sta qui,
non in `user`, per evitare il ciclo `user` ↔ `friendship`); `chat` dipende da `friendship`; `collab`
(candidature) ed `event` (contatto) dipendono da `chat`. Il permesso di scrittura legge le tabelle delle
origini (annunci ed eventi) con una query nativa, senza dipendere dai loro package (sezione 6.9).

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
  (ruoli multipli, sospensione estesa); `ChatWebSocketController` (permesso di scrittura invece
  dell'amicizia obbligatoria di NoseY); regole di `AmiciziaService` (stati, lock della coppia, rifiuto
  silenzioso) senza evento, ticket, chat creata all'accettazione e notifiche persistenti (decisione 59);
  cursore della chat; Dockerfile (contesto di build alla radice del repository, stage Node per il
  frontend); `render.yaml` (un solo servizio web).
- **Non portato**: AI/Gemini, ticket/partecipanti, anonimizzazione, artisti, POI, foto,
  storage delle immagini, notifiche persistenti, `SmtpEmailService`, plugin di enhancement di
  Hibernate, Actuator, blacklist `TOKEN_JWT`.

### 2.5 Commenti nel codice

Le scelte non ovvie hanno un commento breve che rimanda alla sezione di questo documento
("progettazione, sezione 4.6"), senza copiarne i paragrafi. In più ogni classe e ogni metodo non
banale ha una riga di Javadoc in italiano; i test hanno una riga per classe (decisione 42).

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
| `friendship_status` | `PENDING`, `ACCEPTED`, `DECLINED`, `CANCELLED`, `REMOVED` | `FriendshipStatus` |
| `chat_unlock_source` | `COLLAB_POST`, `OFFICIAL_CONCERT`, `INDIE_EVENT` | `ChatUnlockSource` |
| `notification_type` | `NEW_LIKE`, `COLLAB_APPLICATION`, `FRIEND_REQUEST`, `FRIEND_ACCEPTED` | `NotificationType` (ha in più `NEW_MESSAGE`, solo live) |

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
| display_name | varchar(50) | NOT NULL; unico senza maiuscole: indice `uq_users_display_name_lower` su `lower(display_name)` (decisione 96) | brief, F7-08 |
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

#### friendships

Decisione 59; regole nella sezione 6.14.

| Colonna | Tipo | Vincoli |
|---|---|---|
| id | uuid | PK |
| requester_id | uuid | NOT NULL, FK → users (chi ha inviato l'ultima richiesta) |
| addressee_id | uuid | NOT NULL, FK → users |
| status | friendship_status | NOT NULL |
| closed_by | uuid | NULL, FK → users (chi ha rifiutato o rimosso) |
| request_masked | boolean | NOT NULL DEFAULT false (rifiuto silenzioso) |
| created_at | timestamptz | NOT NULL DEFAULT now() |
| updated_at | timestamptz | NOT NULL |

Vincoli: `ck_friendships_not_self (requester_id <> addressee_id)`; `ck_friendships_closed_by`
(`closed_by` valorizzato se e solo se lo stato è `DECLINED` o `REMOVED`); `ck_friendships_masked`
(`request_masked` vero solo con `DECLINED`). Una riga per coppia, qualunque dei due abbia chiesto:
indice univoco `uq_friendships_pair` su `(LEAST(requester_id, addressee_id), GREATEST(requester_id,
addressee_id))`. Indici `ix_friendships_requester (requester_id)` e `ix_friendships_addressee
(addressee_id)`.

#### notifications

Decisione 97; regole nella sezione 6.15.

| Colonna | Tipo | Vincoli |
|---|---|---|
| id | uuid | PK |
| recipient_id | uuid | NOT NULL, FK → users (chi riceve) |
| actor_id | uuid | NOT NULL, FK → users (chi ha compiuto l'azione) |
| type | notification_type | NOT NULL |
| target_id | uuid | NOT NULL, senza FK (post, annuncio o amicizia secondo il tipo) |
| created_at | timestamptz | NOT NULL, dall'applicazione |
| read_at | timestamptz | NULL, vuoto = non letta |

Vincolo `ck_notifications_not_self (recipient_id <> actor_id)`. Indici `ix_notifications_recipient_created
(recipient_id, created_at DESC, id DESC)`, `ix_notifications_unread (recipient_id)` parziale su
`read_at IS NULL`, `ix_notifications_created (created_at)` per la pulizia e `uq_notifications_like (recipient_id,
actor_id, target_id)` univoco parziale su `type = 'NEW_LIKE'`.

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

#### chat_unlocks

Origini che permettono di scrivere senza amicizia (decisione 59, sezione 6.9).

| Colonna | Tipo | Vincoli |
|---|---|---|
| conversation_id | uuid | NOT NULL, FK → chat_conversations |
| source_type | chat_unlock_source | NOT NULL |
| source_id | uuid | NOT NULL, **senza FK** (id dell'annuncio o dell'evento) |
| created_at | timestamptz | NOT NULL DEFAULT now() |

PK composta `pk_chat_unlocks (conversation_id, source_type, source_id)`: una seconda candidatura allo
stesso annuncio non crea un'altra riga (`INSERT ... ON CONFLICT DO NOTHING`). `source_id` punta a tre
tabelle diverse, quindi non può avere una FK: lo sblocco si crea solo dopo aver letto l'origine nella
stessa transazione.

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
    USERS ||--o{ FRIENDSHIPS : "richiede / riceve"
    USERS |o--o{ FRIENDSHIPS : "chiude (closed_by)"
    USERS ||--o{ NOTIFICATIONS : "riceve / causa"
    USERS ||--o{ CHAT_CONVERSATIONS : "utente A / utente B"
    CHAT_CONVERSATIONS ||--o{ CHAT_MESSAGES : "contiene"
    CHAT_CONVERSATIONS ||--o{ CHAT_UNLOCKS : "sbloccata da (annuncio o evento, senza FK)"
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
| `V8__friendships.sql` | F4-04 | enum `friendship_status`; tabella `friendships`. |
| `V9__chat.sql` | F5-02 | enum `chat_unlock_source`; tabelle `chat_conversations`, `chat_messages`, `chat_unlocks`. |
| `V11__notifications.sql` | F7-06 | enum `notification_type`; tabella `notifications` (decisione 97). |

Ogni migrazione dipende solo da `users` (V1) e, per `post_likes`/`chat_messages`/`chat_unlocks`, dalle
tabelle create nella stessa migrazione. Nessuna tabella Post-V1/Post-V2 viene creata. (La chat era `V8`
prima della decisione 59; le amicizie la precedono, quindi diventa `V9`.)

### 3.7 Allineamento di docs/schema-db.md

`docs/schema-db.md` descrive lo schema **effettivamente applicato**: a ogni migrazione che modifica
lo schema, nello stesso sotto-task, si aggiornano tabelle, vincoli e i diagrammi Mermaid:
il `flowchart` di panoramica, l'`erDiagram` di dettaglio (per area) e l'ER completo (decisione 73). La
sezione 3 di questo documento è il modello di riferimento; `schema-db.md` è lo stato reale. Un test
di avvio con `ddl-auto: validate` verifica che entity e migrazioni coincidano; nessun test controlla
i diagrammi, che sono documentazione e si allineano a mano, come l'elenco delle tabelle.

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

`POST /api/auth/register` `{email, password, displayName}` → 201 `{email}` (senza l'id: al client non serve, deve solo verificare l'email e fare il login).

1. Email normalizzata (trim, minuscole); password 8–72 caratteri e massimo 72 byte UTF-8, senza emoji; `displayName` dopo
   il trim da 3 a 30 caratteri, senza emoji né caratteri invisibili (decisione 84); gli spazi ripetuti dentro il
   nome si riducono a uno (decisione 96).
2. Lock sulla riga dell'utente con quell'email (`SELECT ... FOR UPDATE`).
3. Email già verificata o account sospeso → 409 `EMAIL_ALREADY_REGISTERED`.
4. Email esistente ma non verificata: controllo dei limiti di invio (4.6), poi i nuovi dati
   sovrascrivono quelli in sospeso (come in NoseY: nessuno ha ancora dimostrato di possederla).
5. Utente nuovo: riga in `users` + riga `user_roles (FAN)` (FAN automatico e non rimovibile).
6. Codice `EMAIL_VERIFICATION` generato in `email_codes`; `saveAndFlush` (una registrazione
   concorrente sulla stessa email nuova fa scattare `uq_users_email` → 409).
7. Evento `VerificationCodeEmailEvent` → email inviata dopo il commit, in modo asincrono.

**Nome utente unico (decisione 96).** Prima del codice (e quindi prima di consumare un invio) si controlla il nome: riservato
(admin, superadmin, resonance, staff, support, moderator, official, system, root, il nome intero senza distinguere le maiuscole) → 400
`VALIDATION_ERROR` sul campo `displayName`; già usato da un altro utente, anche non verificato → 409
`DISPLAY_NAME_TAKEN`. Il nome che l'account già tiene non è un conflitto. Due registrazioni insieme sullo stesso nome: la
seconda urta l'indice `uq_users_display_name_lower` e riceve lo stesso 409.

**Account mai verificati.** `UnverifiedAccountCleaner` (`@Scheduled(fixedDelay = 1h)`, gira anche all'avvio) elimina gli utenti con
`email_verified = false` il cui ultimo invio del codice di verifica risale a più di 24 ore (senza codice conta `created_at`):
il nome torna libero e le righe collegate vanno via in cascata.

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

1. Limite `LOGIN_FAILED` per email (10 fallimenti in 15 minuti) → 429. Il tentativo si prenota subito con
   `consume` (controllo e registrazione in un passo atomico), prima di BCrypt: richieste parallele non possono
   passare tutte il controllo prima che una registri il fallimento (decisione 76).
2. Utente inesistente o password errata → 401 `INVALID_CREDENTIALS` (stessa risposta, il tentativo già
   prenotato resta come fallimento). Per un'email sconosciuta si esegue comunque un confronto BCrypt con un hash fittizio, dello
   stesso costo, così il tempo di risposta non rivela se l'email esiste (decisione 48). Password oltre 72
   byte → trattata come errata senza chiamare BCrypt.
3. Email non verificata → 403 `EMAIL_NOT_VERIFIED`.
4. Sospeso: se `suspended_until` è passato → riattivazione pigra (5.5) e si prosegue; altrimenti
   403 `ACCOUNT_SUSPENDED` con `details` `{suspensionReason, suspendedUntil}`.
5. Blocca la riga dell'utente e controlla che l'hash della password sia ancora quello confrontato (BCrypt gira
   fuori dal lock, per non tenere bloccata la riga durante l'hash): se un reset si è concluso nel frattempo →
   401 `INVALID_CREDENTIALS`. Azzera i fallimenti; crea una riga `refresh_tokens`; firma l'access token; risponde con
   `LoginResponse {accessToken, accessTokenExpiresAt, user: MeResponse}` e `Set-Cookie`.

I controlli 3 e 4 avvengono solo dopo una password corretta, così non rivelano quali email esistono; in
questi due casi il tentativo prenotato si restituisce (`release`), perché non è un fallimento (decisione 48).

### 4.8 Refresh con rotazione

`POST /api/auth/refresh` (cookie + header `X-Requested-With: XMLHttpRequest`) → 200 `LoginResponse`
+ nuovo cookie. Tutto in una transazione:

1. Header `X-Requested-With` assente → 403 `CSRF_HEADER_MISSING`. Header `Origin` presente ma
   diverso dall'origine del servizio e non fra le origini ammesse in configurazione (in prod
   nessuna) → 403 **senza `ErrorResponse`**: lo rifiuta il filtro CORS di Spring con il testo
   "Invalid CORS request", prima dei nostri handler, quindi non ha il codice `ACCESS_DENIED` (il controllo
   nel controller resta come seconda difesa).
2. Cookie assente → 401 `REFRESH_TOKEN_INVALID` + cancellazione del cookie.
3. Hash del valore; si legge l'utente del token (senza lock), si blocca la riga dell'utente
   (`SELECT ... FOR UPDATE`) e poi quella del token per `token_hash`. Token non trovato → 401
   `REFRESH_TOKEN_INVALID` + cancellazione. L'ordine dei lock è sempre utente → token, come in reset e sospensione,
   così non nascono deadlock (decisione 76).
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

**Concorrenza.** Il lock sulla riga dell'utente serializza la rotazione con il reset della password: senza,
l'`UPDATE` del reset non vedrebbe il token inserito da una rotazione non ancora conclusa, che resterebbe valido
e si rinnoverebbe all'infinito (decisione 76). Due refresh simultanei con lo stesso cookie (due schede) vengono
serializzati dal lock di riga: il primo ruota, il secondo trova il token appena sostituito e riceve 409. Il frontend
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
  Errori (decisione 51): codice sbagliato, scaduto, esaurito o assente → sempre 400 `CODE_INVALID`, anche
  per account inesistenti, non verificati o sospesi; 403 `ACCOUNT_SUSPENDED` solo con il codice valido.

### 4.11 Casi di revoca totale

| Evento | Revoca | Cookie | Altro |
|---|---|---|---|
| Logout | solo il token del dispositivo | cancellato | — |
| Reset della password | tutti | cancellato nella risposta | email di avviso |
| Sospensione | tutti | (non c'è richiesta dell'utente) | chiusura delle sessioni WebSocket dopo il commit |
| Riuso di un token revocato | tutti | cancellato | log di warning |

Reset della password, sospensione, rotazione e login bloccano la riga dell'utente prima di toccare i token: una
sessione aperta mentre si fa il reset non può sopravvivere alla revoca totale (decisione 76).

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

`UserAccessService.resolve(userId)` legge con una sola query utente, stato, `email_verified`,
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
| `ACCESS_DENIED` | 403 | Ruolo insufficiente |
| `NOT_FOUND` | 404 | Risorsa inesistente o nascosta |
| `METHOD_NOT_ALLOWED` | 405 | Metodo non supportato |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Content-Type del body non supportato (l'API accetta solo JSON) |
| `CONFLICT` | 409 | Vincolo DB generico |
| `TOO_MANY_REQUESTS` | 429 | Limiti di frequenza |
| `INTERNAL_ERROR` | 500 | Errore inatteso (loggato) |
| `EMAIL_ALREADY_REGISTERED` | 409 | Registrazione |
| `DISPLAY_NAME_TAKEN` | 409 | Registrazione e `PATCH /api/users/me`: nome utente già usato (decisione 96) |
| `ALREADY_VERIFIED` | 409 | Verifica |
| `CODE_INVALID` / `CODE_EXPIRED` | 400 | Verifica (entrambi). Reset: solo `CODE_INVALID`, anche per codice scaduto, esaurito o assente (decisione 51) |
| `WRONG_PASSWORD` | 400 | Verifica con password diversa |
| `INVALID_CREDENTIALS` | 401 | Login |
| `EMAIL_NOT_VERIFIED` | 403 | Login |
| `ACCOUNT_SUSPENDED` | 403 | Login, refresh, verifica, reset (solo con il codice valido, decisione 51); `details: {suspensionReason, suspendedUntil}` |
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
| `COLLAB_ALREADY_APPLIED` | 409 | Seconda candidatura dello stesso utente allo stesso annuncio (decisione 99) |
| `CANNOT_APPLY_OWN_POST` | 400 | Candidatura al proprio annuncio |
| `CANNOT_MESSAGE_SELF` | 400 | Conversazione con se stessi |
| `NOT_CONVERSATION_MEMBER` | 403 | Chat |
| `NOT_FRIENDS` | 403 | Nuova conversazione fra non amici; rimozione di un'amicizia non accettata (decisione 59) |
| `CHAT_LOCKED` | 403 | Invio senza amicizia né sblocco aperto (sezione 6.9) |
| `CANNOT_FRIEND_SELF` | 400 | Richiesta di amicizia a se stessi |
| `FRIEND_REQUEST_ALREADY_SENT` / `FRIEND_REQUEST_ALREADY_RECEIVED` | 409 | Richiesta già in attesa (inviata da me / dall'altro) |
| `ALREADY_FRIENDS` | 409 | Richiesta fra amici |
| `FRIENDSHIP_UNAVAILABLE` | 409 | Richiesta dopo una rimozione fatta dall'altro (sezione 6.14) |
| `FRIEND_REQUEST_NOT_PENDING` | 409 | Accetta, rifiuta o annulla una richiesta non più in attesa |
| `NOT_FRIENDSHIP_ADDRESSEE` / `NOT_FRIENDSHIP_REQUESTER` | 403 | Accetta/rifiuta da chi l'ha inviata; annulla da chi l'ha ricevuta |
| `EVENT_CLOSED` | 409 | Contatto di un evento già iniziato |
| `CANNOT_CONTACT_OWN_EVENT` | 400 | Contatto del proprio evento |
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
| `POST /api/auth/register` | pubblico | `{email, password, displayName}` | 201 `{email}` |
| `POST /api/auth/verify` | pubblico | `{email, code, password}` | 200 `LoginResponse` + cookie |
| `POST /api/auth/resend-code` | pubblico | `{email}` | 204 |
| `POST /api/auth/login` | pubblico | `{email, password}` | 200 `LoginResponse` + cookie |
| `POST /api/auth/refresh` | cookie + `X-Requested-With` | — | 200 `LoginResponse` + cookie |
| `DELETE /api/auth/refresh` | cookie + `X-Requested-With` | — | 204 + cookie cancellato |
| `POST /api/auth/password/forgot` | pubblico | `{email}` | 204 |
| `POST /api/auth/password/reset` | pubblico | `{email, code, newPassword}` | 204 + cookie cancellato |

`LoginResponse` = `{accessToken, accessTokenExpiresAt, user: MeResponse}`.
`MeResponse` = `{id, email, displayName, avatarUrl, bio, city, latitude, longitude, roles: [...],
status, createdAt}`. L'`id` compare solo nel proprio profilo: il frontend lo confronta con
`AuthorSummary.id` e `senderId` per riconoscere i propri contenuti (decisione 49). Gli altri DTO di risposta
hanno un id solo se serve a un'azione successiva; la registrazione risponde `{email}`.

Validazioni: email `@Email` max 255; password 8–72 caratteri, 72 byte e senza emoji (anche `newPassword` del reset);
`displayName` 3–30 caratteri, senza emoji né caratteri invisibili, spazi ripetuti ridotti a uno, non riservato (400 sul campo) e unico senza distinguere le maiuscole (409 `DISPLAY_NAME_TAKEN`, decisione 96); `code` `\d{6}`. Le regole sulle emoji valgono solo
quando si scrive la password o il nome: login e verifica confrontano password già esistenti e non le applicano, e gli
utenti già presenti non sono toccati (decisione 84).

### 6.5 Utenti

| Metodo e percorso | Accesso | Request | Response |
|---|---|---|---|
| `GET /api/users/me` | autenticato | — | `MeResponse` |
| `PATCH /api/users/me` | autenticato | `{displayName?, avatarUrl?, bio?, city?, latitude?, longitude?}` | 200 `MeResponse` |
| `DELETE /api/users/me/location` | autenticato | — | 200 `MeResponse` (`latitude` e `longitude` a `null`) |
| `POST /api/users/me/roles/musician` | autenticato | — | `MeResponse` |
| `POST /api/users/me/roles/host` | autenticato | — | `MeResponse` |
| `GET /api/users/{id}` | pubblico | — | `PublicUserResponse {id, displayName, avatarUrl, bio, city, roles (solo community)}` |
| `GET /api/users/search?q&page&size` | autenticato | — | `PageResponse<UserSearchResult>` (decisione 59) |

**Ricerca utenti** (package `friendship`, decisione 59): `q` obbligatorio, 2–50 caratteri dopo il trim,
cercato con `ILIKE '%q%'` solo su `display_name` (con l'escape di `%`, `_` e `\` già usato dall'elenco
admin); solo utenti con email verificata e stato `ACTIVE` (un utente con sospensione scaduta ricompare
dopo la riattivazione pigra), escluso chi cerca; ordine `lower(display_name)`, poi `id`; limite
`USER_SEARCH`. `UserSearchResult` = `{id, displayName, avatarUrl, city, friendship: {status,
friendshipId}}`: `status` è lo stato visto da chi cerca (sezione 6.14), `friendshipId` è valorizzato
solo per `OUTGOING`, `INCOMING` e `FRIENDS` (serve ad annullare, accettare o rimuovere). Mai email,
coordinate o ruoli. In `SecurityConfig` la regola autenticata di `/api/users/search` precede quella
pubblica di `GET /api/users/{id}`.

Regole di `PATCH /api/users/me` (sezione 6.1):

| Campo | Assente o `null` | Stringa vuota | Valore |
|---|---|---|---|
| `displayName` | invariato | 400 `VALIDATION_ERROR` | 3–30 caratteri, senza emoji né caratteri invisibili (decisione 84) |
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
| `GET /api/official-concerts/mine?page&size` | autenticato | concerti del chiamante, passati compresi, non nascosti; dal più recente (decisione 77) |
| `GET /api/official-concerts/{id}` | pubblico | 404 se nascosto |
| `DELETE /api/official-concerts/{id}` | proprietario | soft delete (5.7) |
| `POST /api/indie-events` | `hasRole("MUSICIAN")` | 201; `status` facoltativo, default `PUBLISHED` |
| `GET /api/indie-events/nearby?lat&lng&radiusKm&page&size` | pubblico | solo `PUBLISHED`, futuri, non nascosti |
| `GET /api/indie-events/mine?page&size` | autenticato | bozze e pubblicati del chiamante, non nascosti |
| `GET /api/indie-events/{id}` | pubblico | una bozza è visibile solo al proprietario (altrimenti 404) |
| `PATCH /api/indie-events/{id}/publish` | proprietario | 200; già pubblicato → 409; data passata → 400 |
| `DELETE /api/indie-events/{id}` | proprietario | soft delete |
| `POST /api/official-concerts/{id}/contact` | autenticato | `{message (1–1800)}` → 201 `{conversationId, messageId}` (decisioni 59 e 69) |
| `POST /api/indie-events/{id}/contact` | autenticato | come sopra, solo indie event `PUBLISHED` |

**Contatto dell'organizzatore** (card F5-04, decisione 59), sul modello della candidatura (6.7):
evento esistente, non nascosto, con organizzatore attivo e, se indie, pubblicato (altrimenti 404 con lo stesso
messaggio; una bozza è un 404 anche per il proprietario); non ancora iniziato
(`event_date` nel futuro secondo il `Clock`, altrimenti 409 `EVENT_CLOSED`); organizzatore ≠ chiamante
(400 `CANNOT_CONTACT_OWN_EVENT`); limite `EVENT_CONTACTS`. Nella stessa transazione: trova o crea la
conversazione chiamante–organizzatore (senza controllo di amicizia), crea lo sblocco
(`OFFICIAL_CONCERT` o `INDIE_EVENT`, id dell'evento) e salva il messaggio `Contatto per «<titolo>»:`
seguito dal testo (da 1 a 1800 caratteri: con 2000 il totale supererebbe i 2000 di `chat_messages.body`, decisione
69). Dopo il commit: messaggio su `/user/queue/messages` a entrambi e `NEW_MESSAGE` all'organizzatore. Lo sblocco
resta aperto fino all'inizio dell'evento. Il limite `EVENT_CONTACTS` è unico per concerti e indie event e si
consuma solo a controlli superati.

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
| `GET /api/collab-posts/mine?page&size` | autenticato | annunci del chiamante, chiusi compresi, non nascosti; dal più recente (decisione 77) |
| `GET /api/collab-posts/{id}` | pubblico | anche chiusi; 404 se nascosto; `applicationConversationId` = conversazione della candidatura del chiamante, null per anonimi, autore e chi non si è candidato (solo nel dettaglio, decisione 100) |
| `PATCH /api/collab-posts/{id}/close` | proprietario | `is_open = false`, idempotente → 200 |
| `DELETE /api/collab-posts/{id}` | proprietario | soft delete |
| `POST /api/collab-posts/{id}/applications` | autenticato | `{message (1–1800)}` → 201 `{conversationId, messageId}` |

Candidatura (P6): annuncio esistente e non nascosto, con autore attivo (404), aperto (409 `COLLAB_CLOSED`),
autore ≠ candidato (400 `CANNOT_APPLY_OWN_POST`), candidatura non ancora fatta (409 `COLLAB_ALREADY_APPLIED`,
decisione 99), limite `COLLAB_APPLICATIONS` (decisione 67). Nella stessa transazione:
trova o crea la conversazione candidato–autore (senza controllo di amicizia), crea lo sblocco
`COLLAB_POST` con l'id dell'annuncio (decisione 59; la riga è anche il segno della candidatura già fatta: una sola
candidatura per annuncio e utente) e salva un messaggio con testo
`Candidatura per «<titolo>»:` seguito dal messaggio (1800 caratteri al massimo, perché il totale stia nei 2000 del
corpo di un messaggio). Lo sblocco permette a entrambi di scriversi finché
l'annuncio è aperto, non cancellato e non nascosto (sezione 6.9). Dopo il commit: messaggio su
`/user/queue/messages` a entrambi e notifica `COLLAB_APPLICATION` all'autore (non anche
`NEW_MESSAGE`, per non contarla due volte).

### 6.8 Feed e like

| Metodo e percorso | Accesso | Note |
|---|---|---|
| `POST /api/feed-posts` | autenticato | `{body (1–2000), imageUrl?, latitude?, longitude?}` → 201 |
| `GET /api/feed-posts?lat&lng&radiusKm&page&size` | pubblico | dal più recente; con il filtro geografico (tutti e tre i parametri o nessuno) solo post con coordinate nel raggio |
| `GET /api/feed-posts/mine?page&size` | autenticato | post del chiamante, non nascosti; dal più recente; `likedByMe` calcolato, `distanceKm` nullo (decisione 77) |
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
| `POST /api/chats` | autenticato | `{recipientId}` → 200 `ConversationResponse` (trova o crea); destinatario inesistente o non verificato → 404; se stessi → 400; conversazione nuova fra non amici → 403 `NOT_FRIENDS` |
| `GET /api/chats/{id}/messages?before&size` | membro | cursore: `{messages: [...], hasMore}` dal più recente; `before` = id del messaggio più vecchio già caricato; `size` 1–100, default 30 |
| `PATCH /api/chats/{id}/read` | membro | 204: `read_at = now` sui messaggi dell'altro non letti |

`ConversationResponse` = `{id, otherUser: AuthorSummary, lastMessage: {body, senderId, sentAt} | null,
unreadCount, lastMessageAt, canSend}`. Non membro → 403 `NOT_CONVERSATION_MEMBER`; `before` di un'altra
conversazione → 404. Creazione concorrente della stessa coppia gestita con
`INSERT ... ON CONFLICT DO NOTHING` sulla coppia canonica e rilettura. Il cursore riusa la query di
NoseY: confronto su `(sent_at, id)` letto dal database nella stessa query. Limite
`CONVERSATIONS_CREATED` sulle nuove conversazioni.

**Permesso di scrittura** (decisione 59). In una conversazione si scrive se i due membri sono amici
(`friendships.status = ACCEPTED`) **oppure** se esiste in `chat_unlocks` almeno uno sblocco con l'origine
ancora aperta:

| `source_type` | Origine aperta se |
|---|---|
| `COLLAB_POST` | `collab_posts.is_open` e `hidden_at IS NULL` |
| `OFFICIAL_CONCERT` | `event_date > now` e `hidden_at IS NULL` |
| `INDIE_EVENT` | `status = PUBLISHED`, `event_date > now` e `hidden_at IS NULL` |

Il controllo è una query nativa con tre `EXISTS` (uno per tipo) e `now` dal `Clock`. Si applica a ogni
invio (sezione 7.5, errore `CHAT_LOCKED`). Si scrive solo se entrambi i membri sono attivi: con un membro
sospeso (sospensione scaduta = attivo) `canSend` è falso e l'invio dà `CHAT_LOCKED` con un testo neutro, senza
rivelare la sospensione (decisione 66). `POST /api/chats` restituisce sempre una conversazione già
esistente (anche se `canSend` è falso: lo storico resta leggibile) e ne crea una nuova solo fra amici.
`canSend` si calcola per la pagina intera con due query (amici fra le coppie, sblocchi aperti per gli id
delle conversazioni), non una per riga. Lista, storico e `read` non dipendono dal permesso. Candidature
e contatti creano la conversazione con un metodo interno senza controllo di amicizia e senza il limite
`CONVERSATIONS_CREATED` (hanno i propri limiti).

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
appeal delle sospensioni (sezione 15). Le notifiche salvate sono MVP dalla decisione 97 (sezione 6.15).

### 6.14 Amicizie

Decisione 59; regole riprese da `AmiciziaService` di NoseY senza evento, ticket e chat creata all'accettazione. Le notifiche delle
richieste sono quelle della sezione 6.15 (decisione 97).

| Metodo e percorso | Accesso | Note |
|---|---|---|
| `POST /api/friendships` | autenticato | `{userId}` → 201 `FriendshipResponse` |
| `GET /api/friendships?type&page&size` | autenticato | `type` obbligatorio: `FRIENDS`, `INCOMING`, `OUTGOING`; per `updated_at desc, id desc` |
| `GET /api/friendships/with/{userId}` | autenticato | 200 `{status, friendshipId}` (decisione 102) |
| `POST /api/friendships/{id}/accept` | destinatario | 200 `FriendshipResponse` |
| `POST /api/friendships/{id}/decline` | destinatario | 204 |
| `POST /api/friendships/{id}/cancel` | richiedente | 204 |
| `DELETE /api/friendships/{id}` | uno dei due | 204 (rimozione dell'amicizia) |

`FriendshipResponse` = `{id, otherUser: AuthorSummary, status (vista), updatedAt}`. Un'amicizia che non
riguarda il chiamante → 404 su ogni endpoint. Tutte le modifiche leggono la riga con un lock
(`SELECT ... FOR UPDATE`), come NoseY.

**Stato visto da X verso Y** (`FriendshipView`), usato da elenchi e ricerca:

| Riga | Vista di X |
|---|---|
| nessuna, `CANCELLED` | `NONE` |
| `PENDING` | `OUTGOING` se X ha chiesto, `INCOMING` se X ha ricevuto |
| `ACCEPTED` | `FRIENDS` |
| `DECLINED` | chiusa da X → `NONE`; chiusa da Y con `request_masked` → `OUTGOING` (rifiuto silenzioso); chiusa da Y senza → `NONE` |
| `REMOVED` | chiusa da X → `NONE`; chiusa da Y → `UNAVAILABLE` |

**Richiesta** (`POST`): limite `FRIEND_REQUESTS` consumato per primo (conta anche se fallisce); se
stessi → 400 `CANNOT_FRIEND_SELF`; destinatario inesistente, non verificato o non `ACTIVE` → 404. Poi,
con la riga della coppia sotto lock:

- nessuna riga → nuova riga `PENDING` (`saveAndFlush`: due richieste incrociate simultanee violano
  `uq_friendships_pair` → 409 `CONFLICT`);
- `PENDING` → 409 `FRIEND_REQUEST_ALREADY_SENT` se X aveva chiesto, `FRIEND_REQUEST_ALREADY_RECEIVED`
  altrimenti (il frontend propone "accetta");
- `ACCEPTED` → 409 `ALREADY_FRIENDS`;
- `CANCELLED`, oppure `DECLINED`/`REMOVED` chiuse da X → la riga si riapre: X diventa richiedente, stato
  `PENDING`, `closed_by` e `request_masked` azzerati;
- `DECLINED` chiusa da Y: con `request_masked` → 409 `FRIEND_REQUEST_ALREADY_SENT` (coerente con ciò che X
  vede); senza (X aveva annullato la richiesta rifiutata) → `request_masked` torna vero e la risposta è
  `OUTGOING`, senza avvisare Y (rifiuto silenzioso);
- `REMOVED` chiusa da Y → 409 `FRIENDSHIP_UNAVAILABLE`.

**Accetta**: solo il destinatario (403 `NOT_FRIENDSHIP_ADDRESSEE`), solo `PENDING` (409
`FRIEND_REQUEST_NOT_PENDING`), richiedente ancora `ACTIVE` (409 `USER_NOT_ACTIVE`) → `ACCEPTED`.
**Rifiuta**: solo il destinatario, solo `PENDING` → `DECLINED`, `closed_by` = destinatario,
`request_masked` vero. **Annulla**: solo il richiedente (403 `NOT_FRIENDSHIP_REQUESTER`); `PENDING` →
`CANCELLED`; `DECLINED` mascherata → `request_masked` falso (per X la richiesta è annullata, il rifiuto
resta); altrimenti 409 `FRIEND_REQUEST_NOT_PENDING`. **Rimuovi**: solo `ACCEPTED` (altrimenti 403
`NOT_FRIENDS`) → `REMOVED`, `closed_by` = chi rimuove; la conversazione resta leggibile, i nuovi
messaggi seguono il permesso di scrittura (6.9).

**Stato con un utente** (`GET /api/friendships/with/{userId}`, decisione 102): serve al bottone sul profilo pubblico. Risponde
con la stessa forma della ricerca (`FriendshipSummary`: `status` e `friendshipId`, presente solo per `OUTGOING`, `INCOMING` e
`FRIENDS`), calcolata con le stesse regole della tabella sopra. Il limite `FRIENDSHIP_STATE` si consuma per primo e conta anche
gli errori; poi se `userId` è il chiamante → 400 `CANNOT_FRIEND_SELF`; utente inesistente, non verificato o non `ACTIVE` → 404.
Non modifica nulla. `GET /api/users/{id}` resta pubblico e senza stato dell'amicizia.

Elenchi: `FRIENDS` = righe `ACCEPTED` di X; `INCOMING` = `PENDING` ricevute da X; `OUTGOING` = `PENDING`
inviate da X più le `DECLINED` mascherate inviate da X. Gli utenti sospesi restano negli elenchi (non
possono comunque connettersi).

**Notifiche delle richieste** (sezione 6.15): richiesta nuova o riaperta → `FRIEND_REQUEST` al destinatario; accetta →
`FRIEND_ACCEPTED` a chi aveva chiesto e la `FRIEND_REQUEST` del destinatario passa a letta; rifiuta → solo quella
`FRIEND_REQUEST` passa a letta, chi ha chiesto non riceve nulla (rifiuto silenzioso); annulla di una richiesta in attesa →
la `FRIEND_REQUEST` del destinatario viene cancellata. Il rifiuto silenzioso ripetuto da chi era stato rifiutato non
notifica nessuno. `targetId` è l'id dell'amicizia.

### 6.15 Notifiche

Decisione 97, che sostituisce la parte della decisione 59 sulle notifiche delle amicizie. Tutti gli endpoint richiedono il
login e lavorano solo sulle notifiche del chiamante.

| Metodo e percorso | Accesso | Note |
|---|---|---|
| `GET /api/notifications?page&size` | autenticato | `PageResponse<NotificationResponse>` per `created_at desc, id desc` |
| `GET /api/notifications/unread-count` | autenticato | `{count}` |
| `POST /api/notifications/{id}/read` | destinatario | 204, anche se già letta (resta il primo orario di lettura) |
| `POST /api/notifications/read-all` | autenticato | 204 |

`NotificationResponse` = `{id, type, actor: AuthorSummary, targetId, createdAt, read}`: nessuna anteprima, le notifiche salvate
non portano testo. Una notifica altrui o inesistente → 404 `NOT_FOUND` su `read`; un `id` non UUID → 400.

**Quali eventi si salvano:** `NEW_LIKE` (post, una sola per coppia autore-post anche se il like viene tolto e rimesso, e mai per
il proprio like), `COLLAB_APPLICATION` (annuncio), `FRIEND_REQUEST` e `FRIEND_ACCEPTED` (amicizia). `NEW_MESSAGE` e il
contatto degli eventi restano solo live: i messaggi hanno il badge dei non letti della chat. Si salva nella transazione
dell'azione che la causa, quindi se questa fallisce non resta nulla. Si salvano anche per utenti sospesi (che le rivedono alla
riattivazione) e per autori poi sospesi o nascosti; non si salva mai testo di messaggi.

**Stato di lettura:** letta/non letta (`read_at`). Una richiesta gestita resta nell'elenco, letta. **Conservazione:** 30 giorni
dalla creazione, lette o no; un lavoro programmato giornaliero (che parte anche all'avvio, come la pulizia dei refresh token,
sezione 4.11) cancella le scadute. Nessun tetto per utente.

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
2. `UserAccessService.resolve` dal database: utente esistente, verificato e ACTIVE (con
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
| server → client | `/user/queue/notifications` | `LiveNotification {id, type, createdAt, actor: AuthorSummary, targetId, preview}` |
| server → client | `/user/queue/errors` | `WsError {code, message}` |

`LiveNotification.type`: `NEW_LIKE` (`targetId` = post), `NEW_MESSAGE` (`targetId` = conversazione,
`preview` = primi 100 caratteri), `COLLAB_APPLICATION` (`targetId` = annuncio), `FRIEND_REQUEST` (al destinatario) e
`FRIEND_ACCEPTED` (a chi aveva chiesto), entrambi con `targetId` = amicizia. `id` è quello della notifica salvata (sezione
6.15), con cui il frontend la unisce all'elenco; `NEW_MESSAGE` non è salvato e ha `id` nullo.

### 7.5 Invio di un messaggio

`ChatWebSocketController` (`@MessageMapping("/chats/{conversationId}/send")`, payload facoltativo e
senza `@Valid`) delega a `ChatService.send`, che esegue i controlli **in questo ordine** (come NoseY):

1. **Token** (P9): `accessTokenExpiresAt` del Principal ancora nel futuro e utente ancora ACTIVE nel
   DB → altrimenti `TOKEN_INVALID` (o `ACCOUNT_SUSPENDED`).
2. **Rate limit** `CHAT_MESSAGES` (30 al minuto per utente) → `TOO_MANY_REQUESTS`.
3. **Validazione del body** (`body` 1–2000, non vuoto) con il `Validator` → `VALIDATION_ERROR`.
4. Conversazione esistente (`NOT_FOUND`) e chiamante membro (`NOT_CONVERSATION_MEMBER`).
5. **Permesso di scrittura** (sezione 6.9, decisione 59): amici o sblocco aperto → altrimenti
   `CHAT_LOCKED`.
6. Salvataggio del messaggio, aggiornamento di `last_message_at`, pubblicazione di
   `ChatMessageEvent` e `LiveNotificationEvent(NEW_MESSAGE)`.

L'ordine token → limite → body del brief resta invariato; il permesso segue il controllo di
appartenenza, perché a un non membro non si rivela nulla sulla relazione.

Il controller non risponde mai direttamente: gli errori passano dal `WebSocketExceptionHandler`
(`@MessageExceptionHandler` + `@SendToUser("/queue/errors", broadcast = false)`), solo alla sessione
che ha inviato, connessione aperta.

### 7.6 Notifiche dopo il commit

Pattern di NoseY: il service pubblica l'evento **dentro** la transazione; i listener con
`@TransactionalEventListener(phase = AFTER_COMMIT)` chiamano `convertAndSendToUser`. Se la
transazione fallisce non parte nulla. Tutti i tipi tranne `NEW_MESSAGE` vengono anche salvati (sezione 6.15, decisione 97): chi è
offline li trova nell'elenco al ritorno; `NEW_MESSAGE` resta solo live.

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

Header di risposta: restano attivi quelli predefiniti di Spring Security (`X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Cache-Control` senza cache, `Strict-Transport-Security` sulle richieste https) e si
aggiungono `Referrer-Policy: no-referrer` e `Permissions-Policy`, che consente solo la geolocalizzazione del sito
stesso e disattiva camera e microfono (decisione 70).

### 8.2 JwtFilter e AuthenticationEntryPoint

`JwtFilter` (non è un `@Component`, per non essere registrato due volte):

- Nessun Bearer o token non valido/scaduto → **prosegue senza autenticare**. Il 401
  `UNAUTHENTICATED` lo produce l'`AuthenticationEntryPoint` solo sugli endpoint protetti, così un
  token vecchio non blocca le pagine pubbliche.
- Token valido → `UserAccessService.resolve`: utente inesistente, non verificato o sospeso →
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

Anche la documentazione OpenAPI è pubblica, solo in `GET`: `/v3/api-docs/**`, `/swagger-ui/**` e `/swagger-ui.html`
(decisione 72). Descrive la forma delle API e non contiene dati.

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

Dietro il proxy di Render il TLS termina nel proxy e il servizio riceve HTTP: il profilo `prod` imposta
`server.forward-headers-strategy: native`, altrimenti il filtro CORS di Spring vedrebbe lo schema `http`
contro l'`Origin` `https` del browser e respingerebbe ogni POST/DELETE del frontend, login compreso
(decisione 47). Il comportamento va verificato al primo deploy su Render.

Il cookie non è considerato protetto solo perché HttpOnly: HttpOnly impedisce a JavaScript di
leggerlo, non al browser di inviarlo. Access token e refresh token non viaggiano mai sullo stesso
canale.

### 8.6 Validazione dell'input

Bean Validation sui DTO (lunghezze, formati, range); normalizzazione nel costruttore dei record;
URL validati con `@HttpUrl` (solo `http`/`https`, massimo 2048): blocca gli URL `javascript:`. Il
testo libero è salvato com'è e restituito come JSON: la visualizzazione sicura spetta al frontend,
che lo mostra solo come elementi React (escape automatico, link `http`/`https` con conferma, nessun
`dangerouslySetInnerHTML`; decisione 79, che sostituisce DOMPurify); il backend non produce HTML, tranne le email, dove Thymeleaf fa l'escape con
`th:text`. Query solo con parametri legati (JPQL o native con `:param`), mai concatenazioni.

**Tetto del body JSON:** 256 KB (`JsonLimitsConfig`, `StreamReadConstraints.maxDocumentLength` sulla factory di
Jackson). Oltre, la lettura si interrompe e la risposta è il 400 `VALIDATION_ERROR` "Corpo della richiesta non
leggibile". Il limite di Tomcat vale per i form, non per il JSON; il body legittimo più grande sta sotto i 40 KB
(decisione 76).

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
| `FRIEND_REQUESTS` | 20 in 24 ore | utente |
| `USER_SEARCH` | 30 al minuto | utente |
| `FRIENDSHIP_STATE` | 60 al minuto | utente |
| `EVENT_CONTACTS` | 10 in 24 ore | utente |
| `EVENTS_CREATED` | 20 in 24 ore | utente |

`EVENTS_CREATED` è unico per concerti ufficiali e indie event insieme e si consuma prima della geocodifica
(sezione 10.1; decisione 76).

I limiti sui codici email sono nel database (sezione 4.6), quindi sopravvivono ai riavvii.

`LOGIN_FAILED` si prenota con `consume` prima di BCrypt; un login riuscito lo azzera (`reset`) e una password
giusta con email non verificata o account sospeso lo restituisce (`release`).

`LOGIN_FAILED` ha come chiave l'email: chi invia 10 login falliti con l'email di un altro può impedirgli di
accedere per 15 minuti (conseguenza accettata, decisione 48).

### 8.9 Segreti e log

- Segreti solo da variabili d'ambiente: `JWT_SECRET` (nessun default, almeno 32 byte),
  `SUPERADMIN_*`, `BREVO_API_KEY`, `DATABASE_URL`.
- Mai nei log: password, hash, access e refresh token, `DATABASE_URL` completa (`DatabaseUrl`
  stampa l'URL JDBC senza credenziali), corpo delle richieste a Brevo. Eccezione voluta: in dev
  `LogEmailService` scrive il codice di verifica nel log (non è attivo in prod).
- Il log di avvio del primo SUPERADMIN riporta la sua email (mai la password): è voluto per verificare il bootstrap
  su Render. L'email va mascherata a fine MVP completo (backend e frontend), dopo i test finali (decisione 70).
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
  sola istanza dell'applicazione); chi arriva prima del secondo attende il proprio turno, ma al massimo
  `app.geocoding.max-wait` (10 s): oltre, 502 `GEOCODING_UNAVAILABLE` senza chiamare Nominatim. Senza tetto, le
  creazioni in coda occuperebbero i thread di Tomcat e fermerebbero tutto il servizio (decisione 76). Prima della
  geocodifica si consuma anche il limite `EVENTS_CREATED` (sezione 8.8).
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
| Amicizie | richiesta, richieste incrociate, accetta/rifiuta/annulla/rimuovi con i permessi, rifiuto silenzioso visto dalle due parti, riapertura solo da chi ha chiuso, amicizia altrui → 404, limite |
| Ricerca utenti | solo verificati e ACTIVE, se stessi esclusi, mai email, `q` corto → 400, caratteri `%`/`_` cercati letteralmente, stato dell'amicizia per ogni risultato, 401 senza token |
| Chat | cursore (prima pagina, pagine successive, `hasMore`, `before` estraneo), non membro, ordine dei controlli STOMP (token → limite → body), nuova conversazione fra non amici → 403, invio dopo la rimozione → `CHAT_LOCKED` con storico leggibile, sblocco aperto e chiuso (annuncio chiuso, evento iniziato, origine nascosta), `canSend` |
| Contatto eventi | evento futuro → 201 e scrittura libera; evento iniziato → 409; proprio evento → 400; bozza → 404; chat bloccata all'inizio dell'evento |
| WebSocket | CONNECT senza token o con token scaduto, SUBSCRIBE non ammessa, messaggio a entrambi, chiusura delle sessioni alla sospensione |
| Notifiche | consegnate dopo il commit; nessuna consegna in caso di rollback; nessuna notifica a se stessi |

I test si scrivono nella card che introduce la funzionalità, non alla fine.

### 11.3 Postman e STOMP

Collection v2.1 in `postman/resonance.postman_collection.json` con cartelle Auth, Users, Admin,
Events, Collab, Feed, Friends (decisione 59), Chat; environment `local` e `render` con `baseUrl`; lo script di test del login
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
Render, fissata nel Blueprint con `postgresMajorVersion: "17"` e non modificabile dopo la creazione), porta `"127.0.0.1:5433:5432"` (solo sul computer locale; il
PostgreSQL di Windows occupa la 5432), database `resonance`, utente e password di sviluppo non sensibili, volume persistente
`resonance-db-data`, script di init `docker/postgres/init/01-create-test-db.sql` che crea
`resonance_test`. Connessione da pgAdmin su `localhost:5433`.

### 12.2 Profili e Flyway

Profili `dev`, `prod`, `test` (sezione 2.3). Flyway applica le migrazioni all'avvio;
`ddl-auto: validate`; mai `update`.

### 12.3 DatabaseUrl

`ResonanceApplication.main` chiama `DatabaseUrl.applyIfPresent()` prima di avviare Spring: converte
`DATABASE_URL` di Render (`postgresql://utente:password@host:porta/db`) in URL JDBC con credenziali
separate, **mantenendo i parametri già presenti** (decisione 52): l'URL esterno di Render ha già
`?sslmode=require`, quello interno non ha parametri e il suo server non offre TLS, quindi `DatabaseUrl` non
aggiunge `sslmode`. Stampa solo l'URL JDBC, mai la password.

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
     **Aggiunto con la card FE-01** (19 ottobre, dopo F7-03): prima di allora `Resonance_FE` non esisteva e il
     Dockerfile aveva solo gli stage 2 e 3.
  2. stage JDK (`eclipse-temurin:25-jdk`, da NoseY): cache delle dipendenze Maven
     (`dependency:go-offline`), copia di `dist/` in `src/main/resources/static/` (quando c'è lo
     stage Node), `mvnw -DskipTests package`.
  3. stage JRE (`eclipse-temurin:25-jre`, da NoseY): solo il jar, utente non root (`USER app`),
     `EXPOSE 8080`, `-XX:MaxRAMPercentage=60` per i 512 MB del piano gratuito (la JVM usa memoria
     anche fuori dall'heap).
- **`.dockerignore` alla radice del repository** (il contesto è la radice): esclude `.git`, `docs`,
  `postman`, `**/target`, `**/node_modules`, `**/dist`, `.idea`. Le regole di NoseY sono incluse.
- **Fallback SPA** (`SpaResourceConfig`, package `web`): risorse statiche da `classpath:/static/`;
  un percorso senza file corrispondente e senza estensione, fuori da `api/` e `ws`, restituisce
  `index.html` (routing di React Router). `index.html` con `Cache-Control: no-cache`, file in
  `/assets/` (nomi con hash di Vite) con cache lunga. Senza `dist/` copiato in `static/` (per esempio nei test di
  Maven, fuori dall'immagine Docker) non c'è `index.html` e questi percorsi rispondono 404 JSON.
- **`render.yaml`** nella radice, adattato da NoseY: database `resonance-db` (free, Frankfurt) e **un
  solo servizio web** `resonance` (`runtime: docker`, `dockerContext: .`,
  `dockerfilePath: ./Resonance_BE/Dockerfile`, `branch: main`, deploy automatico,
  `healthCheckPath: /api/health`, `buildFilter` su `Resonance_BE/**`, `Resonance_FE/**`,
  `.dockerignore` e `render.yaml`), variabili della tabella 12.4 (`JWT_SECRET` con
  `generateValue: true`, segreti con `sync: false`, nessun `ALLOWED_ORIGIN`), commenti di NoseY su
  WebSocket, profilo prod e Brevo, adattati alla stessa origine. Nessun servizio statico separato e
  nessun dominio personalizzato. Il nome del servizio determina l'indirizzo
  `https://<servizio>.onrender.com`, assegnato da Render alla creazione.
- **Sviluppo locale con il frontend** (dal 18 ottobre): backend con `mvnw spring-boot:run` (profilo
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
| `docs/schema-db.md` | Tabelle, tipi, chiavi, vincoli, ER Mermaid di dettaglio e flowchart di panoramica dello schema applicato | A ogni migrazione che modifica lo schema, nello stesso sotto-task |
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
| 16 ott (pom.) – 17 ott | F4-01 · F4-02 · F4-03 · F4-04 · F4-05 | 2 h · 3 h · 2,5 h · 4 h · 1,5 h | 13 h | **alto**: F3 chiusa in anticipo, ma il margine del 17 è consumato |
| 18 ott | F5-01 · F5-02 · F5-03 · F5-04 | 3,5 h · 4,5 h · 3,5 h · 1,5 h | 13 h | **alto**: WebSocket, chiusura sessioni e permesso di scrittura |
| 19 ott | F6-01 · F6-02 · F6-03 | 4,5 h · 3 h · 2,5 h | 10 h | **alto**: nessun margine, con 1,5 h tagliabili in F6-01 |

**Aggiornamento del calendario (18 ottobre, scelta dello studente).** Il backend è in anticipo: F6 è chiusa il 17
ottobre e il 18 si chiudono F7-01 e F7-02. Il frontend parte quindi il 18 ottobre, subito dopo F7-03 (l'ultima card
del backend), invece del 20; i giorni guadagnati vanno al frontend.

Totale backend circa 70 ore (60 + 8,5 della decisione 59 + 1,5 delle prove di mutazione e della collection
Postman in F6-01). Giorni a rischio: 14, 15, 17, 18 e 19. Il
giorno di anticipo accumulato in F3 assorbe le card aggiunte il 16 ottobre, quindi non resta un giorno
di margine: se un giorno sfora si applica subito l'ordine dei tagli (brief 1-BIS, aggiornato dalla
decisione 59): verifica dinamica del report → Swagger → notifiche live → contatto degli eventi (F5-04)
→ bacheca collab. Con il taglio delle notifiche live, F5-03 si riduce alla sola candidatura (messaggio
in chat e sblocco, senza notifica).

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
| F4-03 · Moderazione admin dei contenuti | `moderation`: hide/restore/hidden list per i 4 tipi, regola dei livelli | test, Postman |
| F4-04 · Amicizie | V8, `friendship`: richiesta, accetta, rifiuta, annulla, rimuovi, elenchi, rifiuto silenzioso (6.14) | test degli stati e dei permessi, Postman Friends |
| F4-05 · Ricerca utenti | `GET /api/users/search` con stato dell'amicizia (6.5) | test, Postman Users; promemoria merge |

### F5 — Real-time (18 ottobre)

| Card | Contenuto | Criterio |
|---|---|---|
| F5-01 · WebSocket, CONNECT e sessioni | `WebSocketConfig`, `JwtChannelInterceptor`, handler degli errori STOMP, registro sessioni e chiusura alla sospensione | test STOMP di connessione e sospensione |
| F5-02 · Chat | V9 (con `chat_unlocks`), REST (lista con `canSend`, crea solo fra amici, messaggi a cursore, letti), invio STOMP con ordine dei controlli e permesso di scrittura, consegna dopo il commit | test REST e STOMP, Postman (solo REST) |
| F5-03 · Notifiche live e candidature | `notification`, notifiche like/messaggio/candidatura, `POST /applications` con sblocco della chat, pagina HTML STOMP facoltativa | test after-commit e rollback, sblocco aperto e chiuso |
| F5-04 · Contatto degli eventi | `POST /contact` per concerti e indie event con sblocco fino all'inizio (6.6) | test, Postman Events; promemoria merge |

### F6 — Hardening e rilascio (19 ottobre)

| Card | Contenuto | Criterio |
|---|---|---|
| F6-01 · Hardening e test | Revisione di sicurezza del codice (config, log, errori), test mancanti, prove di mutazione sui controlli di accesso e collection Postman eseguita per intero (tagliabili), build completa | `mvnw verify` verde |
| F6-02 · Swagger e report di sicurezza | springdoc + Swagger UI, `report-sicurezza.md` (statica + dinamica, Strix se disponibile) | report con risultati reali |
| F6-03 · Fallback SPA e deploy finale | `SpaResourceConfig` e regola di sicurezza per i `GET` statici, verifica del cookie in browser sulla stessa origine, preparazione degli account della demo, README finale | test del fallback (index di prova, `/api/...` inesistente → 404 JSON), deploy finale verificato; promemoria merge |

### F7 — Valutazione dell'ottimizzazione (condizionata, dopo F6-03)

| Card | Contenuto | Criterio |
|---|---|---|
| F7-01 · Valutazione dell'ottimizzazione del backend | Sessione di brainstorming (superpowers, Opus 5.5) su ciò che si può alleggerire o riorganizzare senza cambiare il comportamento; misure dei punti lenti; documento di proposte con rischio e beneficio | `docs/ottimizzazione.md` con le proposte; nessun file di codice modificato; decisione dello studente se e come realizzarle (decisione 71) |
| F7-02 · Realizzazione delle proposte di ottimizzazione | Le cinque proposte ammesse di `docs/ottimizzazione.md` (O1–O5), senza cambi di comportamento; O3 per ultima, primo taglio | `./mvnw -q verify` verde con gli stessi test; collection Postman con gli stessi esiti prima e dopo; prove di copertura su O1 e O3; documento aggiornato con le proposte realizzate (decisione 75) |
| F7-03 · Rinforzo di sicurezza: login, sessioni, geocodifica e body | Dall'analisi di sicurezza del 18 ottobre: limite dei login falliti prenotato in modo atomico (S2), reset della password serializzato con refresh e login sulla riga dell'utente (S1), attesa massima della geocodifica e limite `EVENTS_CREATED` (S3), tetto del body JSON (S5, primo taglio) | `./mvnw -q verify` verde; prove di mutazione di S1 e S2 intercettate da test con nome; Postman con gli stessi esiti di F7-02; report di sicurezza e decisione 76 aggiornati |
| F7-04 · Elenchi dei contenuti dell'utente | `GET /mine` per concerti ufficiali, annunci collab e post del feed, con le regole di `indie-events/mine` (decisione 77), per l'area personale del frontend; prima di FE-01 | `./mvnw -q verify` verde; Postman con i tre elenchi (200 e 401); sezioni 6.6–6.8 e decisione 77 aggiornate; promemoria merge |

F7 non fa parte del calendario del 25 ottobre: parte solo se dopo F6-03 resta tempo e il frontend ha la
precedenza dal 18 ottobre, dopo F7-03. Se manca tempo si salta senza conseguenze sulle funzionalità. Dopo F7-01 lo studente ha
scelto di realizzare tutte le proposte in F7-02 (decisione 75; prevista il 19 ottobre, realizzata il 18). Dopo l'analisi di sicurezza del 18
ottobre ha aggiunto F7-03 (circa 4 ore, prima del frontend), con le correzioni S1, S2, S3 e S5; la CSP (S4) passa a
FE-11 e le altre voci restano rischi accettati (decisione 76). Durante la pianificazione del frontend ha aggiunto
F7-04 (circa 3 ore, il 19 ottobre prima di FE-01): gli elenchi dei contenuti dell'utente entrano nell'MVP
(decisione 77).

Ordine dei tagli in caso di ritardo (brief 1-BIS, aggiornato dalla decisione 59): verifica dinamica
del report → Swagger → notifiche live → contatto degli eventi (F5-04) → bacheca collab. Mai tagliati:
autenticazione a due token, ruoli e admin, eventi con geolocalizzazione, feed con like, chat con
amicizie e ricerca utenti (la chat ne dipende), demo di promozione e sospensione, documentazione
essenziale.

### Dipendenze fra fasi

F0 → F1 → F2 (primo deploy) → F3 → F4 → F5 → F6 → F7 (condizionata). La ricerca (F4-05) richiede le amicizie (F4-04); la
chat (F5-02) richiede le amicizie; le candidature (F5-03) richiedono chat (F5-02) e collab (F4-01); il
contatto degli eventi (F5-04) richiede la chat e gli eventi (F3); le notifiche dei like richiedono il
feed (F4-02); la chiusura delle sessioni (F5-01) completa la sospensione di F2-02.

### Card FE (lista "FE in attesa")

Piano dettagliato in `docs/superpowers/plans/2026-10-18-resonance-frontend.md` (fonte di verità per sotto-task,
stime e test); scelte del piano nella decisione 78.

| Fase | Card | Stima |
|---|---|---|
| A · Fondamenta (19–20 ott) | FE-01 Setup, build integrata, token e riuso · FE-02 Client API e refresh silenzioso · FE-03 Registrazione, verifica, login e password | 4 h · 4 h · 5 h |
| B · Contenuti (20–21 ott) | FE-04 Profilo, ruoli e area personale · FE-05 Eventi vicini e mappa · FE-06 Pubblicazione eventi · FE-07 Feed, like e testo degli utenti · FE-08 Collab e candidature | 4 h · 4 h · 3,5 h · 4,5 h · 3 h |
| C · Social e admin (22–23 ott) | FE-09a Amicizie e ricerca utenti · FE-09b Chat, notifiche e contatto · FE-10 Area di moderazione | 3,5 h · 6 h · 4 h |
| D · Rilascio (23 ott) | FE-12 Rifinitura (impeccable e ReactBits) · FE-11 Deploy integrato, `Content-Security-Policy` (decisione 76) e prova della demo | 3 h · 4 h |

Calendario: 19 ottobre F7-04, FE-01, FE-02; 20 FE-03, FE-04, FE-05; 21 FE-06, FE-07, FE-08; 22 FE-09a, FE-09b; 23
FE-10, FE-12, FE-11; demo il 24, con la mattina come unico margine. Merge `develop → main` a fine di F7-04 e di ogni
fase del frontend.

Aggiunta del 22 ottobre (richiesta dello studente, nessun taglio): F7-08 Nome utente unico (backend e frontend, circa 2,5 h, prima di F7-06), F7-06 Notifiche persistenti (backend, circa 3,5 h) e FE-13 Notifiche
persistenti (frontend, circa 3,5 h) e F7-07 Prova di sicurezza dinamica con Strix (circa 3 h, dipende dalle segnalazioni), stime
provvisorie, in quest'ordine prima di FE-12 e FE-11. L'ambito si decide a inizio card; F7-06 e FE-13 sostituiscono la parte della
decisione 59 che metteva le notifiche delle amicizie in Post-V1. Dettagli nel piano del frontend.

Ordine dei tagli del frontend: ReactBits (in FE-12) → notifiche live → contatto degli eventi → bacheca collab →
revisione con impeccable (in FE-12). Mai tagliati, oltre a quelli del backend: registrazione e verifica, password
dimenticata, profilo, ruoli e area personale, pubblicazione degli eventi, responsive sui tre breakpoint, test mirati.
Vincolo per tutte le card FE: niente script inline, script da CDN o `eval`; testo degli utenti solo come elementi
React (decisione 79).

### Demo finale

Promozione di un utente ad ADMIN da parte del SUPERADMIN; sospensione di un utente con motivo e
durata (login rifiutato con i dettagli, sessione WebSocket chiusa); riattivazione; nascondere e
ripristinare un contenuto; eventi vicini sulla mappa; feed con like; ricerca di un utente, richiesta
di amicizia accettata e chat in tempo reale con notifica; candidatura a un annuncio che sblocca la chat
fra non amici.

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
| `follows` | tabella con PK composta (follower, followed): seguire senza reciprocità, accanto alle amicizie dell'MVP (decisione 59) |
| Fine degli eventi (`end_date`) | colonna nullable con una nuova migrazione; oggi lo sblocco della chat di un evento finisce all'inizio |
| Ricerca utenti con indice trigram (`pg_trgm`) | oggi `ILIKE` senza indice, adeguato ai volumi dell'MVP |
| `indie_events.official_concert_id` | colonna nullable aggiunta con una nuova migrazione |
| Appeal delle sospensioni | i campi di sospensione esistono già |
| Upload immagini | oggi solo URL |
| Centratura delle immagini scelta dall'utente | oggi le immagini dei post sono ritagliate al centro (`object-fit: cover`); servirebbe un punto di interesse scelto dall'utente per ogni immagine (salvato col post) e `object-position` nella card, anche per foto profilo e copertine |
| Partecipazione agli eventi ("parteciperò") ed elenco degli eventi a cui si partecipa | tabella con chiave composta (utente, evento) per concerti e indie event, base per i `tickets`; gli elenchi dei contenuti creati sono già nell'MVP (decisione 77). Richiesta dello studente il 22 ottobre: il pulsante «parteciperò» nella card e nel dettaglio dell'evento, e l'elenco dei partecipanti, con la richiesta di amicizia da lì per poi scriversi |
| Testo ricco nei contenuti (grassetto, menzioni, markdown) | `UserText` è l'unico punto di visualizzazione: DOMPurify rientra lì con una lista di tag ammessi (decisione 79) |
| Profilo pubblico visibile a un anonimo solo se l'utente ha contenuti pubblicati | oggi `GET /api/users/{id}` è pubblico per ogni utente verificato (sezione 6.5); la regola richiede un controllo nel backend (404 per l'anonimo senza concerti, indie event, annunci o post pubblici) e cambia il design (decisione 86) |
| Carosello degli eventi principali | un carosello animato (Motion o ReactBits) che mette in evidenza gli eventi principali, per esempio i più partecipati; oggi manca il dato: la partecipazione agli eventi è essa stessa Post-V1 (riga «Partecipazione agli eventi»), quindi i criteri possibili sono due, da scegliere allora: prossimi eventi per data o per vicinanza (nessun cambiamento al backend) oppure più partecipati (dopo la tabella delle partecipazioni); da verificare il peso del bundle e la CSP, come per i componenti di FE-12 (decisione 78) |
| Elenco di generi da scegliere (chip a selezione) | oggi i generi sono testo libero, normalizzato (minuscolo, senza doppioni, 30 caratteri, al massimo 10: sezioni 6.6 e 6.7); una lista di generi proposti da toccare, con la scrittura libera per quelli rari, riduce i doppioni («post-rock» e «post rock») e prepara i filtri della bacheca; solo frontend, il backend resta invariato (decisione 90) |
| Titolo nei post del feed | candidata alle rifiniture (FE-12) se avanza tempo; oggi il post ha solo testo (1–2000), immagine e coordinate (sezione 6.8); servirebbero una colonna in `feed_posts` con una migrazione, il DTO e Postman, quindi una modifica al backend fuori dal piano frontend (decisione 90) |
| Suggerimento degli indirizzi mentre si scrive | oggi l'indirizzo di concerti e indie event è testo libero, geocodificato da Nominatim solo alla pubblicazione (D3, sezione 6.6) e un indirizzo sbagliato si scopre con `ADDRESS_NOT_FOUND`; servirebbe un endpoint del backend (per esempio `GET /api/geocoding/suggest`) con un limite di richieste, perché il frontend non può chiamare Nominatim (CSP, decisione 76) e la sua policy ammette al massimo 1 richiesta al secondo senza autocompletamento puro; da riprendere se avanza tempo prima della consegna (decisione 90) |
| Ricerca dei luoghi nella pagina Eventi | richiesta dello studente il 24 ottobre (con il suggerimento degli indirizzi, rimandata a Post-V1): una barra per cercare un luogo e vedere gli eventi nel raggio attorno al luogo scelto, con il raggio già presente. Serve un endpoint nel backend che trasformi il nome del luogo in coordinate (oggi Nominatim è usato solo alla pubblicazione, D3, sezione 6.6). Il Nominatim pubblico vieta la ricerca mentre si scrive: la strada più semplice è la ricerca con invio, che lo rispetta; per i suggerimenti a ogni lettera servirebbe un altro servizio (per esempio Photon) con le sue regole e la sua CSP. Si appoggerebbe a `useSearchCenter`, che oggi usa posizione del browser, profilo o Firenze |
| Filtri della bacheca collab per ruolo o strumento | oggi `GET /api/collab-posts` non ha filtri e la bacheca è un elenco dal più recente; servono parametri nell'API (per esempio `role`) e, se si vogliono i chip degli strumenti del mock-up, un elenco di valori fra cui scegliere (decisione 90) |
| Candidature con accettazione o rifiuto da parte dell'autore | oggi la candidatura è solo un messaggio in chat (decisione 24) e l'autore chiude l'annuncio quando vuole; servirebbero una tabella delle candidature con lo stato, endpoint per accettare e rifiutare, notifiche e una migrazione; l'accettazione potrebbe tenere lo sblocco della chat anche dopo la chiusura (sezione 6.9, decisione 90) |
| Modifica dei propri contenuti (concerti, indie event, annunci, post) | oggi il proprietario può solo creare, pubblicare una bozza e cancellare (sezioni 5.7 e 6.6); servono endpoint `PATCH` riservati al proprietario, con le stesse regole di validazione della creazione e, per gli eventi, una nuova geocodifica se cambia l'indirizzo |
| Stato «recapitato» dei messaggi e lettura in diretta | oggi un messaggio ha solo `readAt` (sezione 6.9) e il backend non avvisa chi ha scritto quando l'altro legge (sezione 7.4: nessun evento di lettura); servirebbero una colonna di recapito (per esempio `delivered_at`) con una migrazione e un evento STOMP per recapito e lettura sulla coda dei messaggi di chi ha scritto; il frontend (card FE-09b) mostra già la spunta singola per «inviato» e la doppia colorata per «letto», aggiornata solo al caricamento dei messaggi; la doppia spunta di «recapitato» si aggiungerebbe allora |
| Cancellazione dei messaggi di chat (come WhatsApp) | richiesta dello studente il 22 ottobre. Oggi un messaggio non si può togliere (sezione 6.9). Da decidere quando si fa: «elimina per me» e/o «elimina per tutti», limite di tempo, cosa vede l'altro («Questo messaggio è stato eliminato»), campo `deleted_at` o simile sul messaggio, anteprima della conversazione, aggiornamento in diretta sul WebSocket |
| Nome e cognome degli utenti | richiesta dello studente il 22 ottobre, dopo la scelta del nome utente unico (F7-08): due colonne `first_name` e `last_name` nella tabella `users`, facoltative o obbligatorie solo per i nuovi account (gli esistenti non li hanno), con le regole su emoji e caratteri invisibili (decisione 84). Da decidere: visibilità (pubblica o solo agli amici), ricerca, profilo pubblico; dati personali, quindi legati al GDPR (Post-V2) |
### Post-V2

Notifiche push per browser e mobile; integrazione Spotify; acquisto dei biglietti dei concerti
ufficiali (Stripe); piano premium per HOST; personalizzazione dei biglietti con AI; 2FA (nuovo
valore `TWO_FACTOR` di `email_code_purpose`); GDPR e anonimizzazione; login social con Firebase Auth
limitato all'autenticazione (`password_hash` diventerebbe nullable, PostgreSQL resta il database
applicativo).

Immagini reali dell'app (schermate dei quattro tab) nella landing page, quando ci saranno dati di prova veritieri (richiesta dello studente il 24 ottobre; oggi la landing usa una mappa di esempio disegnata, decisione 108).
