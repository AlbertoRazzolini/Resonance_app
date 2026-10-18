# Report di sicurezza (F6-02)

Analisi statica del codice e verifica dinamica su un'istanza locale. Il report riporta solo ciò che è stato
eseguito; ciò che non è stato fatto è nella sezione "Non eseguito".

## Come è stata fatta la verifica

- **Statica:** lettura di `SecurityConfig`, `JwtFilter`, `AuthController`, `RefreshTokenService`,
  `RefreshCookieFactory`, `PlatformLevelPolicy`, dei controller di ruoli e amministrazione, di tutte le query
  `@Query` e dei DTO, più una ricerca con `grep` di log, `@RequestBody` senza `@Valid`, query costruite con
  concatenazione e HTML non escapato.
- **Dinamica:** applicazione avviata in locale con il profilo `dev` su un database vuoto creato apposta, 46 prove
  con `curl`/script Python contro porta 8089 (due utenti normali, il SUPERADMIN del bootstrap). Database e istanza
  eliminati a fine prova. Gli script non sono versionati.
- Strix non è disponibile in questo ambiente, quindi la verifica dinamica è manuale.

## Esiti per area

### SQL injection

- **Codice:** nessuna query costruita con input. Le `@Query` native usano solo parametri con nome (`:now`, `:minLat`,
  `:pattern`...). L'unica concatenazione (`"select count(*) from (" + CANDIDATES + ")"`) unisce due costanti
  del repository, non input. `JdbcTemplate` compare solo in `HealthController` con `SELECT 1`. Nessun `EntityManager`
  né query dinamiche. La ricerca con `LIKE` passa da `LikePattern.escape`, quindi `%`, `_` e `\` sono letterali.
- **Test automatici:** `LikePatternTest`, `NearbySqlTest` (parametri fuori range e non numerici → 400),
  `LoginRefreshLogoutIntegrationTest` (`login_withInvalidBody_returns400`).
- **Dinamica:** email `' OR '1'='1' --` nel login → 400; password `' OR '1'='1` → 401; ricerca utenti con
  `' OR '1'='1`, `1; DROP TABLE users;--` e `%27 OR 1=1--` → 200 con 0 risultati; id utente
  `1' OR '1'='1` → 400; `lat` e `page` con payload SQL → 400; ricerca `%%`, `__` e `a%` → 0 risultati (jolly
  letterali) mentre `Al` trova "Alice"; dopo tutte le prove il database risponde e le tabelle esistono.
- **Esito:** nessuna vulnerabilità trovata.

### XSS

- **Codice:** il backend non produce HTML, tranne le email, dove i template Thymeleaf usano `th:text` (escape) e mai
  `th:utext`. Il testo libero è salvato com'è e restituito come JSON; la sanificazione in visualizzazione spetta al
  frontend (progettazione, sezione 8.6). Gli URL immagine passano da `@HttpUrl`, che accetta solo `http` e `https`.
  Header `X-Content-Type-Options: nosniff` su ogni risposta.
- **Test automatici:** `HttpUrlValidatorTest` (`javascript:` e altri schemi rifiutati), `FeedIntegrationTest`,
  `SecurityHeadersIntegrationTest`.
- **Dinamica:** un post con `<script>` e `<img onerror>` viene salvato così com'è e restituito con
  `Content-Type: application/json` e `nosniff`; `imageUrl` con `javascript:` e con `data:text/html` → 400; una query
  con `<script>` su un percorso inesistente non viene riflessa nella risposta; `displayName` con HTML accettato come testo.
- **Esito:** nessuna vulnerabilità lato backend. **Il rischio resta sul frontend:** deve mostrare i testi con escape
  o DOMPurify, mai con `innerHTML` (promemoria per il frontend, dal 20 ottobre).

### CSRF

- **Codice:** il CSRF di Spring è disattivato perché le API usano l'header `Authorization`, che il browser non invia
  da solo. Refresh e logout, basati su cookie, hanno quattro difese (sezione 8.5): cookie `SameSite=Lax`, header
  `X-Requested-With` obbligatorio, CORS senza origini esterne in produzione, controllo dell'`Origin`.
- **Test automatici:** `refresh_withoutCsrfHeader_returns403`, `refresh_withForeignOrigin_returns403`,
  `refresh_withOriginSpoofingTheServiceHostAsPrefix_returns403`, `logout_withoutCsrfHeader_returns403AndKeepsTheToken`,
  `logout_withForeignOrigin_returns403AndKeepsTheToken`, `CorsProdIntegrationTest`, `RefreshCookieFactoryTest`.
- **Dinamica:** refresh con cookie valido ma senza header → 403 `CSRF_HEADER_MISSING`; refresh con header e `Origin`
  estraneo → 403; logout con `Origin` estraneo → 403; preflight CORS da origine estranea → 403 senza
  `Access-Control-Allow-Origin`; il cookie ha `HttpOnly`, `SameSite=Lax` e `Path=/api/auth/refresh`.
- **Esito:** nessuna vulnerabilità trovata. Il flag `Secure` è disattivato in `dev` (HTTP) e attivo in `prod`: in
  questa prova non è verificabile, è coperto da `RefreshCookieFactoryTest`.

### Brute force

- **Codice:** `RateLimitService` (in memoria, finestra scorrevole) limita i login falliti a 10 ogni 15 minuti per email;
  una risposta identica per email inesistente e password errata evita l'enumerazione, e per un'email sconosciuta
  si confronta comunque un hash BCrypt fittizio dello stesso costo, così anche il tempo è lo stesso (decisione 48);
  al login una password con più di 72 byte è trattata come errata senza chiamare BCrypt, mentre registrazione e
  reset la respingono con `@PasswordMax72Bytes`.
- **Test automatici:** `login_afterTenFailures_returns429EvenWithTheCorrectPassword`,
  `login_succeeding_resetsTheFailureCounter`, `login_withUnknownEmail_returnsTheSameResponseAsWrongPassword`,
  `RateLimitServiceTest`.
- **Dinamica:** 10 login falliti → 401, l'11° → 429 `TOO_MANY_REQUESTS`, e anche con la password giusta il login è
  rifiutato (429); email inesistente e password errata danno lo stesso codice, stato e messaggio.
- **Dinamica, tempi del login (17 ottobre):** istanza locale `dev`, account di prova verificato e poi cancellato,
  limite dei fallimenti alzato solo per la prova; 20 giri di riscaldamento scartati e 50 misure per caso, con i
  casi alternati a ogni giro. Mediane: password errata su account esistente 52,1 ms, email inesistente 51,9 ms
  (distribuzioni sovrapposte: dal tempo non si capisce se l'email esiste); login riuscito 55,8 ms (il di più è il
  salvataggio del refresh token e richiede la password giusta); password di 80 byte circa 3 ms sia con email
  esistente sia inesistente. I valori assoluti non sono quelli di produzione (`spring-boot:run` riduce
  l'ottimizzazione della JVM), ma il confronto fra i casi è valido.
- **Esito:** funziona come progettato. Limiti noti: il contatore si azzera al riavvio e vale per una sola istanza;
  chi invia 10 login falliti con l'email altrui la blocca per 15 minuti (accettato, decisione 48); la risposta 429
  non ha l'header `Retry-After`.

### Furto e riuso del refresh token

- **Codice:** 32 byte casuali, nel database solo l'hash SHA-256; rotazione a ogni refresh con il vecchio token revocato
  e collegato al nuovo; un token revocato presentato dopo la tolleranza di 10 secondi revoca tutti i token
  dell'utente; sospensione, reset password e logout revocano; cookie `HttpOnly` limitato al percorso del refresh.
- **Test automatici:** `RefreshTokenServiceTest` (hash salvato, rotazione, tolleranza, riuso a 10,5 e 11 secondi, due
  richieste davvero concorrenti), `refresh_reusingARotatedCookieAfterTenSeconds_revokesEverythingAndReturns401`,
  `refresh_afterLogout_returns401ReusedAndRevokesAllTheUsersTokens`, `refresh_whenTheUserGotSuspended_...`.
- **Dinamica:** refresh → cookie nuovo diverso; stesso cookie riusato subito → 409 `REFRESH_CONFLICT` senza
  revoche; stesso cookie riusato dopo 11 secondi → 401 `REFRESH_TOKEN_REUSED`, e subito dopo anche il cookie legittimo più
  recente è rifiutato (revoca totale); cookie inventato → 401 `REFRESH_TOKEN_INVALID`; dopo il logout il cookie
  non funziona più.
- **Esito:** nessuna vulnerabilità trovata. Rischio residuo accettato (decisione 4): un access token copiato resta
  valido fino a 15 minuti anche dopo il logout.

### Escalation di ruolo

- **Codice:** `/api/admin/**` richiede `ADMIN`, `/api/superadmin/**` richiede `SUPERADMIN`, la creazione di concerti
  `HOST`, quella di eventi indie e annunci `MUSICIAN` (sezione 8.3); il resto è `authenticated()`. Il self-service
  assegna solo `MUSICIAN` e `HOST` con endpoint separati e senza leggere un ruolo dal corpo. La regola dei livelli
  (`PlatformLevelPolicy`) impedisce di agire su sé stessi o su pari e superiori. Il filtro JWT rilegge ruoli e stato
  dal database a ogni richiesta, quindi una revoca vale subito.
- **Test automatici:** `AccessMatrixIntegrationTest` (ogni endpoint mappato è pubblico solo se elencato), `AdminRoleIntegrationTest`
  (`appoint_oneself_returns403`, `appoint_onAnotherSuperadmin_returns403`, `superadminArea_asAdmin_returns403`,
  `superadminArea_asFan_returns403_andWithoutToken_returns401`), `RoleActivationIntegrationTest`
  (`activateRole_doesNotTouchPlatformRoles`, `musician_doesNotBecomeHost`), `PlatformLevelPolicyTest`, `JwtFilterIntegrationTest`.
- **Dinamica:** utente semplice su `/api/admin/**` → 403, anonimo → 401; auto-nomina su `/api/superadmin/**` → 403;
  creare concerto senza `HOST` e evento indie senza `MUSICIAN` → 403; `POST /me/roles/musician` con corpo
  `{"roles":["SUPERADMIN"],"role":"ADMIN"}` → 200 e ruoli `FAN, MUSICIAN`; `PATCH /me` con il campo `roles` e
  registrazione con il campo `roles` → il campo è ignorato; JWT firmato con un altro segreto, JWT con `alg=none` e JWT
  con payload alterato (ruoli SUPERADMIN) e firma originale → tutti 401; JWT valido senza ruolo `ADMIN` → 403.
- **Esito:** nessuna escalation riuscita.

## Altre verifiche

- **Header di sicurezza:** presenti `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Cache-Control` senza cache,
  `Referrer-Policy: no-referrer` e `Permissions-Policy`.
- **Log:** nessun segreto nel log dell'istanza (cercati password usate, segreto JWT, token `eyJ...` e `refresh_token=`: 0
  occorrenze). In `dev` `LogEmailService` scrive il codice di verifica, voluto e disattivato con il profilo `prod`.
- **Documentazione OpenAPI:** `GET /v3/api-docs` e la Swagger UI sono pubbliche (45 percorsi descritti), un `POST` su quei
  percorsi resta 401.

## Correzioni

Nessuna correzione era stata necessaria in F6-02. Un'analisi successiva (18 ottobre, decisione 76) ha trovato quattro
punti, corretti in F7-03 ciascuno con un test scritto prima del codice, che falliva sul codice precedente:

- **S2, limite dei login aggirabile con richieste parallele:** `check` prima e `record` dopo lasciavano passare tutte le
  richieste simultanee (con i 200 thread di Tomcat circa 200 password provate per finestra invece di 10). Ora il
  tentativo si prenota con `consume` prima di BCrypt; un login riuscito azzera il contatore, mentre password giusta con
  email non verificata o account sospeso restituisce il tentativo (`release`). Test:
  `login_twentyParallelFailures_areExactlyTenUnauthorizedAndTenTooManyRequests`, `RateLimitServiceTest` (`release_*`),
  `login_withCorrectPasswordButUnverifiedEmail_neverCountsAsFailure`,
  `login_withCorrectPasswordWhileSuspended_neverCountsAsFailure`. Prova di mutazione (ritorno a `check` + `record`):
  intercettata da `login_twentyParallelFailures_...` e da `AuthServiceTest.login_withUnknownEmail_stillComparesTheDummyHash`.
- **S1, reset della password in parallelo con un refresh o un login:** l'`UPDATE` che revoca tutti i token non vedeva il
  token inserito da una transazione non ancora conclusa, che restava valido e si rinnovava all'infinito. Ora rotazione e
  login bloccano la riga dell'utente prima di toccare i token (ordine utente → token, come reset e sospensione); il login
  esegue BCrypt fuori dal lock e sotto il lock ricontrolla l'hash. Test: `SessionRevocationRaceTest`
  (`refresh_racingWithAPasswordReset_...`, `login_racingWithAPasswordReset_...`, con un latch che ferma la sessione prima
  del commit), `AuthServiceTest.login_whenThePasswordChangedWhileBcryptWasRunning_failsWithoutCreatingAToken`; restano
  verdi i test di concorrenza di `RefreshTokenServiceTest`. Prove di mutazione: senza il lock sull'utente in `rotate`
  fallisce `refresh_racingWithAPasswordReset_...`; senza lock e controllo dell'hash nel login falliscono
  `login_racingWithAPasswordReset_...` e il test di `AuthServiceTest`.
- **S3, geocodifica senza attesa massima e creazioni senza limite:** le creazioni in coda sul lock della geocodifica
  potevano occupare i thread di Tomcat e fermare il servizio. Ora il turno si attende al massimo 10 s
  (`app.geocoding.max-wait`), poi 502 `GEOCODING_UNAVAILABLE` senza chiamare Nominatim, e le creazioni di concerti e indie
  event sono limitate a 20 in 24 ore per utente (`EVENTS_CREATED`, consumato prima della geocodifica). Test:
  `geocode_whenTheTurnStaysBusyLongerThanTheMaxWait_throwsUnavailableWithoutCallingNominatim`,
  `create_twentyOneCreationsInADay_...` (concerti e indie event), `ApplicationConfigTest`. Prove di mutazione: attesa
  senza tetto → fallisce il test di `NominatimGeocodingServiceTest`; senza `consume` → falliscono i due test di creazione.
- **S5, body JSON senza tetto:** `JsonLimitsConfig` limita il documento a 256 KB; oltre, 400 `VALIDATION_ERROR`. Test:
  `JsonBodyLimitIntegrationTest` (poco oltre il tetto respinto, poco sotto letto, descrizione di 5000 caratteri accettata).

## Criticità aperte

- La documentazione OpenAPI è pubblica anche in produzione (decisione 72): espone la forma delle API, non dati.
- Frontend: nessuna sanificazione lato backend del testo libero (vedi XSS).
- Il limite sui login è in memoria (si azzera al riavvio) e blocca l'email, non l'indirizzo IP.
- Manca `Retry-After` sulle risposte 429 (S9).
- Raffica di richieste sugli endpoint pubblici con email sempre diverse (S7): quota di Brevo e CPU di BCrypt, senza limite
  per IP (decisione 48).
- Caratteri NUL, bidi o di controllo nei testi (S6), connessioni e SUBSCRIBE WebSocket senza limite (S8) e dettagli di
  PostgreSQL nel log di Hibernate (S10): rischi accettati nella decisione 76.
- Header `Content-Security-Policy` sugli script (S4): previsto in FE-11, da provare con il frontend compilato.

## Non eseguito

- Strix o altri scanner automatici (ZAP, Burp): non disponibili.
- Verifica dinamica su Render: è prevista in F6-03, con `https` e proxy reali (qui `Secure` e HSTS non sono
  verificabili).
- Email in produzione (Brevo) e rendering del template con HTML nel nome: verificato solo il codice (`th:text`).
- Attacchi al canale WebSocket/STOMP (token non valido al `CONNECT`, scrittura in conversazioni altrui): coperti da test di
  integrazione delle card della chat, non riprovati qui.
- Test di carico e di denial of service, dipendenze con vulnerabilità note (`mvn dependency-check`), analisi dei
  segreti nella cronologia Git.
