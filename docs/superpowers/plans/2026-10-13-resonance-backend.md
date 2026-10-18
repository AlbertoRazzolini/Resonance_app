# Resonance Backend — Piano di implementazione

> **Per chi esegue:** usare `superpowers:executing-plans`, **una card alla volta**, seguendo il ciclo
> di `CLAUDE.md` (card in "In corso", sotto-task in ordine, checkbox Trello spuntata a fine
> sotto-task, stop a fine card). **Nessun commit**: a fine card si propone il messaggio, il commit
> lo esegue lo studente. I sotto-task usano la sintassi `- [ ]`. TDD: prima il test che fallisce,
> poi il codice minimo, poi il test verde.

**Obiettivo:** backend Spring Boot di Resonance (auth a due token, ruoli, eventi geolocalizzati,
collab, feed, chat e notifiche STOMP), distribuito su Render come servizio unico.

**Architettura:** monolite Spring Boot organizzato per dominio (`it.epicode.resonance.*`),
PostgreSQL con Flyway, JWT di accesso + refresh token opaco in cookie, STOMP con broker semplice.
Riuso selettivo di NoseY secondo `docs/riuso-nosey.md`.

**Stack:** Java 25, Spring Boot 4.1.1 (webmvc, data-jpa, security, validation, websocket, mail,
thymeleaf, flyway), jjwt 0.13.0, PostgreSQL 17 (Docker, porta 5433), Lombok, JUnit 5 + AssertJ +
MockMvc, springdoc-openapi (F6), Docker multi-stage, Render.

**Spec:** `docs/progettazione.md` (approvato il 13 ottobre). Le sezioni citate come "§N" sono di
quel documento. Il piano è la fonte di verità; Trello (board `Sviluppo_Resonance`) è lo specchio.

## Vincoli globali

- Package base `it.epicode.resonance`; codice, classi, tabelle e colonne in inglese; commenti e
  documentazione in italiano; commenti sulle scelte non ovvie con "progettazione, sezione N"; una riga
  di Javadoc su ogni classe e metodo non banale, e una riga per classe di test (decisione 42).
- Chiavi primarie ed esterne `uuid`, `GenerationType.UUID`; `ddl-auto: validate`, mai `update`.
- Migrazioni Flyway `V1`…`V9` come §3.6 (`V8` amicizie, `V9` chat: decisione 59); mai modificare una
  migrazione già applicata.
- Chat solo fra amici o con uno sblocco aperto (decisione 59, §6.9): la chat libera del brief è
  sostituita.
- Ruoli e stato sempre dal database, mai dai claim del JWT (§5.2).
- Access token 15 min (`ACCESS_TOKEN_TTL`), refresh 10 giorni (`REFRESH_TOKEN_TTL`), finestra
  di tolleranza 10 s (`app.auth.refresh-grace`).
- Cookie `resonance_refresh`: `HttpOnly`, `Path=/api/auth/refresh`, `Max-Age=864000`,
  `SameSite=Lax`, `Secure` true in prod e false in dev.
- Errori sempre come `ErrorResponse {status, code, error, message, fields, details, timestamp}`;
  codici del catalogo §6.2.
- Paginazione `page` (default 0) e `size` (default 20, max 100) → `PageResponse`; chat a cursore.
- Endpoint pubblici `/api/**` elencati uno per uno in `SecurityConfig` (§6.3).
- Segreti solo da variabili d'ambiente; mai password, token o codici nei log (salvo
  `LogEmailService` in dev).
- Package nuovo → `package-info.java` nello stesso sotto-task. Migrazione → `docs/schema-db.md`
  nello stesso sotto-task. Decisione nuova → `docs/decisioni.md`. Endpoint REST nuovo o modificato
  → Postman (successo + almeno un errore).
- Build e test: dalla cartella `Resonance_BE`, `./mvnw -q verify` (in PowerShell `.\mvnw.cmd -q
  verify`); singola classe `./mvnw -q test -Dtest=NomeClasse`. Prerequisito dei test:
  `docker compose up -d` dalla radice.
- Mai `git commit`, `git push` o altre operazioni Git che modificano il repository; nessuna
  attribuzione a strumenti automatici nei messaggi proposti e nei file.

## Review Focus

Casi che la spec implica ma che nessun test esplicito delle card coprirebbe; ogni riga ha il suo
test aggiunto alla card indicata.

1. **Email con maiuscole o spazi** al login dopo una registrazione in minuscolo → stesso utente
   (test `login_normalizesEmail` in F1-02; `register_normalizesEmail` in F1-03).
2. **Password multibyte oltre 72 byte ma sotto 72 caratteri** (es. 30 emoji) → 400
   `VALIDATION_ERROR` in registrazione, 401 `INVALID_CREDENTIALS` al login senza chiamare BCrypt
   (test in F1-03 e F1-02).
3. **Date senza fuso orario** (`"2026-10-20T21:00"`) negli eventi → 400 `VALIDATION_ERROR` con
   campo `eventDate`, non 500 (test `create_rejectsDateWithoutOffset` in F3-02).
4. **Ricerca nearby vicino ai poli** (`lat=89.99`) → nessuna divisione per zero nel bounding box,
   risposta 200 (test `nearby_nearPole_doesNotFail` in F3-02; `NearbyQuery` limita `cos(lat)`).
5. **Parametri di paginazione fuori range** (`page=-1`, `size=0`, `size=1000`) → 400
   `VALIDATION_ERROR` (test `pagination_rejectsOutOfRange` in F2-02 sull'elenco admin, regola
   comune in `PageParams`).

---

## Struttura dei file

```
Resonance_app/
├── CLAUDE.md · README.md · render.yaml · docker-compose.yml · .dockerignore · .gitignore
├── docker/postgres/init/01-create-test-db.sql
├── postman/resonance.postman_collection.json · resonance-local.postman_environment.json · resonance-render.postman_environment.json
├── tools/stomp-test/index.html                     (F5-03, facoltativo)
└── Resonance_BE/
    ├── Dockerfile · pom.xml · mvnw · .mvn/
    └── src/main/java/it/epicode/resonance/
        ├── ResonanceApplication.java
        ├── config/      SecurityConfig, CorsConfig, WebSocketConfig, AsyncConfig, SchedulingConfig, ClockConfig, DatabaseUrl, OpenApiConfig, JsonLimitsConfig
        ├── common/      AppException, ErrorCode, ErrorResponse, GlobalExceptionHandler, StompErrorHandler, WebSocketExceptionHandler, WsError, PageResponse, PageParams, RateLimit, RateLimitService, HttpUrl(+Validator), NotBlankIfPresent
        ├── auth/        AuthController, AuthService, AccessTokenService, RefreshTokenService, RefreshToken(+Repository), RefreshCookieFactory, RefreshOutcome, EmailCode(+Repository), EmailCodeService, EmailCodePurpose, JwtFilter, JwtChannelInterceptor, AuthenticatedUser, UserAccessService, UserAccess, SuperadminBootstrap, PasswordMax72Bytes(+Validator), dto/
        ├── user/        User, UserRole, UserRoleId, Role, UserStatus, UserRepository, UserRoleRepository, UserController, UserService, PlatformLevelPolicy, dto/
        ├── admin/       AdminUserController, SuperadminController, AdminUserService, UserSuspendedEvent, dto/
        ├── moderation/  Moderation, ModeratedContentType, ModerationController, ModerationService, dto/
        ├── geo/         GeoPoint, NearbyQuery, NearbyRow, GeocodingService, NominatimGeocodingService
        ├── event/       OfficialConcert, IndieEvent, IndieEventStatus, repository, service, controller, dto/
        ├── collab/      CollabPost, CollabPostRepository, CollabService, CollabController, dto/
        ├── feed/        FeedPost, PostLike, PostLikeId, repository, FeedService, FeedController, dto/
        ├── friendship/  Friendship, FriendshipStatus, FriendshipView, FriendshipRelation, FriendshipRepository, FriendshipService, FriendshipController, UserSearchService, UserSearchController, dto/
        ├── chat/        ChatConversation, ChatMessage, ChatUnlock, ChatUnlockId, ChatUnlockSource, repository, ChatService, ChatController, ChatWebSocketController, ChatMessageEvent, ChatMessageListener, dto/
        ├── notification/ LiveNotification, NotificationType, LiveNotificationEvent, LiveNotificationListener
        ├── websocket/   WebSocketSessionRegistry, UserSuspendedSessionCloser
        ├── mail/        EmailService, HtmlEmailService, LogEmailService, BrevoEmailService, EmailEventListener, eventi
        └── web/         HealthController, SpaResourceConfig
    └── src/main/resources/ application.yml, application-{dev,prod,test}.yml, db/migration/V1..V9, templates/mail/*.html
    └── src/test/java/it/epicode/resonance/ support/ (IntegrationTest, MutableClock, TestClockConfig, StubGeocodingConfig) + test per package
```

`dto/` è un sotto-package con il proprio `package-info.java` ("DTO di richiesta e risposta del
dominio X").

---

## Interfacce condivise (riferimento per tutte le card)

| Tipo | Firma | Card che lo crea |
|---|---|---|
| `AppException` | `AppException(ErrorCode code, String message)`, `(code, message, Map<String,String> fields)`, `withDetails(Map<String,Object>)` | F0-03 |
| `ErrorCode` | enum con `HttpStatus httpStatus()` (null per i codici solo WebSocket) | F0-03 |
| `PageResponse<T>` | `record(List<T> content, int page, int size, long totalElements, int totalPages)`, `static from(Page<T>)` | F0-03 |
| `PageParams` | `record(@Min(0) Integer page, @Min(1) @Max(100) Integer size)`, `null` → default 0/20 (decisione 44), `Pageable toPageable(Sort)` | F0-03 |
| `RateLimitService` | `consume(RateLimit, String key)`, `check(...)`, `record(...)`, `reset(...)` | F0-03 |
| `Role` / `UserStatus` | enum `FAN, MUSICIAN, HOST, ADMIN, SUPERADMIN` / `ACTIVE, SUSPENDED` | F0-02 |
| `AccessTokenService` | `IssuedAccessToken issue(UUID userId)`; `Optional<AccessTokenClaims> parse(String token)`; record `IssuedAccessToken(String token, Instant expiresAt)`, `AccessTokenClaims(UUID userId, Instant expiresAt)` | F1-01 |
| `UserAccessService` | `UserAccess resolve(UUID userId)` (applica la riattivazione pigra); record `UserAccess(UUID userId, AccessStatus status, Set<Role> roles, String suspensionReason, Instant suspendedUntil)`; enum `AccessStatus { ACTIVE, SUSPENDED, NOT_VERIFIED, NOT_FOUND }` | F1-01 |
| `AuthenticatedUser` | `record(UUID id, Set<Role> roles, Instant accessTokenExpiresAt) implements Principal` | F1-01 |
| `RefreshTokenService` | `IssuedRefreshToken create(UUID userId)`; `RefreshOutcome rotate(String rawValue)`; `void revoke(String rawValue)`; `void revokeAll(UUID userId)`; `void deleteExpired()` | F1-02 |
| `RefreshOutcome` | sealed: `Rotated(UUID userId, IssuedRefreshToken token)`, `Conflict()`, `Rejected(ErrorCode code, boolean clearCookie, Map<String,Object> details)` | F1-02 |
| `RefreshCookieFactory` | `ResponseCookie create(String value)`, `ResponseCookie clear()` | F1-02 |
| `EmailCodeService` | `String issue(UUID userId, EmailCodePurpose purpose)`; `void verify(UUID userId, EmailCodePurpose purpose, String code)` (consuma il tentativo, lancia `CODE_EXPIRED`/`CODE_INVALID`); `void invalidate(UUID userId, EmailCodePurpose purpose)` | F1-03 |
| `PlatformLevelPolicy` | `int levelOf(Set<Role>)`; `void requireCanActOn(UUID actorId, Set<Role> actorRoles, UUID targetId, Set<Role> targetRoles)` → `INSUFFICIENT_PLATFORM_LEVEL` | F2-02 |
| `UserSuspendedEvent` | `record(UUID userId)` | F2-02 |
| `GeocodingService` | `GeoPoint geocode(String address)`; `record GeoPoint(double latitude, double longitude)` | F3-01 |
| `NearbyQuery` | `record(double lat, double lng, double radiusKm)`; `minLat()`, `maxLat()`, `minLng()`, `maxLng()` | F3-01 |
| `Moderation` | `@Embeddable` (`hiddenAt`, `hiddenBy`, `hiddenReason`); `boolean isHidden()`; `void hide(UUID by, String reason, Instant at)`; `void restore()`; `boolean hiddenByAuthor(UUID authorId)`. La cancellazione del proprietario la fa il service di ogni dominio (`delete(UUID id, String reason, UUID userId)`) con `hide` | F3-02 |
| `ModerationService` | `void hide(ModeratedContentType, UUID id, String reason, AuthenticatedUser admin)`; `void restore(ModeratedContentType, UUID id, AuthenticatedUser admin)`; `PageResponse<HiddenContentResponse> listHidden(ModeratedContentType, PageParams)` | F4-03 |
| `FriendshipService` | `boolean areFriends(UUID a, UUID b)`; `Map<UUID, FriendshipRelation> relationsFor(UUID me, Collection<UUID> otherIds)`; record `FriendshipRelation(FriendshipView status, UUID friendshipId)`; enum `FriendshipView { NONE, OUTGOING, INCOMING, FRIENDS, UNAVAILABLE }` | F4-04 |
| `ChatService` | `ConversationResponse findOrCreate(UUID me, UUID recipientId)` (conversazione nuova solo fra amici); `ChatConversation findOrCreateConversation(UUID a, UUID b)` (interno: senza amicizia né `CONVERSATIONS_CREATED`, per candidature e contatti); `void unlock(ChatConversation c, ChatUnlockSource source, UUID sourceId)`; `boolean canSend(ChatConversation c)`; `ChatMessage appendMessage(ChatConversation c, UUID senderId, String body)`; `ChatMessage sendUnlockedMessage(UUID senderId, UUID recipientId, ChatUnlockSource source, UUID sourceId, String body)` (F7-02: conversazione, sblocco, messaggio e `ChatMessageEvent` per candidature e contatti); `void send(UUID conversationId, SendMessageRequest req, AuthenticatedUser user)` | F5-02 |
| `LiveNotificationEvent` | `record(UUID recipientId, LiveNotification notification)`; `LiveNotification(NotificationType type, Instant createdAt, AuthorSummary actor, UUID targetId, String preview)` | F5-03 |
| `AuthorSummary` | `record(UUID id, String displayName, String avatarUrl)` in `user.dto` | F2-01 |

---

# F0 — Setup (13 sera – 14 ottobre)

### Card F0-01 · Progetto Maven, package e profili — stima 2 h

**Riferimenti:** §2.1–2.3, §12.2; `docs/riuso-nosey.md` (configurazione).
**File:** modifica `Resonance_BE/pom.xml`; sposta `ResonanceBeApplication` → `it/epicode/resonance/ResonanceApplication.java`; elimina `application.properties` e `HELP.md` (generato da Initializr, ignorato da Git); crea `application.yml`, `application-dev.yml`, `application-prod.yml`, `application-test.yml`; `config/ClockConfig`, `AsyncConfig`, `SchedulingConfig`; `package-info.java` di base e `config`; `.gitignore` di radice; `README.md`; test `ResonanceApplicationTests`.

- [ ] **1. pom.xml (45 min).** groupId `it.epicode`, artifactId `resonance-be`, name `Resonance`. Dipendenze dal pom di NoseY con le stesse versioni: starter webmvc, data-jpa, validation, security, websocket, mail, thymeleaf, flyway + `flyway-database-postgresql`, `postgresql` (scope compile, serve `PSQLException`), jjwt-api/impl/jackson 0.13.0, lombok (+ annotation processor in `maven-compiler-plugin`), devtools (runtime, optional), starter-test. Esclusi: `hibernate-maven-plugin`, Actuator, dipendenze AI. Verifica: `./mvnw -q -DskipTests package` compila.
- [ ] **2. Package e classe main (20 min).** `ResonanceApplication` in `it.epicode.resonance` (la chiamata a `DatabaseUrl` arriva in F0-02); test spostato in `it.epicode.resonance.ResonanceApplicationTests`; `package-info.java` per `it.epicode.resonance` e `config`. Rimuovere il package `com.example`.
- [ ] **3. Profili YAML (40 min).** `application.yml` comune (§2.3): `spring.application.name: resonance`, esclusione `UserDetailsServiceAutoConfiguration`, `jpa.hibernate.ddl-auto: validate`, `open-in-view: false`, `jdbc.time_zone: UTC`, `mvc.log-resolved-exception: false`, `server.port: ${PORT:8080}`, `server.shutdown: graceful`, blocco `app:` con `jwt.secret: ${JWT_SECRET}`, `auth.access-token-ttl: ${ACCESS_TOKEN_TTL:15m}`, `auth.refresh-token-ttl: ${REFRESH_TOKEN_TTL:10d}`, `auth.refresh-grace: 10s`, `auth.refresh-cookie.secure`, `cors.allowed-origins: ${ALLOWED_ORIGIN:}`, `rate-limits.*` (§8.8), `geocoding.*`, `mail.*`, `bootstrap.superadmin.*`. `application-dev.yml`: datasource `jdbc:postgresql://localhost:5433/resonance` con `${DB_URL:...}`, utente/password di sviluppo, `secure: false`, origini `http://localhost:5173`. `application-prod.yml`: `secure: true`. `application-test.yml`: database `resonance_test`, `secure: false`. `ClockConfig` (`Clock.systemUTC()`), `AsyncConfig` (`@EnableAsync`), `SchedulingConfig` (`@EnableScheduling`). Il test di contesto viene disattivato con `@Disabled("abilitato in F0-02 con il database")` finché non esiste il DB: lo si dichiara nel riepilogo.
- [ ] **4. `.gitignore` di radice e README (25 min).** `.gitignore`: `**/target/`, `**/node_modules/`, `**/dist/`, `.idea/`, `*.iml`, `.env*`, `HELP.md`. README in italiano: cos'è Resonance, responsabilità del backend, prerequisiti (JDK 25, Docker), avvio locale (sezione completata in F0-02), elenco delle variabili d'ambiente (§12.4) senza valori, "Deploy: non ancora disponibile". Regola sui messaggi di commit (italiano, prefisso Conventional Commits in inglese): `CLAUDE.md` (ciclo per card, punto 4) e `docs/decisioni.md` (decisione 36).

**Criterio di completamento:** `./mvnw -q verify` verde; nessun riferimento a `com.example`.
**Documentazione:** README, `package-info.java`.
**Commit proposto:** `chore(setup): configure maven project, packages and profiles`

### Card F0-02 · PostgreSQL in Docker, Flyway V1 e health — stima 2 h

**Riferimenti:** §3.2 (`users`, `user_roles`), §3.6, §6.11, §12.1, §12.3.
**File:** `docker-compose.yml`, `docker/postgres/init/01-create-test-db.sql`; `db/migration/V1__users_and_roles.sql`; `user/User`, `UserRole`, `UserRoleId`, `Role`, `UserStatus`, `UserRepository`, `UserRoleRepository`, `package-info`; `config/DatabaseUrl`; `web/HealthController`, `package-info`; test `support/IntegrationTest`, `support/MutableClock`, `support/TestClockConfig`, `config/DatabaseUrlTest`, `web/HealthControllerTest`; `docs/schema-db.md`, README.

- [ ] **1. Docker Compose (25 min).** Servizio `resonance-db`, immagine `postgres:17`, porta `"127.0.0.1:5433:5432"` (solo localhost), `POSTGRES_DB=resonance`, `POSTGRES_USER=resonance`, `POSTGRES_PASSWORD=resonance` (credenziali di sviluppo non sensibili), volume `resonance-db-data`, mount di `./docker/postgres/init` su `/docker-entrypoint-initdb.d`. Lo script crea `resonance_test` con owner `resonance`. Verifica: `docker compose up -d`, poi `docker compose exec resonance-db psql -U resonance -l` mostra i due database.
- [ ] **2. V1 e entity (45 min).** V1 come §3.2: enum `user_role` e `user_status`; `users` con i vincoli `uq_users_email`, `ck_users_coordinates`, `ck_users_suspension`, `fk_users_suspended_by`; `user_roles` con `pk_user_roles`, `fk_user_roles_user` `ON DELETE CASCADE`, `ix_user_roles_role`. Entity `User` (Lombok, enum con `@JdbcTypeCode(SqlTypes.NAMED_ENUM)`), `UserRole` con `@EmbeddedId UserRoleId(UUID userId, Role role)`. Repository: `UserRepository.findByEmail(String)`, `findWithLockByEmail(String)` e `findWithLockById(UUID)` con `PESSIMISTIC_WRITE`; `UserRoleRepository.findRolesByUserId(UUID)` (`Set<Role>`), `existsByIdRole(Role)`.
- [ ] **3. Supporto ai test + test di avvio (30 min).** `IntegrationTest` (abstract, `@SpringBootTest`, `@ActiveProfiles("test")`, MockMvc, `@BeforeEach` con `TRUNCATE` di tutte le tabelle applicative tranne `flyway_schema_history`, `CASCADE`); `MutableClock extends Clock` con `advance(Duration)` e `setInstant(Instant)`; `TestClockConfig` con `@Primary`. Riabilitare `ResonanceApplicationTests` (contesto + `ddl-auto: validate` passano). Test `UserRepositoryTest.saveUserWithRoles` (utente con FAN+MUSICIAN, rilettura dei ruoli).
- [ ] **4. DatabaseUrl e health (25 min).** `DatabaseUrl.applyIfPresent()` tradotta da NoseY, chiamata in `main`. Test unitario `DatabaseUrlTest` sulla conversione (estrarre il metodo puro `toJdbc(String)`): `postgresql://u:p@host:5432/db` → `jdbc:postgresql://host:5432/db?sslmode=require`, porta assente → 5432, già `jdbc:` → invariato. `HealthController` `GET /api/health` → `{status:"UP", database:"UP"}`; `DataAccessException` → 503 `{status:"DOWN", database:"DOWN"}`. Test `HealthControllerTest` 200. In questa card la sicurezza è ancora quella automatica di Spring: aggiungere un `SecurityConfig` temporaneo che permette solo `/api/health` e nega tutto il resto (sostituito in F1-01).
- [ ] **5. Documentazione (15 min).** `docs/schema-db.md`: stato V1 applicata, enum, tabelle `users` e `user_roles` con tipi e vincoli, ER Mermaid (USERS, USER_ROLES, autorelazione "sospeso da"). README: `docker compose up -d`, porta 5433 (anche per pgAdmin), profilo dev, `JWT_SECRET` nella configurazione di avvio di IntelliJ.

**Criterio:** applicazione avviata con profilo dev, `GET http://localhost:8080/api/health` → 200; `./mvnw -q verify` verde; riabilitare `ResonanceApplicationTests` (rimuovere `@Disabled`) e verificare che il contesto parta con il database.
**Commit proposto:** `feat(db): add local postgres, flyway V1 users and roles, health check`

### Card F0-03 · Errori comuni, Dockerfile, Blueprint e Postman — stima 2,5 h

**Riferimenti:** §6.1–6.2, §8.8, §12.5; riuso: `GestoreErrori`, `LimitiService`, `PaginaResponse`, `NonVuoto`, Dockerfile, `render.yaml`.
**File:** `common/*` (vedi struttura) + `package-info`; test `common/GlobalExceptionHandlerTest`, `RateLimitServiceTest`, `PageParamsTest`, `HttpUrlValidatorTest`, `NotBlankIfPresentTest`; `Resonance_BE/Dockerfile`; `.dockerignore` (radice); `render.yaml`; `postman/*`; `docs/decisioni.md` (solo se emergono decisioni nuove).

- [ ] **1. Errori (45 min).** `ErrorCode` con i codici generali di §6.2 (gli altri si aggiungono card per card); `AppException` con `fields` e `details`; `ErrorResponse.of(...)`; `GlobalExceptionHandler` tradotto da NoseY (validazione, body illeggibile, type mismatch, `NoResourceFoundException` → 404, metodo non supportato → 405, `DataIntegrityViolationException` → codice dal nome del vincolo, `Exception` → 500 con log). Test con un controller di prova in `src/test`: `AppException` → status e `code`; `@Valid` fallito → 400 con `fields`; percorso inesistente → 404 JSON; nessun stack trace nel body.
- [ ] **2. Paginazione, validatori, limiti (45 min).** `PageResponse.from(Page)`, `PageParams` (record con default, test: `page=-1` → violazione, `size=1000` → violazione), `@HttpUrl` (solo http/https, max 2048; test `javascript:alert(1)` rifiutato), `@NotBlankIfPresent` (null valido, `"  "` non valido), `RateLimit` (`LOGIN_FAILED`, `CHAT_MESSAGES`, `CONVERSATIONS_CREATED`, `COLLAB_APPLICATIONS`) e `RateLimitService` da NoseY con `@Scheduled` di pulizia; test con `MutableClock`: limite raggiunto → `TOO_MANY_REQUESTS`, finestra scorsa → di nuovo ammesso.
- [ ] **3. Dockerfile e .dockerignore (30 min).** Contesto = radice del repo. Stage `build` (`eclipse-temurin:25-jdk`, `WORKDIR /app`, copia `Resonance_BE/.mvn`, `mvnw`, `pom.xml`, `dependency:go-offline`, copia `src`, `package -DskipTests`), stage finale `eclipse-temurin:25-jre` con `EXPOSE 8080` e `ENTRYPOINT ["java","-XX:MaxRAMPercentage=75","-jar","/app/app.jar"]`. Commenti di NoseY in italiano adattati; commento che lo stage Node arriva in FE-01. `.dockerignore` di radice (§12.5). Verifica: `docker build -f Resonance_BE/Dockerfile -t resonance .` dalla radice termina con successo.
- [ ] **4. render.yaml (20 min).** Come §12.5: `databases: resonance-db` (free, frankfurt); `services: resonance` web, `runtime: docker`, `dockerContext: .`, `dockerfilePath: ./Resonance_BE/Dockerfile`, `branch: main`, `autoDeploy: true`, `healthCheckPath: /api/health`, `buildFilter.paths` (`Resonance_BE/**`, `Resonance_FE/**`, `.dockerignore`, `render.yaml`), `envVars` (`DATABASE_URL` fromDatabase, `SPRING_PROFILES_ACTIVE=prod`, `JWT_SECRET generateValue`, `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL`, `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD`/`BREVO_API_KEY`/`MAIL_FROM`/`GEOCODING_CONTACT` `sync: false`), commenti esplicativi in italiano.
- [ ] **5. Postman (25 min).** Collection v2.1 `postman/resonance.postman_collection.json` con le cartelle Auth, Users, Admin, Events, Collab, Feed, Chat (vuote salvo Health in una cartella "Health"), variabile `{{baseUrl}}`; environment `resonance-local` (`baseUrl=http://localhost:8080`) e `resonance-render` (`baseUrl` vuoto finché non c'è il deploy); richiesta `GET /api/health` (successo) e `GET /api/inesistente` (404). README: sezione "Postman".

**Criterio:** `./mvnw -q verify` verde; `docker build` riuscito; Postman health ok in locale.
**Commit proposto:** `feat(common): add error handling, pagination, rate limits, docker and render blueprint`

---

# F1 — Autenticazione e ruoli (14–15 ottobre)

### Card F1-01 · Security, access token e JwtFilter — stima 2,5 h

**Riferimenti:** §4.1, §5.1–5.2, §8.1–8.4, §6.12; riuso: `SecurityConfig`, `CorsConfig`, `TokenService`, `JwtFilter`.
**File:** `auth/AccessTokenService`, `AuthenticatedUser`, `UserAccessService`, `UserAccess`, `AccessStatus`, `JwtFilter`, `package-info`; `config/SecurityConfig` (sostituisce quello temporaneo), `config/CorsConfig`; test `auth/AccessTokenServiceTest`, `UserAccessServiceTest`, `JwtFilterIntegrationTest`; `postman/resonance.postman_collection.json` (richiesta Health sul percorso inesistente).

- [ ] **1. AccessTokenService (40 min).** HS256 fisso, segreto da `app.jwt.secret` (meno di 32 byte → l'avvio fallisce), `sub` = id, `iat`, `exp` = `clock + ttl` troncato ai secondi. `parse` → `Optional.empty()` per firma errata, scaduto, malformato, `sub` non UUID. Test: emissione e lettura; scaduto dopo `advance(16 min)`; firmato con un altro segreto → vuoto; nessun claim di ruolo nel payload.
- [ ] **2. UserAccessService (40 min).** Una query per utente + ruoli; `NOT_FOUND`, `NOT_VERIFIED`, `SUSPENDED` (con motivo e scadenza), `ACTIVE`. Riattivazione pigra: `UserRepository.reactivateIfExpired(UUID id, Instant now)` (`@Modifying` `UPDATE ... WHERE status='SUSPENDED' AND suspended_until <= :now`, azzera i campi di sospensione). Test: sospeso con `until` futuro → `SUSPENDED`; `until` passato → `ACTIVE` e riga aggiornata; `until` null → resta sospeso.
- [ ] **3. JwtFilter, EntryPoint, SecurityConfig, CORS (50 min).** Filtro come §8.2 (non `@Component`); authority `ROLE_<ruolo>`; `RoleHierarchy` `SUPERADMIN > ADMIN`; EntryPoint 401 `UNAUTHENTICATED`; AccessDenied 403 `ACCESS_DENIED`; endpoint pubblici attuali: `GET /api/health`, `/error`, `/ws/**` (gli endpoint di auth si aggiungono nelle card successive). `CorsConfig` §6.12. Aggiungere a `ErrorCode`: `UNAUTHENTICATED`, `ACCESS_DENIED`. **Percorsi inesistenti (§6.3):** un `/api/...` senza handler risponde sempre 404 `NOT_FOUND` in JSON, anche senza token e anche sotto `/api/admin/**`, mai 401 o 403. Si ottiene con la **prima** regola di `SecurityConfig`: un `RequestMatcher` (basato su `HandlerMappingIntrospector`) che riconosce le richieste per cui nessun controller ha un handler e le lascia passare, così arrivano al `DispatcherServlet` e al `GlobalExceptionHandler`. I percorsi che esistono seguono le regole normali (anche con il metodo sbagliato: 401 o 403 prima del 405). Stima: questo punto può aggiungere circa 30 minuti alla card.
- [ ] **4. Test di integrazione del filtro (30 min).** Controller di prova solo nei test (`/api/test/me` autenticato, `/api/test/admin` con `hasRole("ADMIN")` via `/api/admin/test`): nessun token → 401 JSON; token malformato → 401; token scaduto → 401; utente sospeso → 401; utente FAN → 403 su admin; ADMIN promosso **dopo** l'emissione del token → 200 (ruoli dal DB); SUPERADMIN → 200 su `/api/admin/**`. Percorsi inesistenti: `/api/inesistente` e `/api/admin/inesistente` senza token → 404 `NOT_FOUND` JSON; un percorso che esiste e richiede il login (`/api/test/me`), senza token → 401; metodo sbagliato su un percorso protetto esistente, senza token → 401. Postman: la richiesta Health "Percorso non pubblico (403)" diventa "Percorso inesistente (404)", con il test sul 404.

**Criterio:** test verdi; nessuna richiesta pubblica bloccata da un token vecchio; sostituire il `SecurityConfig` temporaneo di F0-02 e aggiornare o rimuovere `HealthControllerTest.otherEndpoints_areNotPublic`; un percorso `/api/...` inesistente risponde 404 `NOT_FOUND` in JSON anche senza token (progettazione, sezione 6.3).
**Documentazione:** `package-info` di `auth`.
**Commit proposto:** `feat(auth): add stateless security, access tokens and database-backed jwt filter`

### Card F1-02 · Login, refresh con rotazione e logout — stima 3,5 h

**Riferimenti:** §4.2–4.3, §4.7–4.9, §4.11, §8.5; riuso: `AuthService.login`.
**File:** `db/migration/V2__refresh_tokens.sql`; `auth/RefreshToken`, `RefreshTokenRepository`, `RefreshTokenService`, `RefreshOutcome`, `RefreshCookieFactory`, `AuthService` (login, refresh, logout), `AuthController`, `dto/LoginRequest`, `dto/LoginResponse`, `user/dto/MeResponse`, `auth/dto/package-info`; test `RefreshCookieFactoryTest`, `RefreshTokenServiceTest`, `LoginRefreshLogoutIntegrationTest`; `docs/schema-db.md`; Postman Auth.

- [ ] **1. V2 e RefreshTokenService (60 min).** V2 come §3.2 (`refresh_tokens` con `revoked_at`, `replaced_by` `ON DELETE SET NULL`, `ck_refresh_tokens_revoked`, indici). `create`: 32 byte `SecureRandom`, base64url, hash SHA-256 esadecimale salvato. `rotate` (transazione, `findWithLockByTokenHash`): esiti di §4.8 nei passi 3–7, con revoca totale salvata anche negli esiti di errore (il service restituisce `RefreshOutcome`, non lancia). `revoke`, `revokeAll` (`UPDATE` in blocco), `deleteExpired` `@Scheduled(fixedDelay = 24h)`. Test con `MutableClock`: rotazione (vecchio revocato con `replaced_by`, nuovo con 10 giorni); token ruotato da 5 s → `Conflict` senza revoche; da 11 s → `Rejected(REFRESH_TOKEN_REUSED)` e tutti revocati; scaduto → `REFRESH_TOKEN_EXPIRED`; sconosciuto → `REFRESH_TOKEN_INVALID`; utente sospeso → `ACCOUNT_SUSPENDED` + revoca totale.
- [ ] **2. Cookie (20 min).** `RefreshCookieFactory` come §4.3. Test: attributi in dev (`Secure` assente) e in prod (`Secure`), `clear()` con `Max-Age=0` e stesso Path.
- [ ] **3. Login (40 min).** `POST /api/auth/login` come §4.7 (con confronto BCrypt fittizio per l'email sconosciuta, decisione 48), con `LoginResponse` + `Set-Cookie`; `MeResponse` include `id` (solo il proprio profilo, decisione 49); codici `INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED`, `ACCOUNT_SUSPENDED` (con `details`), `TOO_MANY_REQUESTS`. Test (utenti creati direttamente nel DB, verificati): successo con cookie; password errata → 401; email inesistente → stessa risposta; `login_normalizesEmail` (`"  Mario@Example.COM "`); password di 30 emoji → 401 senza eccezione; non verificato → 403; sospeso → 403 con `suspensionReason`; sospensione scaduta → 200; 11° fallimento → 429.
- [ ] **4. Refresh e logout via HTTP (40 min).** `POST /api/auth/refresh` e `DELETE /api/auth/refresh` (pubblici) con `X-Requested-With` obbligatorio (`CSRF_HEADER_MISSING`) e controllo dell'`Origin` (§4.8 passo 1). Mappatura di `RefreshOutcome` in risposta: `Rotated` → 200 + nuovo cookie; `Conflict` → 409 senza `Set-Cookie`; `Rejected` → codice + cookie cancellato se richiesto. Test MockMvc: refresh senza header → 403; con `Origin: https://evil.example` → 403; due refresh con lo stesso cookie a 1 s → secondo 409; logout → 204 e cookie cancellato; un refresh successivo con il cookie del logout (token revocato senza `replaced_by`) → 401 `REFRESH_TOKEN_REUSED` e revoca di tutti i token dell'utente (§4.8 passo 4).
- [ ] **5. Documentazione e Postman (30 min).** `schema-db.md` (V2, ER aggiornato). Postman Auth: Login (successo, script che salva `accessToken`; 401 password errata), Refresh (successo con `X-Requested-With`; 403 senza header), Logout (204; 403 senza header). Nella collection: autorizzazione Bearer `{{accessToken}}` a livello di collection.

**Criterio:** test della sezione 11.2 su login/refresh/logout verdi; Postman ok in locale.
**Commit proposto:** `feat(auth): add login, refresh token rotation with reuse detection and logout`

### Card F1-03 · Registrazione, verifica email e mail — stima 3 h

**Riferimenti:** §4.4–4.6, §9; riuso: `AuthService.registra/verifica/reinviaCodice`, package `mail`.
**Sicurezza: sì**
**File:** `db/migration/V3__email_codes.sql`; `auth/EmailCode`, `EmailCodeRepository`, `EmailCodePurpose`, `EmailCodeService`, `PasswordMax72Bytes`(+Validator), `dto/RegisterRequest`, `RegisterResponse`, `VerifyRequest`, `EmailRequest`; `mail/*` + `package-info`; `templates/mail/verification-code.html`; test `EmailCodeServiceTest`, `RegistrationIntegrationTest`, `BrevoEmailServiceTest`; `schema-db.md`; Postman.

- [ ] **1. V3 e EmailCodeService (60 min).** V3 come §3.2. `issue`: riga per (utente, scopo) creata o aggiornata, limiti di §4.6 (`TOO_MANY_REQUESTS`), codice `%06d` da `SecureRandom`, `attempts=0`. `verify`: codice assente/scaduto/5 tentativi → `CODE_EXPIRED`; `consumeAttempt` atomico (`UPDATE ... SET attempts = attempts + 1 WHERE id=:id AND attempts < 5`, 0 righe → `CODE_EXPIRED`) **prima** del confronto `MessageDigest.isEqual`; sbagliato → `CODE_INVALID`. Test con `MutableClock`: scadenza a 15 min + 1 s; 5 tentativi sbagliati poi anche quello giusto → `CODE_EXPIRED`; secondo invio entro 60 s → 429; sesto invio in 24 h → 429; dopo 24 h di nuovo ammesso.
- [ ] **2. Mail (40 min).** Da NoseY: `EmailService` (3 metodi: codice di verifica, codice di reset, password cambiata), `HtmlEmailService`, `LogEmailService` (`!prod`), `BrevoEmailService` (`prod`), `EmailEventListener` (`@Async` + `AFTER_COMMIT`), eventi record. Template `verification-code.html` in italiano. Test `BrevoEmailServiceTest` con `MockRestServiceServer`: header `api-key`, mittente e destinatario; chiave mancante → nessuna richiesta e nessuna eccezione.
- [ ] **3. Register, verify, resend (50 min).** Come §4.4–4.6 e ordine dei controlli §4.5 (`noRollbackFor = AppException.class`); utente nuovo con riga `FAN`; verify emette i token come il login (riusa il metodo comune). `RegisterResponse` contiene solo `{email}`: nessun id utente nelle risposte dove non serve a un'azione successiva. Codici aggiunti: `EMAIL_ALREADY_REGISTERED`, `ALREADY_VERIFIED`, `CODE_INVALID`, `CODE_EXPIRED`, `WRONG_PASSWORD`. Endpoint pubblici aggiunti a `SecurityConfig`.
- [ ] **4. Test di integrazione (30 min).** Codice letto con `@RecordApplicationEvents`. Casi: registrazione → 201 e ruolo FAN; `register_normalizesEmail`; password di 30 emoji → 400 `fields.password`; email già verificata → 409; re-registrazione di email non verificata sovrascrive `displayName`; verify corretta → 200 + cookie + `emailVerified`; codice sbagliato → 400 e tentativo consumato anche dopo il rollback della risposta; password diversa → 400 `WRONG_PASSWORD`; resend su email inesistente → 204 senza evento.
- [ ] **5. Documentazione e Postman (20 min).** `schema-db.md` (V3). Postman: Register (201; 400 email non valida), Verify (200; 400 codice sbagliato), Resend (204; 400 email mancante).

**Criterio:** test verdi; con il profilo dev il codice di verifica compare nel log scritto da `LogEmailService`; la password ha un massimo di 72 byte (UTF-8), coerente con il login (`PasswordMax72Bytes`). L'email si normalizza con `strip()` e `toLowerCase(Locale.ROOT)`, allo stesso modo del login (`LoginRequest`).
**Commit proposto:** `feat(auth): add registration, email verification codes and event-driven email`

### Card F1-04 · Password dimenticata, reset e bootstrap SUPERADMIN — stima 2 h

**Riferimenti:** §4.10, §4.12; riuso: `AuthService.passwordDimenticata/reimpostaPassword`.
**Sicurezza: sì**
**File:** `AuthService` (forgot, reset), `dto/ResetPasswordRequest`; `auth/SuperadminBootstrap`; template `password-reset-code.html`, `password-changed.html`; test `PasswordResetIntegrationTest`, `SuperadminBootstrapTest`; README; Postman.

- [ ] **1. Forgot e reset (45 min).** Come §4.10: forgot sempre 204, codice solo a utenti verificati e ACTIVE; reset con controlli come la verifica, nuovo hash, `invalidate`, `revokeAll`, cookie cancellato, `PasswordChangedEmailEvent`. Test: reset riuscito → login con la nuova password ok, vecchio refresh → 401; codice sbagliato → 400 e tentativo consumato; utente non verificato → forgot senza evento.
- [ ] **2. Bootstrap (45 min).** `ApplicationRunner` come §4.12, proprietà `app.bootstrap.superadmin.email/password` da `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD`. Test (chiamando direttamente `run`): nessun SUPERADMIN + variabili → utente creato con FAN+SUPERADMIN verificato; secondo `run` → nessuna modifica; variabili assenti → nessuna azione; email di un utente esistente → ruolo aggiunto e password impostata; password di 5 caratteri → `IllegalStateException`. Verifica che la password non compaia nel log.
- [ ] **3. Documentazione e Postman (30 min).** README: variabili `SUPERADMIN_*` e come impostarle in IntelliJ. Postman: Forgot (204; 400 email mancante), Reset (204; 400 codice sbagliato).

**Criterio:** fase F1 chiusa (11.10 del brief): build verde, test verdi, migrazioni V2–V3 applicate, Postman aggiornata; la nuova password del reset ha un massimo di 72 byte (UTF-8), coerente con il login (`PasswordMax72Bytes`). L'email si normalizza con `strip()` e `toLowerCase(Locale.ROOT)`, allo stesso modo del login (`LoginRequest`).
**Proposta (da approvare):** eseguire F2-03 (primo deploy su Render) subito dopo F1-04, per provare login e refresh dal browser con il SUPERADMIN creato dal bootstrap. Nessuna card spostata su Trello.
**Commit proposto:** `feat(auth): add password reset and superadmin bootstrap`

---

# F2 — Utenti e amministrazione (15 ottobre)

### Card F2-01 · Profilo e ruoli self-service — stima 2,5 h

**Riferimenti:** §5.3, §6.1, §6.5.
**Sicurezza: sì (facoltativa, se resta budget)**
**File:** `user/UserController`, `UserService`, `dto/MeResponse` (già creato), `UpdateProfileRequest`, `PublicUserResponse`, `AuthorSummary`, `dto/package-info`; test `ProfileIntegrationTest`, `RoleActivationIntegrationTest`; Postman Users.

- [ ] **1. GET me e profilo pubblico (30 min).** `GET /api/users/me`, `GET /api/users/{id}` (pubblico, ruoli solo di community, niente coordinate, utente non verificato → 404).
- [ ] **2. PATCH /api/users/me (60 min).** Regole di §6.5: `UpdateProfileRequest` con campi nullable; trim; `""` sui facoltativi → `NULL`; `displayName` con `@NotBlankIfPresent` e lunghezza 2–50; `avatarUrl` con `@HttpUrl` quando non vuoto; coordinate: entrambe o nessuna (validazione a livello di classe → `fields.latitude`), range. `DELETE /api/users/me/location` → 200 `MeResponse`. Test: un solo campo cambia; `bio: ""` svuota; `bio: null` non cambia; `displayName: ""` → 400; solo `latitude` → 400; `latitude: 91` → 400; entrambe → salvate; DELETE location → null; `{}` → 200 senza modifiche.
- [ ] **3. Ruoli self-service (30 min).** `POST /api/users/me/roles/musician` e `/host`, idempotenti. Test: FAN → FAN+MUSICIAN; poi HOST → tutti e tre; ripetuto → nessun duplicato; un MUSICIAN non diventa HOST.
- [ ] **4. Postman (30 min).** Users: Me (200; 401 senza token), PATCH (cambio campo; `bio: ""`; 400 `displayName: ""`; 400 una sola coordinata), DELETE location (200), profilo pubblico (200; 404), ruoli (200; 401).

**Commit proposto:** `feat(users): add profile patch, location removal and self-service community roles`

### Card F2-02 · Sospensione e nomina ADMIN — stima 3,5 h

**Riferimenti:** §5.4–5.6, §6.10; riuso: `AdminUtenteService`.
**Sicurezza: sì**
**File:** `user/PlatformLevelPolicy`; `admin/AdminUserService`, `AdminUserController`, `SuperadminController`, `UserSuspendedEvent`, `dto/SuspendUserRequest`, `AdminUserResponse`, `package-info`; test `PlatformLevelPolicyTest`, `SuspensionIntegrationTest`, `AdminRoleIntegrationTest`, `AdminUserListIntegrationTest`; Postman Admin; `decisioni.md` se emergono scelte nuove.

- [ ] **1. PlatformLevelPolicy (25 min).** Livelli §5.6. Test unitari: ADMIN su FAN ok; ADMIN su ADMIN → `INSUFFICIENT_PLATFORM_LEVEL`; SUPERADMIN su ADMIN ok; chiunque su se stesso → errore; nessuno su SUPERADMIN.
- [ ] **2. Sospensione e riattivazione (60 min).** `POST/DELETE /api/admin/users/{id}/suspension` come §5.5 (lock, policy, `LAST_SUPERADMIN`, revoca totale, evento). `SuspendUserRequest`: `reason` 1–500, `suspendedUntil` futuro, `durationDays` 1–3650, al massimo uno dei due. Test: sospensione → login 403 con dettagli e refresh 401/403; access token già emesso → 401 alla richiesta successiva; `durationDays=1` + `advance(25 h)` → login ok (riattivazione pigra); entrambi i campi → 400; ADMIN su ADMIN → 403; riattivazione manuale → login ok; utente già sospeso → dettagli aggiornati.
- [ ] **3. Nomina e revoca ADMIN (35 min).** `POST/DELETE /api/superadmin/users/{id}/admin` come §5.4 (`USER_NOT_VERIFIED`, `USER_NOT_ACTIVE`). Test: nominato → accede subito a `/api/admin/users` con il token già emesso; revocato → 403 subito; ADMIN che chiama `/api/superadmin/**` → 403; su se stesso → 403.
- [ ] **4. Elenco utenti (30 min).** `GET /api/admin/users?search&status&page&size` con `escapeLike` da NoseY, ordinamento `created_at desc, id desc`. Test: ricerca per email e per displayName; `%` cercato come carattere; `pagination_rejectsOutOfRange` (`page=-1`, `size=0`, `size=1000` → 400).
- [ ] **5. Postman (30 min).** Admin: elenco (200; 403 con utente FAN), sospensione (200; 400 entrambi i campi; 403 ADMIN su ADMIN), riattivazione (200), nomina/revoca ADMIN (200; 403 con ADMIN).

**Commit proposto:** `feat(admin): add user suspension with lazy reactivation and admin role management`

### Card F2-03 · Primo deploy su Render — stima 2 h

**Riferimenti:** §12.4–12.6.
**Proposta (da approvare):** eseguire questa card subito dopo F1-04, per provare login e refresh dal browser con il SUPERADMIN creato dal bootstrap. Nessuna card spostata su Trello.
**File:** eventuali correzioni a `render.yaml`/configurazione; `postman/resonance-render.postman_environment.json`; README.

- [ ] **1. Verifica pre-deploy (30 min).** `./mvnw -q verify` verde; `docker build` dalla radice; `docker run` in locale con `SPRING_PROFILES_ACTIVE=prod` e `DATABASE_URL` del container locale (formato Render) → avvio ok, `DatabaseUrl` non stampa la password.
- [ ] **2. Promemoria merge e applicazione del Blueprint (45 min).** Ricordare allo studente il merge `develop → main` (eseguito da lui). Guidare lo studente su Render: New → Blueprint → repository → Apply; impostare i segreti `sync: false` (SUPERADMIN, Brevo, `MAIL_FROM`, `GEOCODING_CONTACT`). Controllare i log: Flyway V1–V3, bootstrap SUPERADMIN.
- [ ] **3. Verifica con Postman e documentazione (45 min).** Environment `render` con `baseUrl` reale; health, registrazione (email reale via Brevo), verify, login, refresh, sospensione con il SUPERADMIN. README: link reale al deploy, nota sullo spin-down.

**Criterio:** fase F2 chiusa; servizio raggiungibile; promemoria merge e controlli Render forniti.
**Commit proposto:** `chore(deploy): first render deployment of the backend`

---

# F3 — Eventi e geolocalizzazione (16 ottobre)

### Card F3-01 · Nominatim e Haversine — stima 2,5 h

**Riferimenti:** §10; riuso: `Haversine`.
**File:** `geo/Haversine`, `GeoPoint`, `NearbyQuery`, `GeocodingService`, `NominatimGeocodingService`, `package-info`; test `HaversineTest`, `NearbyQueryTest`, `NominatimGeocodingServiceTest`, `support/StubGeocodingConfig`.

- [ ] **1. Haversine e NearbyQuery (40 min).** `Haversine.km` da NoseY. `NearbyQuery` con validazione (`lat` −90..90, `lng` −180..180, `radiusKm` 0,1–200) e bounding box (§10.2), con `cos(lat)` limitato a un minimo (0,01) vicino ai poli. Test: Firenze–Roma ≈ 232 km (±1); distanza zero; bounding box a lat 89,99 senza `Infinity`/`NaN`.
- [ ] **2. Client Nominatim (60 min).** `RestClient` con `JdkClientHttpRequestFactory` (connect 2 s, read 3 s), `User-Agent: Resonance/1.0 (${GEOCODING_CONTACT})`, `Accept-Language: it`, `format=jsonv2&limit=1`. Turno di 1 secondo con lock e `Clock`/sleep iniettabile. Esiti §10.1 con codici `ADDRESS_NOT_FOUND` (400, `fields.address`) e `GEOCODING_UNAVAILABLE` (502). Test `MockRestServiceServer`: risultato → `GeoPoint`; `[]` → `ADDRESS_NOT_FOUND`; 500 → `GEOCODING_UNAVAILABLE`; header User-Agent presente; due chiamate consecutive distanziate di almeno 1 s (sleeper finto che registra l'attesa).
- [ ] **3. Stub per i test (20 min).** `StubGeocodingConfig` (`@TestConfiguration`, `@Primary`): indirizzi noti → coordinate fisse (es. "Piazza della Signoria, Firenze"), `"NON TROVATO"` → `ADDRESS_NOT_FOUND`, `"DOWN"` → `GEOCODING_UNAVAILABLE`. Importato da `IntegrationTest`.

**Commit proposto:** `feat(geo): add nominatim geocoding client with rate limit and haversine utilities`

### Card F3-02 · Concerti ufficiali — stima 3 h

**Riferimenti:** §3.2, §3.5, §5.7 (proprietario), §6.6, §10.2.
**File:** `db/migration/V4__official_concerts.sql`; `moderation/Moderation`, `ModeratedContentType`, `package-info`; `event/OfficialConcert`, `OfficialConcertRepository`, `OfficialConcertService`, `OfficialConcertController`, `dto/CreateOfficialConcertRequest`, `OfficialConcertResponse`, `OwnerDeleteRequest` (in `moderation.dto`), `package-info`; test `OfficialConcertIntegrationTest`, `NearbySqlTest`; `schema-db.md`; Postman Events.

- [ ] **1. V4, entity e Moderation (40 min).** V4 come §3.2 con vincoli `ck_official_concerts_hidden`, coordinate, indici. `@Embeddable Moderation` riusabile; `genre_tags` con `@JdbcTypeCode(SqlTypes.ARRAY) List<String>`.
- [ ] **2. Creazione (50 min).** `POST /api/official-concerts` (`hasRole("HOST")`): validazione §6.6 (`eventDate` `Instant` `@Future`; genere normalizzato: trim, minuscolo, senza duplicati, max 10 × 30); geocodifica **fuori** dalla transazione (service non transazionale che chiama un metodo transazionale di salvataggio). Test: HOST → 201 con coordinate dello stub; FAN o solo ADMIN → 403; `ADDRESS_NOT_FOUND` → 400 e niente salvato; `DOWN` → 502; `create_rejectsDateWithoutOffset` → 400 `fields.eventDate`; tag `[" Rock","rock","JAZZ"]` → `["rock","jazz"]`; `coverImageUrl: "javascript:x"` → 400.
- [ ] **3. Nearby e dettaglio (50 min).** Query nativa §10.2 (bounding box + Haversine SQL + filtri `hidden_at IS NULL` e `event_date >= now`), `ORDER BY distance, event_date, id`, conteggio separato, `PageResponse` con `distanceKm`. Test: tre concerti a distanze diverse → ordine corretto e fuori raggio esclusi; passato escluso; nascosto escluso; distanza SQL ≈ `Haversine.km` (±0,01); paginazione (`size=1` → `totalElements=2`); `nearby_nearPole_doesNotFail`. `GET /{id}` → 200, nascosto → 404.
- [ ] **4. Cancellazione del proprietario (20 min).** `DELETE /api/official-concerts/{id}` (body facoltativo `{reason}`): non proprietario → 403 `NOT_OWNER`; già nascosto → 404; dopo → assente da nearby e dettaglio.
- [ ] **5. Documentazione e Postman (20 min).** `schema-db.md` (V4). Postman Events: crea (201; 403 come FAN; 400 indirizzo non trovato), nearby (200; 400 `lat` mancante), dettaglio (200; 404), delete (204; 403).

**Commit proposto:** `feat(events): add official concerts with geocoding and haversine nearby search`

### Card F3-03 · Indie event — stima 2,5 h

**Riferimenti:** §6.6, §3.2.
**File:** `db/migration/V5__indie_events.sql`; `event/IndieEvent`, `IndieEventStatus`, `IndieEventRepository`, `IndieEventService`, `IndieEventController`, `dto/CreateIndieEventRequest`, `IndieEventResponse`; test `IndieEventIntegrationTest`; `schema-db.md`; Postman.

- [ ] **1. V5 e creazione (45 min).** V5 (enum `indie_event_status`). `POST /api/indie-events` (`hasRole("MUSICIAN")`), `status` default `PUBLISHED`, stessa validazione e geocodifica dei concerti (estrarre in `event` una classe comune `EventInputNormalizer` per tag e URL, senza unificare le entità). Test: MUSICIAN → 201; HOST senza MUSICIAN → 403; utente MUSICIAN+HOST crea entrambi i tipi.
- [ ] **2. Bozze, publish, mine (45 min).** `GET /mine`, `GET /{id}` (bozza visibile solo al proprietario), `PATCH /{id}/publish` (`EVENT_ALREADY_PUBLISHED`, `EVENT_DATE_PAST`). Test: bozza invisibile in nearby e a un altro utente (404); proprietario la vede; publish → compare in nearby; publish due volte → 409; bozza con data passata (clock avanzato) → 400.
- [ ] **3. Nearby e delete (30 min).** Nearby solo `PUBLISHED`; delete del proprietario. Test analoghi a F3-02 (ordine, raggio, nascosti).
- [ ] **4. Documentazione e Postman (30 min).** `schema-db.md` (V5). Postman: crea (201; 403), mine (200; 401), publish (200; 409), nearby (200; 400), delete (204; 403).

**Criterio:** fase F3 chiusa; promemoria merge `develop → main` e controlli Render.
**Commit proposto:** `feat(events): add indie events with drafts and publishing`

---

# F4 — Collaborazioni, feed, moderazione e amicizie (16 pomeriggio – 17 ottobre)

### Card F4-01 · Annunci collab — stima 2 h

**Riferimenti:** §6.7 (senza candidature, che sono in F5-03).
**File:** `db/migration/V6__collab_posts.sql`; `collab/CollabPost`, `CollabPostRepository`, `CollabService`, `CollabController`, `dto/CreateCollabPostRequest`, `CollabPostResponse`, `package-info`; test `CollabIntegrationTest`; `schema-db.md`; Postman Collab.

- [ ] **1. V6 e creazione (40 min).** V6 come §3.2. `POST /api/collab-posts` (`hasRole("MUSICIAN")`), validazioni (`title` 3–150, `description` 1–5000, `roleNeeded` 1–100, `location` ≤150, tag normalizzati). Test: MUSICIAN → 201; FAN → 403; 400 `roleNeeded` mancante.
- [ ] **2. Lista, dettaglio, close, delete (50 min).** Lista aperti e non nascosti per `created_at desc, id desc`; dettaglio (anche chiusi); `PATCH /{id}/close` idempotente; `DELETE` del proprietario. Test: chiuso escluso dalla lista ma visibile nel dettaglio; non proprietario → 403; nascosto → 404.
- [ ] **3. Documentazione e Postman (30 min).** `schema-db.md` (V6). Postman: crea (201; 403), lista (200; 400 `size=1000`), dettaglio (200; 404), close (200; 403), delete (204; 403).

**Commit proposto:** `feat(collab): add collaboration posts`

### Card F4-02 · Feed e like — stima 3 h

**Riferimenti:** §3.4, §6.8, §10.2.
**File:** `db/migration/V7__feed_and_likes.sql`; `feed/FeedPost`, `PostLike`, `PostLikeId`, `FeedPostRepository`, `PostLikeRepository`, `FeedService`, `FeedController`, `dto/CreateFeedPostRequest`, `FeedPostResponse`, `LikeStatusResponse`, `package-info`; test `FeedIntegrationTest`, `LikeConcurrencyTest`; `schema-db.md`; Postman Feed.

- [ ] **1. V7, creazione e dettaglio (40 min).** V7 come §3.2. `POST /api/feed-posts` (autenticato; coordinate entrambe o nessuna), `GET /{id}`, `DELETE` del proprietario. Test: FAN → 201; una sola coordinata → 400; nascosto → 404.
- [ ] **2. Lista con filtro geografico (40 min).** `GET /api/feed-posts` per `created_at desc, id desc`; con `lat/lng/radiusKm` (tutti o nessuno → 400) query nativa con bounding box + Haversine. `likedByMe` calcolato se autenticato. Test: senza filtro tutti i non nascosti; con filtro solo post con coordinate nel raggio; solo `lat` → 400; anonimo → `likedByMe=false`.
- [ ] **3. Like e unlike (60 min).** `PUT`/`DELETE /api/feed-posts/{id}/like` con `INSERT ... ON CONFLICT DO NOTHING` / `DELETE` + `UPDATE likes_count` atomico (§3.4). Test: like due volte → `likesCount=1`; unlike due volte → 0 e mai negativo; like su nascosto → 404; `LikeConcurrencyTest`: 10 utenti in parallelo (`ExecutorService`) → `likesCount=10`. (La notifica `NEW_LIKE` arriva in F5-03.)
- [ ] **4. Documentazione e Postman (30 min).** `schema-db.md` (V7). Postman: crea (201; 401), lista (200; 400 filtro incompleto), dettaglio (200; 404), like/unlike (200; 401), delete (204; 403).

**Commit proposto:** `feat(feed): add feed posts with geo filter and atomic likes`

### Card F4-03 · Moderazione admin dei contenuti — stima 2,5 h

**Riferimenti:** §5.6–5.7, §6.10.
**Sicurezza: sì**
**File:** `moderation/ModerationService`, `ModerationController`, `dto/HideContentRequest`, `HiddenContentResponse`; repository dei quattro tipi (metodi di ricerca dei nascosti); test `ModerationIntegrationTest`; Postman Admin.

- [ ] **1. Hide e restore (60 min).** `POST /api/admin/moderation/{type}/{id}/hide` (`reason` 3–500 obbligatorio) e `/restore`; `{type}` → `ModeratedContentType` (`official-concerts`, `indie-events`, `feed-posts`, `collab-posts`; valore sconosciuto → 400); policy dei livelli sull'autore; codici `CONTENT_ALREADY_HIDDEN`, `CONTENT_NOT_HIDDEN`, `RESTORE_NOT_ALLOWED`. Test per ognuno dei 4 tipi: hide → sparisce dalle liste pubbliche; restore → ricompare; hide senza motivo → 400; contenuto cancellato dal proprietario → restore 409; contenuto di un ADMIN nascosto da un ADMIN → 403; dallo SUPERADMIN → 204.
- [ ] **2. Elenco dei nascosti (40 min).** `GET /api/admin/moderation/{type}/hidden` paginato per `hidden_at desc`, con `deletedByOwner`. Test: include nascosti da admin e cancellati dal proprietario con il flag corretto; FAN → 403.
- [ ] **3. Postman (30 min).** Admin/Moderation: hide (204; 400 senza motivo; 403 come FAN), restore (204; 409 cancellato dal proprietario), elenco (200; 403).

**Commit proposto:** `feat(moderation): add admin hide and restore for moderated content`

### Card F4-04 · Amicizie — stima 4 h

**Riferimenti:** §3.2 (friendships), §6.14, §8.8, decisione 59; riuso: `AmiciziaService`, `Amicizia`, `StatoAmiciziaVista`, `AmiciziaRepository`, casi di `AmiciziaServiceTest`.
**Sicurezza: sì**
**File:** `db/migration/V8__friendships.sql`; `friendship/Friendship`, `FriendshipStatus`, `FriendshipView`, `FriendshipRelation`, `FriendshipRepository`, `FriendshipService`, `FriendshipController`, `dto/FriendRequest`, `FriendshipResponse`, `FriendshipListType`, `package-info` (anche di `dto`); `common/ErrorCode`, `RateLimit`; `application.yml` (`FRIEND_REQUESTS`); test `FriendshipIntegrationTest`; `schema-db.md`; Postman Friends.

- [ ] **1. V8 ed entity (40 min).** V8 come §3.2 (enum `friendship_status`, vincoli `ck_friendships_*`, indice univoco `uq_friendships_pair` su `LEAST`/`GREATEST`, indici). Entity `Friendship` (costruttore con richiedente, destinatario, stato, `updatedAt`), repository con `findForUpdateByPair(a, b)` e `findForUpdateById(id)` (`@Lock(PESSIMISTIC_WRITE)`). Test: contesto avviato con `ddl-auto: validate`; inserimento diretto della coppia invertita → violazione di `uq_friendships_pair`.
- [ ] **2. Richiesta e stato visto (75 min).** `POST /api/friendships {userId}` con l'ordine di §6.14 (limite → se stessi → destinatario → riga sotto lock, `saveAndFlush`); `FriendshipView` calcolata come `statoVisto` di NoseY; codici nuovi in `ErrorCode`; limite `FRIEND_REQUESTS`. Test: richiesta → 201 `OUTGOING`; ripetuta → 409 `FRIEND_REQUEST_ALREADY_SENT`; inversa → 409 `FRIEND_REQUEST_ALREADY_RECEIVED`; fra amici → 409 `ALREADY_FRIENDS`; se stessi → 400; destinatario non verificato o sospeso → 404; 21ª in 24 h → 429; senza token → 401.
- [ ] **3. Accetta, rifiuta, annulla, rimuovi (60 min).** Endpoint di §6.14 con i permessi e 404 per chi non è coinvolto. Test: accetta → `FRIENDS` per entrambi; accetta dal richiedente → 403; accetta due volte → 409; **rifiuto silenzioso**: dopo `decline` il richiedente vede ancora `OUTGOING` e una nuova richiesta → 409 `FRIEND_REQUEST_ALREADY_SENT`, mentre il destinatario vede `NONE` e può chiedere lui (riga riaperta); annullare una richiesta rifiutata → per il richiedente `NONE`; una sua nuova richiesta → `OUTGOING` ma non compare fra le `INCOMING` dell'altro; rimozione → chi ha rimosso vede `NONE` e può chiedere, l'altro vede `UNAVAILABLE` e riceve 409 `FRIENDSHIP_UNAVAILABLE`; rimuovere chi non è amico → 403 `NOT_FRIENDS`; un terzo utente → 404 su tutti gli endpoint.
- [ ] **4. Elenchi e metodi condivisi (35 min).** `GET /api/friendships?type` paginato (`updated_at desc, id desc`); `areFriends(a, b)` e `relationsFor(me, others)` con una sola query (servono a F4-05 e F5-02). Test: `INCOMING`, `OUTGOING` (compresa la rifiutata mascherata) e `FRIENDS` corretti; `type` mancante o sconosciuto → 400; `relationsFor` su tre utenti con stati diversi.
- [ ] **5. Documentazione e Postman (30 min).** `schema-db.md` (V8 ed ER). Postman, cartella Friends: richiesta (201; 400 se stessi), elenco (200; 400 senza `type`), accetta (200; 403 dal richiedente), rifiuta (204; 409 già gestita), annulla (204; 403 dal destinatario), rimuovi (204; 403 non amici).

**Commit proposto:** `feat(friendship): add friendships with silent decline`

### Card F4-05 · Ricerca utenti — stima 1,5 h

**Riferimenti:** §6.5 (ricerca), §6.14 (stato visto), §8.8, decisione 59; riuso: `escapeLike` dell'elenco admin (F2-02).
**Sicurezza: sì**
**File:** `friendship/UserSearchService`, `UserSearchController`, `dto/UserSearchResult`, `FriendshipSummary`; `user/UserRepository` (query di ricerca); `config/SecurityConfig`; `common/RateLimit`, `application.yml` (`USER_SEARCH`); test `UserSearchIntegrationTest`; Postman Users.

- [ ] **1. Query e service (40 min).** Query su `display_name` con `lower(...) like lower(:pattern) escape '\'` (escape di `%`, `_`, `\`), email verificata, stato `ACTIVE`, `id <> :me`, ordine `lower(display_name), id`, paginata con `PageParams`; stato dell'amicizia con `relationsFor` (una query per pagina). `q` dopo il trim 2–50 caratteri, altrimenti 400.
- [ ] **2. Controller, sicurezza e test (35 min).** `GET /api/users/search` autenticato, con la regola prima di quella pubblica di `GET /api/users/{id}`; limite `USER_SEARCH`. Test: trova per sottostringa senza distinguere maiuscole; esclude non verificati, sospesi e se stessi; nessuna email nel JSON; `q="a"` → 400; `q="50%"` cerca il carattere letteralmente; stati `NONE`, `OUTGOING`, `INCOMING`, `FRIENDS` con `friendshipId` solo dove serve; senza token → 401; 31ª ricerca in un minuto → 429; `GET /api/users/{id}` resta pubblico.
- [ ] **3. Postman (15 min).** Users: ricerca (200; 400 `q` troppo corto; 401 senza token).

**Criterio:** fase F4 chiusa; promemoria merge e controlli Render.
**Commit proposto:** `feat(friendship): add user search with friendship status`

---

# F5 — Real-time (18 ottobre)

### Card F5-01 · WebSocket, CONNECT e sessioni — stima 3,5 h

**Riferimenti:** §7.1–7.3, §7.8; riuso: `WebSocketConfig`, `JwtChannelInterceptor`, `GestoreErroriStomp`, `GestoreErroriWebSocket`, `ChatWebSocketTest`.
**Sicurezza: sì**
**File:** `config/WebSocketConfig`; `auth/JwtChannelInterceptor`; `common/StompErrorHandler`, `WebSocketExceptionHandler`, `WsError`; `websocket/WebSocketSessionRegistry`, `UserSuspendedSessionCloser`, `package-info`; test `support/StompTestClient`, `WebSocketSecurityTest`, `SessionCloseOnSuspensionTest`.

- [ ] **1. Config e interceptor (60 min).** `/ws` senza SockJS, origini da `app.cors.allowed-origins` (stessa origine sempre ammessa), broker `/queue`, prefissi `/app` e `/user`; interceptor come §7.2–7.3 con `UserAccessService`; `ErrorCode.TOKEN_INVALID` (solo WS); `StompErrorHandler` e `WebSocketExceptionHandler` da NoseY.
- [ ] **2. Registro sessioni (50 min).** Decorator in `configureWebSocketTransport` che registra le `WebSocketSession` per id di sessione; ascolto di `SessionConnectedEvent`/`SessionDisconnectEvent` per la mappa utente → sessioni; `closeAll(UUID userId)`. `UserSuspendedSessionCloser`: `@TransactionalEventListener(AFTER_COMMIT)` su `UserSuspendedEvent` → errore `ACCOUNT_SUSPENDED` su `/user/queue/errors` e chiusura con `CloseStatus.POLICY_VIOLATION`.
- [ ] **3. Test STOMP (60 min).** `StompTestClient` (helper su `WebSocketStompClient` con `JacksonJsonMessageConverter`, porta casuale, code bloccanti per i frame ricevuti). Casi: CONNECT senza token → frame ERROR `TOKEN_INVALID`; token scaduto → ERROR; utente sospeso → ERROR `ACCOUNT_SUSPENDED`; token valido → connesso; SUBSCRIBE a `/user/{altroId}/queue/messages` → errore `ACCESS_DENIED` su `/user/queue/errors`, connessione aperta; SEND a `/queue/x` → `ACCESS_DENIED`; sospensione via REST → la sessione aperta riceve `ACCOUNT_SUSPENDED` e viene chiusa entro 5 s.

**Commit proposto:** `feat(realtime): add authenticated stomp websocket and session closing on suspension`

### Card F5-02 · Chat — stima 4,5 h

**Riferimenti:** §3.2 (chat, chat_unlocks), §6.9, §7.4–7.7, decisione 59; riuso: cursore di `MessaggioRepository`, `ChatService.invia`, `MessaggioLiveListener`.
**Sicurezza: sì**
**File:** `db/migration/V9__chat.sql`; `chat/ChatConversation`, `ChatMessage`, `ChatUnlock`, `ChatUnlockId`, `ChatUnlockSource`, `ChatConversationRepository`, `ChatMessageRepository`, `ChatUnlockRepository`, `ChatService`, `ChatController`, `ChatWebSocketController`, `ChatMessageEvent`, `ChatMessageListener`, `dto/ConversationResponse`, `ChatMessageResponse`, `MessagePageResponse`, `SendMessageRequest`, `CreateConversationRequest`, `package-info`; `common/ErrorCode` (`NOT_FRIENDS`, `CHAT_LOCKED`); test `ChatRestIntegrationTest`, `ChatPermissionIntegrationTest`, `ChatStompIntegrationTest`; `schema-db.md`; Postman Chat.

- [ ] **1. V9 e conversazioni (60 min).** V9 come §3.2 (enum `chat_unlock_source`; coppia canonica, `uq_chat_conversations_pair`, indice del cursore; `chat_unlocks` con PK composta e `source_id` senza FK). `POST /api/chats {recipientId}`: conversazione già esistente → restituita; nuova solo se `areFriends` (altrimenti 403 `NOT_FRIENDS`), con `INSERT ... ON CONFLICT DO NOTHING` + rilettura; limite `CONVERSATIONS_CREATED`; `CANNOT_MESSAGE_SELF`; destinatario non verificato → 404. Metodo interno `findOrCreateConversation(a, b)` senza amicizia né limite (per F5-03 e F5-04). `GET /api/chats` con ultimo messaggio e `unreadCount`. Test: fra amici A→B e B→A danno la stessa conversazione; non amici → 403 `NOT_FRIENDS`; se stessi → 400; 21ª conversazione nuova in 24 h → 429.
- [ ] **2. Permesso di scrittura (45 min).** `canSend(conversation)`: `areFriends` oppure query nativa con tre `EXISTS` (§6.9, `now` dal `Clock`); `canSend` nella lista calcolato per pagina con due query; `unlock(conversation, source, sourceId)` con `ON CONFLICT DO NOTHING`. Test (sblocchi inseriti direttamente nel database: candidature e contatti arrivano in F5-03 e F5-04): amici → `canSend` vero; dopo la rimozione → falso, con lista e storico ancora leggibili; sblocco `COLLAB_POST` con annuncio aperto → vero, chiuso o nascosto → falso; sblocco `OFFICIAL_CONCERT` con evento futuro → vero, dopo `advance` oltre `event_date` → falso; `INDIE_EVENT` in bozza → falso.
- [ ] **3. Storico a cursore e lettura (40 min).** `GET /api/chats/{id}/messages?before&size` (query di NoseY su `(sent_at, id)`), `PATCH /{id}/read`. Test: 35 messaggi, `size=30` → 30 + `hasMore=true`, pagina successiva con `before` → 5 + `hasMore=false`; messaggi con stesso `sent_at` non persi né duplicati; `before` di un'altra chat → 404; non membro → 403; read → `unreadCount=0` per chi legge, invariato per l'altro.
- [ ] **4. Invio STOMP (60 min).** `@MessageMapping("/chats/{conversationId}/send")` → `ChatService.send` con l'ordine di §7.5 (permesso di scrittura al passo 5, dopo l'appartenenza); `appendMessage` aggiorna `last_message_at`; `ChatMessageEvent` → listener `AFTER_COMMIT` che invia a mittente e destinatario su `/queue/messages`. Test STOMP: messaggio fra amici ricevuto da entrambi; body vuoto → `VALIDATION_ERROR` su errors; 31° messaggio in un minuto → `TOO_MANY_REQUESTS`; token scaduto (`advance(16 min)`) con body vuoto → `TOKEN_INVALID` (prova che il token è controllato **prima** di limite e body); non membro → `NOT_CONVERSATION_MEMBER`; amicizia rimossa → `CHAT_LOCKED`, connessione aperta.
- [ ] **5. Documentazione e Postman (30 min).** `schema-db.md` (V9, ER completo). Postman Chat (solo REST): crea conversazione (200; 400 se stessi; 403 non amici), lista (200 con `canSend`; 401), messaggi (200; 403 non membro), read (204; 403).

**Commit proposto:** `feat(chat): add private conversations with cursor history and stomp messaging`

### Card F5-03 · Notifiche live e candidature — stima 3,5 h

**Riferimenti:** §6.7 (candidature), §6.9 (sblocchi), §7.4, §7.6, decisione 59; riuso: `NotificaLiveEvent`, `NotificaLiveListener`.
**Sicurezza: sì (facoltativa, se resta budget)**
**File:** `notification/LiveNotification`, `NotificationType`, `LiveNotificationEvent`, `LiveNotificationListener`, `package-info`; modifiche a `FeedService` (like), `ChatService` (messaggio); `collab/CollabService.apply`, `dto/ApplyRequest`, `ApplicationResponse`; test `LiveNotificationIntegrationTest`, `CollabApplicationIntegrationTest`; `tools/stomp-test/index.html` (facoltativo); Postman Collab.

- [ ] **1. Pattern delle notifiche (40 min).** Record ed evento come in tabella; listener `AFTER_COMMIT` → `convertAndSendToUser(recipientId, "/queue/notifications", notification)`. Pubblicazione da like (solo inserimento effettivo, autore ≠ chi mette like) e da messaggio (`NEW_MESSAGE` al destinatario, `preview` 100 caratteri).
- [ ] **2. Candidature (55 min).** `POST /api/collab-posts/{id}/applications {message}` come §6.7: controlli, limite `COLLAB_APPLICATIONS`, conversazione con `findOrCreateConversation` (senza amicizia), `unlock(COLLAB_POST, postId)`, messaggio `Candidatura per «<titolo>»:\n<message>` con `appendMessage`, `ChatMessageEvent` + notifica `COLLAB_APPLICATION` (non anche `NEW_MESSAGE`). Codici `COLLAB_CLOSED`, `CANNOT_APPLY_OWN_POST`.
- [ ] **3. Test (65 min).** Like → l'autore connesso riceve `NEW_LIKE`; like proprio → niente; secondo like (idempotente) → niente; messaggio → `NEW_MESSAGE` al solo destinatario; candidatura → messaggio ad entrambi e `COLLAB_APPLICATION` all'autore; annuncio chiuso → 409; proprio annuncio → 400; **sblocco**: candidato non amico → dopo la candidatura candidato e autore si scrivono via STOMP; annuncio chiuso (o cancellato) dopo la candidatura → `CHAT_LOCKED`; seconda candidatura allo stesso annuncio → una sola riga in `chat_unlocks`; **rollback**: un'eccezione forzata dopo la pubblicazione dell'evento (bean di test) → nessuna notifica ricevuta entro 2 s.
- [ ] **4. Pagina STOMP facoltativa e Postman (40 min).** `tools/stomp-test/index.html` con `@stomp/stompjs` da CDN: campo token, connect, subscribe alle tre code, invio messaggio (non fa parte della build). Postman Collab: candidatura (201; 409 annuncio chiuso).

**Commit proposto:** `feat(notifications): add live notifications and collab applications`

### Card F5-04 · Contatto degli eventi — stima 1,5 h

**Riferimenti:** §6.6 (contatto), §6.9, §8.8, decisione 59. Taglio n. 4 se in ritardo (prima della bacheca collab).
**Sicurezza: sì**
**File:** `event/OfficialConcertService`, `IndieEventService`, `OfficialConcertController`, `IndieEventController`, `dto/ContactRequest`, `ContactResponse`; `common/ErrorCode` (`EVENT_CLOSED`, `CANNOT_CONTACT_OWN_EVENT`), `RateLimit`; `application.yml` (`EVENT_CONTACTS`); test `EventContactIntegrationTest`; Postman Events.

- [ ] **1. Endpoint (40 min).** `POST /api/official-concerts/{id}/contact` e `POST /api/indie-events/{id}/contact` (`{message}` 1–2000) con i controlli di §6.6 (404 → 409 `EVENT_CLOSED` → 400 `CANNOT_CONTACT_OWN_EVENT` → limite `EVENT_CONTACTS`); nella stessa transazione `findOrCreateConversation`, `unlock(OFFICIAL_CONCERT | INDIE_EVENT, id)`, `appendMessage` con `Contatto per «<titolo>»:\n<message>`; `ChatMessageEvent` e, se le notifiche live esistono, `NEW_MESSAGE` all'organizzatore. Risposta 201 `{conversationId, messageId}`.
- [ ] **2. Test (35 min).** Non amico contatta un concerto futuro → 201 e i due si scrivono via STOMP; `advance` oltre `event_date` → `CHAT_LOCKED`; evento già iniziato → 409; proprio evento → 400; indie in bozza o evento nascosto → 404; 11° contatto in 24 h → 429; contatto ripetuto → stessa conversazione e un solo sblocco.
- [ ] **3. Postman e chiusura (15 min).** Events: contatto concerto (201; 400 proprio evento), contatto indie (201; 404 bozza altrui).

**Criterio:** fase F5 chiusa; promemoria merge e controlli Render (WebSocket verificato con la pagina di prova).
**Commit proposto:** `feat(events): add organizer contact that unlocks the chat until the event starts`

---

# F6 — Hardening e rilascio (19 ottobre)

### Card F6-01 · Hardening e test — stima 4,5 h

**Riferimenti:** §8, §11.
- [ ] **1. Revisione di sicurezza del codice (60 min).** Elenco pubblico di `SecurityConfig` contro §6.3; ricerca di log con dati sensibili (`grep` su `log.` vicino a password/token/codice); query native solo con parametri; `@Valid` su tutti i body; header di risposta di sicurezza predefiniti di Spring attivi. Correzioni puntuali.
- [ ] **2. Copertura dei casi di §11.2 (60 min).** Tabella §11.2 riga per riga: test mancanti aggiunti.
- [ ] **3. Prove di mutazione e collection Postman (90 min, tagliabile).** Mutazioni a campione sui controlli di accesso di ogni card (ruoli, proprietà, 404 sui contenuti nascosti, sospensione): si rompe il codice di produzione, si ricompila, si rilanciano i test e si ripristina con `cmp`; un controllo che nessun test fa fallire riceve il test mancante. Poi la collection Postman eseguita per intero, in ordine, su istanza reale (environment `local` e `render`), con le correzioni agli script e alle richieste che non passano. Se il 19 sfora si riduce ai soli controlli di accesso.
- [ ] **4. Build completa e pulizia (60 min).** `./mvnw -q verify` verde; avvio in dev e prod locale; nessun warning di configurazione; `decisioni.md` aggiornato con le eventuali scelte di hardening.

**Commit proposto:** `chore(security): harden configuration and complete test coverage`

### Card F6-02 · Swagger e report di sicurezza — stima 3 h

**Riferimenti:** D5, §13; taglio n. 2 (Swagger) e n. 1 (solo statica) se in ritardo.
- [ ] **1. springdoc (45 min).** Verificare la versione compatibile con Boot 4.1.1 (3.x); dipendenza, `OpenApiConfig` (schema Bearer), percorsi pubblici `/v3/api-docs/**` e `/swagger-ui/**` aggiunti all'elenco. Test: `GET /v3/api-docs` → 200. Voce in `decisioni.md` sulla versione scelta.
- [ ] **2. Analisi statica (60 min).** SQL injection, XSS, CSRF, brute force, furto e riuso del refresh token, escalation di ruolo: per ognuno, cosa è stato verificato nel codice e con quali test.
- [ ] **3. Verifica dinamica (60 min).** Su istanza in esecuzione (locale o Render): Strix se disponibile, altrimenti prove manuali con Postman/curl (payload SQLi e XSS, refresh senza header, riuso del cookie, escalation tramite self-service e `/api/superadmin/**`). `docs/report-sicurezza.md` breve: aree, verifiche, risultati reali, correzioni, criticità aperte; dichiarare ciò che non è stato eseguito.

**Commit proposto:** `docs(security): add openapi documentation and security report`

### Card F6-03 · Fallback SPA e deploy finale — stima 2,5 h

**Riferimenti:** D1, §6.3, §12.5–12.7.
**File:** `web/SpaResourceConfig`; `SecurityConfig`; test `SpaFallbackTest` (con `src/test/resources/static/index.html` e `assets/app.js` di prova); README.
- [ ] **1. Fallback SPA (60 min).** Resource handler `/**` su `classpath:/static/` con `PathResourceResolver` che restituisce `index.html` per percorsi senza estensione fuori da `api/` e `ws`; `Cache-Control` §12.5; regola `GET` statici in `SecurityConfig` con un `RequestMatcher` che esclude `/api/**` e `/ws/**`. Test: `/eventi/123` → `index.html`; `/assets/app.js` → file; `/api/inesistente` → 404 JSON; `POST /qualcosa` → 401.
- [ ] **2. Deploy finale e verifica (45 min).** Promemoria merge `develop → main`; su Render: log, health, Postman `render` completo; in un browser sulla stessa origine (console o pagina di prova) login → cookie salvato, refresh → 200; WebSocket con la pagina STOMP.
- [ ] **3. Demo e README (45 min).** Preparazione dei tre account (SUPERADMIN da variabili, due utenti registrati con il flusso normale e resi amici con richiesta e accettazione, decisione 59); checklist della demo (§14) nel README; README finale (avvio, variabili, Postman, link, spin-down).

**Criterio:** fase F6 chiusa, deploy finale verificato.
**Commit proposto:** `feat(web): add spa fallback and finalize release`

---

# F7 — Valutazione, rinforzo e integrazioni (dopo F6-03)

Fase facoltativa: parte solo se dopo F6-03 resta tempo (il frontend ha la precedenza dal 19 ottobre, dopo F7-04, consegna
il 25). F7-01 è solo analisi e documento, senza modifiche al codice; se manca tempo si salta (decisione 71). Lo studente
ha scelto di realizzare tutte le proposte ammesse in F7-02 (decisione 75). Dopo l'analisi di sicurezza del 18 ottobre ha
aggiunto F7-03, con le correzioni scelte fra quelle proposte (decisione 76). Durante la pianificazione del frontend ha
aggiunto F7-04, gli elenchi dei contenuti dell'utente (decisione 77), da chiudere prima di FE-01.

### Card F7-01 · Valutazione dell'ottimizzazione del backend — stima 2 h

**Riferimenti:** decisione 71; `CLAUDE.md` (niente refactor fuori dalla fase).
**Sicurezza: no**
**File:** `docs/ottimizzazione.md` (nuovo); nessun file di codice.

Criteri per ammettere una proposta (devono valere tutti e tre): non cambia il comportamento osservabile (stessi
codici d'errore, stesso ordine dei controlli); è coperta da test già esistenti; ha un beneficio concreto (meno
duplicazione, meno complessità, o un punto lento misurato). Restano fuori il codice solido anche se più
pesante, in particolare concorrenza e sicurezza (refresh token, like concorrenti, ordine dei controlli STOMP) e la
logica documentata nelle decisioni.

- [ ] **1. Brainstorming e misure (60 min).** Sessione con superpowers e Opus 5.5 su duplicazioni, classi con più
  responsabilità e dipendenze inutili; per le prestazioni solo punti misurati (query senza indice, N+1, paginazione).
- [ ] **2. Documento di proposte (45 min).** `docs/ottimizzazione.md`: per ogni proposta file coinvolti, beneficio,
  rischio, test che la coprono ed effort; elenco a parte di ciò che si è deciso di non toccare e perché.
- [ ] **3. Decisione (15 min).** Lo studente sceglie se fare F7, in che forma (anche in parte) e quando; se sì nascono le
  card F7-02 e seguenti, altrimenti la scelta si registra in `decisioni.md`.

**Criterio:** documento di proposte consegnato, `git status` con soli file di documentazione, decisione dello
studente registrata.
**Commit proposto:** `docs(optimization): add backend optimization proposals`

### Card F7-02 · Realizzazione delle proposte di ottimizzazione — stima 2,5 h

**Riferimenti:** decisione 75; `docs/ottimizzazione.md` (proposte O1–O5); decisioni 26, 32, 57, 66 e 69.
**Sicurezza: no**
**File:** `chat/ChatMessageRepository`; `geo/NearbyRow` (nuovo) e i repository di concerti, indie event e feed;
`user/User`, `admin/AdminUserService`, `auth/SuperadminBootstrap`; `geo/Haversine` (spostata nei test),
`geo/package-info`; `chat/ChatService`, `collab/CollabService`, `event/EventContactService`; `docs/ottimizzazione.md`,
`docs/decisioni.md` (66 e 69), questo piano.

Refactor senza cambi di comportamento: nessun test nuovo o modificato. Prima di ogni proposta si eseguono i test
indicati nel documento, poi di nuovo dopo la modifica. Un test che fallisce indica un cambiamento di comportamento: la
proposta si ritira, il test non si adatta. Il comportamento si confronta anche da fuori, con la collection Postman
eseguita in locale prima e dopo (decisione 75).

- [ ] **1. Postman prima (10 min).** Collection completa in locale con lo script a segmenti, sul codice non ancora
  modificato; esiti salvati come riferimento fuori dal repository.
- [ ] **2. O1, ultimo messaggio con `LATERAL` (25 min).** `findLastOfEach` con la query del documento. Test:
  `ChatRestIntegrationTest`. Prova di copertura: la query rotta apposta (primo messaggio invece dell'ultimo) deve far
  fallire test con nome; poi ripristino, confermato con `cmp`.
- [ ] **3. O2, ricerca nelle vicinanze (30 min).** Un solo `geo.NearbyRow` e una sola costante della formula con un
  alias neutro, usata dalle tre query (deve restare una costante: il testo di una `@Query` è noto alla compilazione).
  Test: `NearbySqlTest`, `IndieEventIntegrationTest`, `FeedIntegrationTest`.
- [ ] **4. O4, `User.clearSuspension()` (10 min).** Usato dalla riattivazione manuale e da `SuperadminBootstrap.promote`.
  Test: `SuspensionIntegrationTest`, `SuperadminBootstrapTest`.
- [ ] **5. O5, `Haversine` nei test (10 min).** Spostamento nello stesso package di `src/test`, riga di
  `package-info.java`, struttura dei file di questo piano. Test: `HaversineTest`, `NearbySqlTest`, `FeedIntegrationTest`.
- [ ] **6. O3, parte finale comune di candidatura e contatto (40 min, primo taglio).** Metodo di `ChatService` per
  conversazione, sblocco, messaggio e `ChatMessageEvent`; controlli, limite e notifica restano nei chiamanti. Aggiorna
  decisioni 66 e 69 e la riga di `ChatService` nelle "Interfacce condivise". Test: `CollabApplicationIntegrationTest`,
  `EventContactIntegrationTest`. Prova di copertura: il nuovo metodo senza `ChatMessageEvent` deve far fallire test con
  nome; poi ripristino, confermato con `cmp`.
- [ ] **7. Postman dopo e confronto (10 min).** Stessa collection sul codice ottimizzato: stessi esiti di tutte le
  richieste del passo 1.

**Criterio:** `./mvnw -q verify` verde con lo stesso numero di test; Postman con gli stessi esiti prima e dopo; prove di
copertura su O1 e O3 intercettate da test con nome; `docs/ottimizzazione.md` indica le proposte realizzate (ed
eventualmente quelle ritirate).
**Commit proposto:** `refactor(backend): realizza le proposte di ottimizzazione O1-O5`

### Card F7-03 · Rinforzo di sicurezza: login, sessioni, geocodifica e body — stima 4 h

**Riferimenti:** decisione 76 (analisi di sicurezza del 18 ottobre, voci S1, S2, S3, S5); decisioni 4, 39, 48, 55 e
68; §4.7, §4.8, §4.10, §4.11, §8.6, §8.8, §10.1; `docs/report-sicurezza.md`.
**Sicurezza: sì**
**File:** `common/RateLimit`, `RateLimitService`; `auth/AuthService`, `RefreshTokenService`, `RefreshTokenRepository`;
`geo/NominatimGeocodingService`; `event/OfficialConcertService`, `IndieEventService`; `config/JsonLimitsConfig`
(nuova, customizer del `JsonMapper`); `application.yml` (`app.rate-limits.events-created`, `app.geocoding.max-wait`); test
`RateLimitServiceTest`, `AuthServiceTest`, `LoginRefreshLogoutIntegrationTest`, `SessionRevocationRaceTest` (nuovo),
`NominatimGeocodingServiceTest`, `OfficialConcertIntegrationTest`, `IndieEventIntegrationTest`, `ApplicationConfigTest`,
test del tetto del body (nuovo, in `config`); `docs/decisioni.md` (76), `docs/progettazione.md`,
`docs/report-sicurezza.md`. Nessuna migrazione, nessun endpoint nuovo: Postman resta invariata.

Ogni correzione nasce da un test che fallisce sul codice attuale (TDD). Nessun cambiamento per richieste in sequenza:
i test esistenti restano verdi; cambiano solo le verifiche dei mock di `AuthServiceTest` sulle chiamate al limite e il
costruttore di prova di `NominatimGeocodingService` (nuovo parametro dell'attesa massima). Ordine: S2, S1, S3, S5;
tagli se il tempo stringe: prima il sotto-task 4, poi il limite delle creazioni del sotto-task 3.

- [ ] **1. Login, tentativo prenotato in modo atomico (35 min, S2).** `RateLimitService.release` toglie l'ultimo evento
  di una chiave (dentro `compute`). `AuthService.login` usa `consume` al posto di `check` + `record`: il tentativo si
  prenota prima di BCrypt; login riuscito → `reset` come oggi; password giusta con email non verificata o account
  sospeso → `release`, perché questi casi non contano come fallimenti (decisione 48). Test: `release` in
  `RateLimitServiceTest`; in `LoginRefreshLogoutIntegrationTest` 20 login errati in parallelo con la stessa email →
  esattamente 10 risposte 401 e 10 risposte 429. Prova di mutazione: con `check` + `record` il test parallelo fallisce,
  poi ripristino. Documentazione: §4.7 (passo 1) e §8.8.
- [ ] **2. Reset e sessioni serializzati sulla riga dell'utente (90 min, S1).** Ordine dei lock sempre utente → token,
  come reset e sospensione, così non nascono deadlock. `rotate`: legge il token per hash senza lock per sapere l'utente,
  blocca la riga dell'utente (`findWithLockById`), poi il token con il lock di oggi; il resto dei passi resta uguale.
  `login`: BCrypt fuori dal lock; prima di creare il refresh token blocca la riga dell'utente e controlla che l'hash
  della password sia ancora quello confrontato, altrimenti 401 `INVALID_CREDENTIALS`. Test deterministici in
  `SessionRevocationRaceTest`: un refresh (e, in un secondo test, un login) fermato con un latch prima del commit, un
  reset in parallelo; alla fine il refresh token nuovo deve risultare revocato. Restano verdi i test di concorrenza di
  `RefreshTokenServiceTest` (409 sui refresh simultanei). Prova di mutazione: senza il lock sull'utente i due test
  falliscono, poi ripristino. Documentazione: §4.8 (concorrenza), §4.10 e §4.11.
- [ ] **3. Geocodifica: attesa massima e limite delle creazioni (50 min, S3).** `NominatimGeocodingService` usa
  `tryLock` con `app.geocoding.max-wait` (10 s): oltre, 502 `GEOCODING_UNAVAILABLE` senza chiamare Nominatim (decisione
  55). Nuovo `RateLimit.EVENTS_CREATED` (`app.rate-limits.events-created`, 20 in 24 ore per utente), unico per concerti
  e indie event, consumato prima della geocodifica in `OfficialConcertService.create` e `IndieEventService.create`.
  Test: con il lock occupato da un altro thread la chiamata fallisce entro l'attesa e Nominatim non riceve richieste;
  la 21ª creazione dello stesso utente (concerti e indie event insieme) → 429 `TOO_MANY_REQUESTS`;
  `ApplicationConfigTest` con le due chiavi nuove. Se un test esistente crea più di 20 eventi con lo stesso utente, ci si
  ferma e si avvisa. Documentazione: §8.8 (tabella) e §10.1.
- [ ] **4. Tetto del body JSON (30 min, S5, primo taglio).** Customizer del `JsonMapper` con
  `StreamReadConstraints.maxDocumentLength` a 256 KB: oltre il tetto Jackson interrompe la lettura e la risposta è il 400
  `VALIDATION_ERROR` già esistente ("Corpo della richiesta non leggibile"). Test: un body di poco oltre 256 KB a
  `POST /api/auth/login` → 400; un body legittimo grande (descrizione collab di 5000 caratteri multibyte) → accettato.
  Va verificato che il customizer valga anche per il convertitore di Spring MVC. Documentazione: §8.6 e la riga di
  `config/` nella struttura dei file di questo piano (classe `JsonLimitsConfig`).
- [ ] **5. Report, decisione e verifica finale (30 min).** `docs/report-sicurezza.md`: sezione con le quattro correzioni
  e i test che le coprono, criticità aperte aggiornate; decisione 76 completata con l'esito; `./mvnw -q verify`;
  collection Postman in locale con lo script a segmenti, stessi esiti di F7-02.

**Criterio:** `./mvnw -q verify` verde; prove di mutazione di S1 e S2 intercettate da test con nome; Postman con gli
stessi esiti di F7-02; report e decisione 76 aggiornati.
**Commit proposto:** `fix(security): chiude le gare su login e sessioni e limita geocodifica e body JSON`

### Card F7-04 · Elenchi dei contenuti dell'utente — stima 3 h

**Riferimenti:** decisione 77, decisione 57 (`indie-events/mine`, modello da seguire); §6.6–6.8, §8.4.
**Sicurezza: sì**
**File:** `event/OfficialConcertController`, `OfficialConcertService`, `OfficialConcertRepository`;
`collab/CollabController`, `CollabService`, `CollabPostRepository`; `feed/FeedController`, `FeedService`,
`FeedPostRepository`; `config/SecurityConfig`; test `OfficialConcertIntegrationTest`, `CollabIntegrationTest`,
`FeedIntegrationTest`; Postman Events, Collab, Feed; `docs/progettazione.md`, `docs/decisioni.md` (77), questo piano.

Regole comuni (decisione 77): autenticato senza ruolo richiesto; contenuti del chiamante non nascosti (né dal
proprietario né da un admin), con passati e chiusi compresi; ordine `created_at desc, id desc`; `PageParams`; stessi DTO
di risposta degli endpoint esistenti, autore già caricato nella query. In `SecurityConfig` ogni `/mine` precede `/{id}`,
che altrimenti lo renderebbe pubblico.

- [x] **1. Concerti (50 min).** `GET /api/official-concerts/mine`. Test: solo i concerti del chiamante; passati compresi
  (`advance` oltre `event_date`); nascosti dal proprietario e da un admin esclusi; 401 senza token; `size=1000` → 400
  `VALIDATION_ERROR`; ordine dal più recente.
- [x] **2. Annunci collab (40 min).** `GET /api/collab-posts/mine`. Test: chiusi compresi, nascosti esclusi, solo i
  propri, 401 senza token.
- [x] **3. Post del feed (45 min).** `GET /api/feed-posts/mine`, `likedByMe` calcolato per il chiamante, `distanceKm`
  nullo. Test: solo i propri, nascosti esclusi, `likedByMe` vero dopo un like, 401 senza token.
- [x] **4. Documentazione, Postman e chiusura (45 min).** Righe nelle tabelle di §6.6, §6.7 e §6.8; decisione 77
  completata con l'esito; questo piano. Postman: per ognuno 200 e 401. `./mvnw -q verify`; collection in locale con lo
  script a segmenti.

**Criterio:** `./mvnw -q verify` verde; Postman con i tre elenchi; fase F7 chiusa: promemoria merge `develop → main` e
controlli su Render (log, `/api/health`, i tre `/mine` con l'environment `render`).
**Commit proposto:** `feat(content): aggiunge gli elenchi dei contenuti dell'utente`

---

# Card FE (lista "FE in attesa")

Piano dettagliato in `docs/superpowers/plans/2026-10-18-resonance-frontend.md` (fasi A–D, card FE-01–FE-12 con FE-09
divisa in FE-09a e FE-09b, calendario dal 19 al 24 ottobre, tagli e rischi); scelte del piano nelle decisioni 78 e 79.
