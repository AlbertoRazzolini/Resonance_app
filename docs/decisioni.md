# Resonance - Decisioni tecniche

Registro delle decisioni tecniche del progetto (backend e, dalla decisione 77, frontend). Ogni voce ha tre parti fisse: **Scelta**,
**Motivazione**, **Alternative scartate**. Le nuove decisioni si aggiungono nello stesso sotto-task
in cui vengono prese. Riferimento principale: `docs/progettazione.md`.

Origine delle voci: **brief** = vincolo o decisione già presa in `docs/brief.md`; **brainstorming** =
scelta dello studente durante il brainstorming (13 ottobre); **design** = scelta tecnica proposta nel
documento di design e approvata con esso (13 ottobre); **implementazione** = scelta fatta durante lo
sviluppo e approvata dallo studente in revisione.

---

## Decisione 1: un solo servizio Render per API e frontend (brainstorming, sostituisce la D1 del brief)

### Scelta

Un solo servizio web Render (Docker) con indirizzo `onrender.com`, che serve sia le API sia la build
del frontend React. Dockerfile multi-stage: stage Node che costruisce `Resonance_FE` (aggiunto
quando il frontend esiste), stage JDK che costruisce `Resonance_BE` copiando la build del frontend
fra le risorse statiche di Spring, stage JRE finale come in NoseY. Spring inoltra a `index.html` le
rotte del frontend (fallback SPA), escluse `/api/**` e `/ws/**`. Fino alla card FE-01 (18 ottobre, dopo F7-03) il servizio
contiene solo il backend. `render.yaml` con database + un solo servizio web.

### Motivazione

- Frontend e API sulla stessa origine: il cookie di refresh è di prima parte e funziona con
  `SameSite=Lax` su tutti i browser, Safari/iOS compreso.
- Nessun CORS necessario in produzione (resta configurabile per lo sviluppo locale con il proxy di
  Vite verso `localhost:8080`).
- Nessun dominio da acquistare né DNS da configurare.

### Alternative scartate

- **Due servizi Render con dominio personalizzato (`app.` e `api.`)**: era la D1 del brief; scartata
  per il costo del dominio e la configurazione DNS.
- **Due servizi su `onrender.com`**: `onrender.com` è nella Public Suffix List, quindi i due servizi
  sono siti diversi per il browser; il cookie di refresh diventa di terze parti, bloccato da
  Safari/iOS (e con `SameSite=Lax` non inviato da nessun browser).

## Decisione 2: immagini solo come URL (brief, decisione 2)

### Scelta

Nell'MVP le immagini sono solo URL (`avatar_url`, `cover_image_url`, `image_url`), validati come
`http`/`https`. Nessun upload; lo storage è rinviato a Post-V1.

### Motivazione

Nessuna integrazione con un servizio di storage da sviluppare e verificare entro la scadenza.

### Alternative scartate

- **bytea in PostgreSQL come NoseY**: tempo di integrazione non compatibile con la scadenza.
- **Cloudinary**: escluso, non va usato né proposto, nemmeno per le versioni future.

## Decisione 3: geocodifica Nominatim sincrona (brief, decisione 3)

### Scelta

L'indirizzo di un evento viene geocodificato con Nominatim (OpenStreetMap) durante la
pubblicazione, con timeout breve: indirizzo non trovato → 400 `ADDRESS_NOT_FOUND`; servizio non
disponibile → 502 `GEOCODING_UNAVAILABLE`. Al massimo una richiesta al secondo, User-Agent
identificativo.

### Motivazione

Gratuito e senza API key; l'utente scopre subito se l'indirizzo è sbagliato.

### Alternative scartate

- **Geocodifica asincrona**: stati intermedi dell'evento ("in geocodifica", "fallita") troppo
  complessi per l'MVP.

## Decisione 4: nessuna blacklist degli access token (brief, decisione 4)

### Scelta

Nessuna tabella di access token revocati. Bastano la revoca dei refresh token e la lettura di ruoli
e stato dal database a ogni richiesta REST e al CONNECT STOMP; l'access token dura 15 minuti.

### Motivazione

Sospensioni e cambi di ruolo hanno effetto alla richiesta successiva grazie alla lettura dal
database; l'unico rischio residuo (access token copiato prima del logout, valido al massimo 15
minuti) è accettabile.

### Alternative scartate

- **Tabella di blacklist come `TOKEN_JWT` di NoseY**: una lettura in più a ogni richiesta e una
  tabella da ripulire, per un beneficio marginale.

## Decisione 5: springdoc-openapi in F6 (brief, decisione 5)

### Scelta

springdoc-openapi con Swagger UI in F6, in aggiunta alla collection Postman, che resta obbligatoria.
Swagger è il taglio n. 2 in caso di ritardo.

### Motivazione

Documentazione navigabile delle API senza scriverla a mano; la collection Postman resta lo
strumento di verifica.

### Alternative scartate

- **Solo Postman**: meno comodo da consultare per chi sviluppa il frontend.

## Decisione 6: contenuti moderati con hidden_at, hidden_by e hidden_reason (brief + brainstorming)

### Scelta

Le tabelle `official_concerts`, `indie_events`, `feed_posts` e `collab_posts` hanno `hidden_at`,
`hidden_by` e `hidden_reason`. `hidden_reason` è obbligatorio quando nasconde un ADMIN, facoltativo
quando nasconde il proprietario. Tutte le query pubbliche escludono le righe nascoste; l'ADMIN può
ripristinare solo i contenuti nascosti da un admin. Nessuna cancellazione fisica.

### Motivazione

- Si sa chi ha moderato, quando e perché; il contenuto è ripristinabile.
- Lo stesso meccanismo serve la cancellazione del proprietario (decisione 23), senza tabelle in più.

### Alternative scartate

- **Soft delete generico** (`deleted` booleano): non registra chi ha moderato né il motivo.
- **Eliminazione effettiva**: non ripristinabile.

## Decisione 7: UUID per chiavi primarie ed esterne (brief)

### Scelta

Tutte le chiavi primarie e le chiavi esterne sono `uuid` PostgreSQL, generate da Hibernate con
`GenerationType.UUID` (come NoseY); le migrazioni impostano anche `DEFAULT gen_random_uuid()`.

### Motivazione

- Gli id non sono indovinabili in sequenza negli URL (`/api/users/{id}`).
- L'id è noto prima dell'inserimento e non dipende dal database.

### Alternative scartate

- **bigint autoincrementale**: id sequenziali enumerabili da chiunque.

## Decisione 8: access token Bearer e refresh token in cookie HttpOnly (brief)

### Scelta

Access token JWT di 15 minuti nel body delle risposte, conservato dal frontend solo in memoria
(Redux) e inviato come `Authorization: Bearer` (REST) e nell'header del CONNECT STOMP. Refresh token
opaco di 10 giorni solo in un cookie `HttpOnly`, `Path=/api/auth/refresh`, `SameSite=Lax`, `Secure`
in prod. Lo stesso token non viaggia mai su entrambi i canali.

### Motivazione

- L'access token in memoria non sopravvive a un furto tramite `localStorage`.
- Il refresh token in un cookie `HttpOnly` non è leggibile da JavaScript (XSS) e viaggia solo verso
  l'endpoint di refresh grazie al `Path`.

### Alternative scartate

- **Token unico Bearer di lunga durata con blacklist (modello NoseY)**: per restare autenticato il
  client deve conservare un token valido 24 ore; con il cookie `HttpOnly` la sessione persiste senza
  esporre un token di lunga durata a JavaScript.
- **Entrambi i token in cookie**: richiederebbe protezione CSRF su tutte le API.

## Decisione 9: rotazione, revoca e rilevazione del riuso dei refresh token (brief)

### Scelta

Ogni refresh ruota il token: nuovo token con 10 giorni pieni, vecchio revocato. Nel database solo
l'hash SHA-256. Revoca di tutti i token dell'utente al reset della password, alla sospensione e al
riuso di un token revocato; il logout revoca il token del dispositivo. Cookie cancellato in logout,
reset e casi di errore.

### Motivazione

- Scadenza scorrevole: chi usa l'app resta autenticato, chi non la usa per 10 giorni rifà il login.
- Il riuso di un token già ruotato è il segnale tipico di un furto.
- SHA-256 basta per un token casuale da 256 bit e permette di cercarlo per hash.

### Alternative scartate

- **Refresh token senza rotazione**: un token rubato resterebbe valido per 10 giorni.
- **Hash BCrypt**: utile solo per segreti deboli; impedirebbe la ricerca diretta per hash.

## Decisione 10: finestra di tolleranza di 10 secondi per i refresh concorrenti (brainstorming, P4)

### Scelta

Colonne `revoked_at` e `replaced_by` in `refresh_tokens`. Se viene presentato un token ruotato da
meno di 10 secondi, la risposta è 409 `REFRESH_CONFLICT`: nessun token emesso, nessuna revoca,
cookie non cancellato; il client ritenta con il cookie nuovo. Oltre i 10 secondi, o per un token
revocato da logout o reset, si revocano tutti i token. Le richieste sullo stesso token sono
serializzate con un lock di riga.

**Il confine è incluso**: la condizione è `adesso − revoked_at ≤ 10 s`, quindi a 10 secondi esatti la
risposta è ancora 409 e solo oltre (a 10,001 s) è un riuso. I test verificano 9, 9,5, 10,5 e 11 secondi
con un orologio senza frazioni di secondo; non c'è un test sul secondo esatto, perché PostgreSQL salva i
microsecondi e arrotonda: con l'`Instant.now()` di un test reale l'esito a 10 secondi esatti dipenderebbe
dall'arrotondamento e il test sarebbe instabile. Una finestra a 9 o a 11 secondi viene scoperta dai test
a 9,5 e a 10,5 secondi; scambiare "incluso" con "escluso" no, e non cambia nulla di osservabile se non
all'istante esatto del confine. Il lock di riga è coperto da un test con due richieste concorrenti vere,
ripetuto 20 volte (`RefreshTokenServiceTest`).

### Motivazione

Due schede aperte insieme fanno refresh con lo stesso cookie: con la regola rigida l'utente
verrebbe sloggato. Un attaccante che usa il token entro la finestra non ottiene comunque nulla.

### Alternative scartate

- **Regola rigida (ogni riuso revoca tutto)**: schema invariato, ma logout involontari con più schede.

## Decisione 11: logout con DELETE /api/auth/refresh (brainstorming, P3)

### Scelta

Il logout è `DELETE /api/auth/refresh` (cookie + `X-Requested-With`): revoca il refresh token del
dispositivo e cancella il cookie; sempre 204.

### Motivazione

Con `Path=/api/auth/refresh` il browser invia il cookie solo a quel percorso: un endpoint
`/api/auth/logout` non riceverebbe il cookie e non saprebbe quale token revocare.

### Alternative scartate

- **`POST /api/auth/logout` con Bearer che revoca tutti i token**: logout da tutti i dispositivi a
  ogni uscita.
- **Allargare il Path del cookie**: viola il vincolo del brief.

## Decisione 12: protezione CSRF del refresh (brief)

### Scelta

Refresh e logout richiedono l'header `X-Requested-With` e accettano l'header `Origin` solo se è
quello del servizio (o un'origine configurata in dev); il cookie è `SameSite=Lax`; in produzione
nessuna origine esterna è ammessa dal CORS.

### Motivazione

Un form di un altro sito non può aggiungere header custom; un `fetch` cross-origin con quell'header
richiede un preflight CORS, che viene negato. `HttpOnly` da solo non impedisce al browser di inviare
il cookie.

### Alternative scartate

- **Token CSRF sincronizzato di Spring Security**: stato in più da gestire per due soli endpoint.

## Decisione 13: ruoli di community additivi, gerarchia solo SUPERADMIN > ADMIN (brief)

### Scelta

FAN (automatico e non rimovibile), MUSICIAN e HOST sono indipendenti e cumulabili, senza gerarchia;
MUSICIAN e HOST si attivano in self-service. L'unica gerarchia è `SUPERADMIN > ADMIN` con
`RoleHierarchy`. ADMIN e SUPERADMIN non ereditano MUSICIAN né HOST e non sono mai assegnabili in
self-service.

### Motivazione

Un utente può essere fan, musicista e organizzatore insieme; moderare la piattaforma e pubblicare
contenuti musicali sono autorizzazioni diverse.

### Alternative scartate

- **Gerarchia unica come NoseY (SUPERADMIN → ADMIN → USER)**: non rappresenta ruoli cumulabili.

## Decisione 14: tabella user_roles con chiave composta (brief)

### Scelta

Tabella `user_roles (user_id, role, granted_at)` con PK composta `(user_id, role)` e enum PostgreSQL
`user_role`; una riga per ruolo attivo.

### Motivazione

Più ruoli per utente senza duplicati; aggiungere o togliere un ruolo è un `INSERT` o un `DELETE`.

### Alternative scartate

- **Colonna di ruolo singola in `users` (modello NoseY)**: un solo ruolo per utente.
- **Tabella `roles` separata con id**: un join in più per un insieme di valori fisso.

## Decisione 15: ruoli e stato letti dal database, non dai claim del JWT (brief)

### Scelta

Il JWT contiene solo l'id dell'utente. `JwtFilter` (a ogni richiesta REST) e
`JwtChannelInterceptor` (al CONNECT) caricano ruoli e stato dal database con una query.

### Motivazione

Promozioni, revoche e sospensioni hanno effetto immediato, senza attendere la scadenza del token e
senza revocare token.

### Alternative scartate

- **Ruoli nei claim (modello NoseY)**: i cambi di ruolo richiederebbero di revocare i token o di
  attendere la scadenza.

## Decisione 16: notifiche solo live e non persistenti nell'MVP (brief)

### Scelta

Le notifiche (nuovo like, nuovo messaggio, candidatura) partono su `/user/queue/notifications` solo
dopo il commit (`@TransactionalEventListener(AFTER_COMMIT)`) e non vengono salvate: un utente
offline non le riceve.

### Motivazione

Tempo di sviluppo ridotto; lo storico arriverà con la tabella `notifications` in Post-V1.

### Alternative scartate

- **Tabelle di notifiche per categoria come NoseY**: troppo lavoro per la scadenza.

## Decisione 17: Flyway per le migrazioni, mai ddl-auto=update (brief)

### Scelta

Schema creato e modificato solo da migrazioni Flyway versionate (`V1__...`, `V2__...`); Hibernate con
`ddl-auto: validate`. Mai modificare una migrazione già applicata. Nessuna credenziale nelle
migrazioni.

### Motivazione

Schema riproducibile e versionato insieme al codice; `validate` segnala all'avvio ogni differenza
fra entity e database.

### Alternative scartate

- **`ddl-auto=update`**: modifiche non tracciate, non reversibili e diverse fra ambienti.

## Decisione 18: official_concerts e indie_events separati (brief)

### Scelta

Due tabelle, due entity, due endpoint di pubblicazione (`hasRole("HOST")` e `hasRole("MUSICIAN")`)
e due ricerche nearby distinte.

### Motivazione

Hanno autori, permessi e campi diversi (biglietto esterno contro gratuità e bozze).

### Alternative scartate

- **Un'unica entità Evento come NoseY**: mescolerebbe permessi e campi diversi.

## Decisione 19: riuso selettivo di NoseY (brief)

### Scelta

Si portano solo le classi e i pattern concordati, tradotti in inglese e adattati; la mappa sta in
`docs/riuso-nosey.md`. Non si portano AI, amicizie, ticket, anonimizzazione, funzioni admin oltre la
moderazione minima, storage delle immagini, notifiche persistenti, `SmtpEmailService`.

### Motivazione

Il riuso fa risparmiare tempo su parti già verificate (errori, codici email, WebSocket, deploy) senza
trascinare funzionalità e naming che Resonance non ha.

### Alternative scartate

- **Copia in blocco di NoseY**: naming italiano e funzionalità fuori dall'MVP.
- **Riscrittura da zero**: incompatibile con la scadenza.

## Decisione 20: package it.epicode.resonance (brainstorming, P1)

### Scelta

Package base `it.epicode.resonance`, groupId `it.epicode`, artifactId `resonance-be`; organizzazione
per dominio con un `package-info.java` per package.

### Motivazione

Nome leggibile, senza underscore e coerente con NoseY.

### Alternative scartate

- **`com.example.resonance_be` dello scheletro Initializr**: nome segnaposto con underscore.

## Decisione 21: codici email nella tabella email_codes (brainstorming, P2)

### Scelta

Tabella `email_codes` (una riga per utente e scopo) con `purpose` enum `email_code_purpose`
(`EMAIL_VERIFICATION`, `PASSWORD_RESET`), codice di 6 cifre valido 15 minuti, 5 tentativi consumati
in modo atomico prima del confronto, 1 invio ogni 60 secondi e 5 in 24 ore, confronto a tempo
costante. Estendibile al 2FA con un nuovo valore dell'enum.

### Motivazione

`users` resta come da brief; la logica di NoseY si riusa; il 2FA di Post-V2 non richiede una tabella
nuova.

### Alternative scartate

- **Colonne aggiuntive in `users` come NoseY**: più rapido, ma mescola dati temporanei con il profilo.

## Decisione 22: colonna address negli eventi (brainstorming, P5)

### Scelta

Colonna `address` (NOT NULL) in `official_concerts` e `indie_events`: viene geocodificata e mostrata
dal frontend.

### Motivazione

`venue_name` da solo è ambiguo per la geocodifica e per chi legge.

### Alternative scartate

- **Indirizzo solo nella richiesta, non salvato**: il frontend non potrebbe mostrarlo.
- **Geocodificare `venue_name`**: risultati inaffidabili.

## Decisione 23: azioni del proprietario sui contenuti (brainstorming, P7)

### Scelta

Indie event come bozza o pubblicati, con `PATCH .../publish`; annunci collab chiudibili con
`PATCH .../close`; `DELETE` del proprietario sui quattro tipi di contenuto come soft delete con
`hidden_at`/`hidden_by` (motivo facoltativo). Nessuna modifica dei contenuti nell'MVP.

### Motivazione

Copre ciò che lo schema implica (`status`, `is_open`) e permette di ritirare un contenuto senza
perdere la traccia.

### Alternative scartate

- **Nessuna cancellazione del proprietario**: l'utente non potrebbe ritirare un post.
- **Modifica e cancellazione complete**: troppo lavoro per la scadenza.

## Decisione 24: candidatura collab come messaggio in chat (brainstorming, P6)

### Scelta

`POST /api/collab-posts/{id}/applications {message}` senza tabella nuova: il messaggio arriva
all'autore nella chat (creata se non esiste) e l'autore riceve la notifica live
`COLLAB_APPLICATION`. Può candidarsi qualunque utente autenticato tranne l'autore, solo su annunci
aperti e non nascosti.

### Motivazione

La traccia persistente è il messaggio di chat; nessuna tabella e nessuna schermata in più.

### Alternative scartate

- **Tabella `collab_applications`**: circa 3 ore di lavoro in più.
- **Solo notifica live**: con l'autore offline la candidatura andrebbe persa.

## Decisione 25: regola dei livelli di piattaforma (brainstorming, P8)

### Scelta

Livelli: SUPERADMIN 2, ADMIN 1, solo community 0. Si sospende, riattiva o modera solo chi ha un
livello inferiore e mai se stessi. Il SUPERADMIN non è sospendibile via API; il controllo
sull'ultimo SUPERADMIN resta come difesa.

### Motivazione

Regola semplice e già verificata in NoseY (decisione D16): un ADMIN non può sospendere un altro ADMIN
o il SUPERADMIN.

### Alternative scartate

- **Qualunque ADMIN agisce su chiunque tranne se stesso**: un ADMIN potrebbe sospendere gli altri admin.

## Decisione 26: sospensione con motivo, durata e riattivazione pigra (brainstorming)

### Scelta

In `users`: `suspended_at`, `suspended_by`, `suspension_reason` (obbligatorio), `suspended_until`
(facoltativo, `null` = indeterminata). L'admin indica una durata o una data di fine. Alla scadenza la
riattivazione è automatica e "pigra": login, refresh, `JwtFilter`, CONNECT e SEND STOMP trovano la
sospensione scaduta e riportano l'utente ad ACTIVE con un `UPDATE` condizionale, senza job.
Riattivazione manuale anticipata possibile. Nessuno stato `BANNED`. La sospensione revoca tutti i
refresh token e chiude le sessioni WebSocket.

### Motivazione

Nessun job da pianificare (su Render gratuito il servizio si sospende); l'effetto è immediato alla
prima richiesta dopo la scadenza.

### Alternative scartate

- **Job programmato di riattivazione**: non gira mentre il servizio è sospeso.
- **Stato `BANNED` separato**: nessuna differenza di comportamento nell'MVP.

## Decisione 27: ACCOUNT_SUSPENDED con motivo e scadenza (brainstorming)

### Scelta

Login, refresh e verifica di un utente sospeso rispondono 403 `ACCOUNT_SUSPENDED` con `details`
`{suspensionReason, suspendedUntil}`. La richiesta di riattivazione (appeal) è Post-V1.

### Motivazione

Il frontend può mostrare un messaggio chiaro con un contatto per i ricorsi.

### Alternative scartate

- **Errore generico senza dettagli**: l'utente non saprebbe perché e fino a quando.

## Decisione 28: validità del WebSocket legata all'access token (brainstorming, P9)

### Scelta

A ogni SEND STOMP si controllano la scadenza dell'access token usato al CONNECT e lo stato ACTIVE nel
database; con il token scaduto il client riceve `TOKEN_INVALID` su `/user/queue/errors` e si
riconnette con il token corrente.

### Motivazione

La durata dell'autorizzazione sul WebSocket resta limitata come quella delle API (modello NoseY).

### Alternative scartate

- **Solo controllo dello stato a ogni SEND**: una connessione potrebbe restare autorizzata
  indefinitamente.

## Decisione 29: database di test resonance_test (brainstorming, P10)

### Scelta

I test di integrazione usano il database `resonance_test` nello stesso container Docker di sviluppo
(porta 5433), creato da uno script di init, con il profilo `test`.

### Motivazione

Nessuna dipendenza aggiuntiva; stesso PostgreSQL di sviluppo e produzione (enum, `text[]`).

### Alternative scartate

- **Testcontainers**: isolato ma più lento e con una dipendenza in più.
- **H2**: non supporta gli enum PostgreSQL né `text[]`.

## Decisione 30: posizione dell'utente facoltativa e coordinate inviate dal client (brainstorming, P11)

### Scelta

`latitude`/`longitude` di `users` restano null finché l'utente non condivide la posizione; si
impostano insieme (range validati) con `PATCH /api/users/me` e si rimuovono solo con
`DELETE /api/users/me/location`. `city` è testo libero, senza geocodifica. Le coordinate dei post
del feed sono facoltative e inviate dal client. Le funzioni basate sulla distanza usano solo
`lat`/`lng` passati nella richiesta.

### Motivazione

Nominatim è previsto solo per gli eventi; la posizione del browser è più precisa di una città.

### Alternative scartate

- **Geocodificare `city` con Nominatim**: chiamate esterne in più per un dato approssimativo.

## Decisione 31: PATCH del profilo con stringa vuota per svuotare (brainstorming)

### Scelta

`PATCH /api/users/me` modifica solo i campi inviati: campo assente o `null` = invariato; stringa
vuota = svuota i campi di testo facoltativi (`bio`, `city`, `avatarUrl`); `displayName` non si può
svuotare. Lo stesso criterio vale per ogni aggiornamento parziale.

### Motivazione

Il frontend invia solo ciò che cambia; la regola è semplice e non richiede librerie per distinguere
"assente" da "null".

### Alternative scartate

- **`PUT` con sostituzione completa**: obbliga a inviare sempre tutti i campi.
- **JSON Merge Patch (`null` = svuota)**: richiede di distinguere campo assente e `null` nel
  parsing, con più codice.

## Decisione 32: ricerca per raggio con Haversine in SQL (design)

### Scelta

Le ricerche nearby usano la formula di Haversine in una query nativa, con prefiltro a bounding box
sugli indici `(latitude, longitude)`, ordinamento per distanza e paginazione. La classe `Haversine`
di NoseY è l'oracolo dei test.

### Motivazione

Paginazione e filtro per raggio nel database, senza caricare tutti gli eventi in memoria come
faceva NoseY.

### Alternative scartate

- **Filtro e ordinamento in Java (modello NoseY)**: carica tutti gli eventi a ogni ricerca.
- **PostGIS**: estensione in più da installare e gestire per un solo calcolo.

## Decisione 33: letture pubbliche e fallback SPA (design)

### Scelta

Le letture di eventi, feed, annunci collab e profili pubblici non richiedono login; tutto il resto
sì. Gli endpoint pubblici `/api/**` sono elencati uno per uno; le `GET` fuori da `/api/**` e
`/ws/**` sono pubbliche perché servono solo i file del frontend e `index.html`.

### Motivazione

Il frontend può mostrare contenuti anche prima del login; le rotte di React non sono elencabili, ma
non contengono dati.

### Alternative scartate

- **Tutto autenticato**: nessuna pagina pubblica.
- **Elenco esplicito anche per le rotte del frontend**: da aggiornare a ogni nuova pagina.

## Decisione 34: health check su /api/health (design)

### Scelta

`GET /api/health` pubblico, con una `SELECT 1` sul database; è l'`healthCheckPath` di Render. Niente
Actuator.

### Motivazione

Come NoseY (decisione D19): un endpoint semplice e pubblico, senza esporre altro.

### Alternative scartate

- **Actuator `/actuator/health`**: dipendenza e configurazione di esposizione in più.

## Decisione 35: chat avviata via REST, messaggi via STOMP (design)

### Scelta

`POST /api/chats {recipientId}` trova o crea la conversazione (coppia canonica `user_a_id <
user_b_id`, unica); i messaggi si inviano su `/app/chats/{conversationId}/send`. Il nuovo messaggio
arriva su `/user/queue/messages` a entrambi e genera `NEW_MESSAGE` su `/user/queue/notifications`
per il destinatario. Storico con paginazione a cursore. Limiti anti-spam su messaggi, nuove
conversazioni e candidature.

### Motivazione

Riusa il controller STOMP di NoseY; chiunque può scrivere a chiunque senza sistema di amicizie.

**Modificata dalla decisione 59 (16 ottobre):** avvio via REST e invio via STOMP restano; una conversazione
nuova si crea solo fra amici e ogni invio richiede l'amicizia o uno sblocco aperto.

### Alternative scartate

- **Invio del primo messaggio direttamente all'id del destinatario**: due percorsi di invio da gestire.

## Decisione 36: ciclo di sviluppo con commit manuali dello studente (brief + richiesta dello studente)

### Scelta

Una card alla volta, un commit per card; a fine card riepilogo e messaggio di commit proposto in
stile Conventional Commits; il commit lo esegue lo studente. Lavoro su `develop`; il merge
`develop → main` (deploy automatico su Render) lo esegue lo studente a fine fase. I messaggi di
commit proposti sono in italiano, con il prefisso Conventional Commits in inglese (es.
`feat(auth): aggiunge la rotazione del refresh token`), come richiesto dallo studente all'avvio di F0.
Le card passano in "Fatto" su Trello per mano dello studente, dopo il commit.

### Motivazione

Lo studente controlla e firma ogni modifica del repository; `main` resta stabile.

### Alternative scartate

- **Commit automatici a ogni sotto-task**: storia illeggibile e nessun controllo prima del commit.

## Decisione 37: nessuna operazione Git eseguita da strumenti automatici (brief)

### Scelta

Gli strumenti automatici di sviluppo non eseguono `git commit`, `git push` né altre operazioni Git
che modificano il repository o il remoto; possono solo usare comandi diagnostici. Messaggi di
commit, file versionati e descrizioni non contengono attribuzioni a strumenti automatici.

### Motivazione

Paternità del progetto chiara e nessuna modifica remota non controllata.

### Alternative scartate

- **Commit automatici**: perdita di controllo sul contenuto e sulla paternità dei commit.

## Decisione 38: documentazione aggiornata durante lo sviluppo (brief)

### Scelta

`progettazione.md`, `decisioni.md`, `schema-db.md`, README, `package-info.java`, `render.yaml` e
collection Postman si aggiornano nello stesso sotto-task che introduce la modifica; le card Trello
contengono i sotto-task documentali espliciti.

### Motivazione

La documentazione resta coerente con il codice; nessun recupero a fine progetto.

### Alternative scartate

- **Documentazione scritta alla fine**: rischio di descrivere un sistema diverso da quello reale.

## Decisione 39: nomi delle chiavi di configurazione dei limiti e della geocodifica (implementazione)

### Scelta

Il design fissa i valori e il prefisso `app.rate-limits.*` (sezione 8.8) ma non i nomi delle
sottochiavi, né quelli delle chiavi di geocodifica: i nomi sono stati scelti in fase di
implementazione (F0-01) e approvati dallo studente in revisione; le card successive li usano
**così come sono**, senza rinominarli.

- `app.rate-limits.<limite>.max` (numero intero) e `app.rate-limits.<limite>.window` (durata, es.
  `15m`, `24h`), con `<limite>` uno fra `login-failed`, `chat-messages`, `conversations-created`,
  `collab-applications`.
- `app.geocoding.url`, `app.geocoding.contact` (da `GEOCODING_CONTACT`: entra nello User-Agent
  identificativo delle richieste a Nominatim, decisione 3), `app.geocoding.connect-timeout`,
  `app.geocoding.read-timeout`.

### Motivazione

Più card leggono queste chiavi (limiti di frequenza, geocodifica degli eventi): fissarne i nomi
subito evita incoerenze fra codice, `application.yml` e documentazione. `ApplicationConfigTest`
ne verifica la risoluzione con il profilo `test`.

### Alternative scartate

- **Nomi in italiano come in NoseY (`massimo`, `finestra`)**: codice, classi, tabelle e colonne
  sono in inglese (brief, sezione 2); le chiavi di configurazione seguono la stessa convenzione.
- **Nomi decisi card per card**: rischio di nomi diversi per lo stesso concetto.

## Decisione 40: database di sviluppo esposto solo su localhost (implementazione)

### Scelta

Nel `docker-compose.yml` la porta di PostgreSQL è legata a `127.0.0.1`: `"127.0.0.1:5433:5432"`. Il
design (sezione 12.1) e il piano sono stati aggiornati di conseguenza. `docs/brief.md` non è
modificato e riporta ancora `"5433:5432"`.

### Motivazione

Il database di sviluppo ha credenziali semplici (`resonance`/`resonance`) e non deve essere
raggiungibile da altre macchine sulla rete locale. pgAdmin e IntelliJ si collegano comunque a
`localhost:5433`.

### Alternative scartate

- **`"5433:5432"` senza indirizzo** (come nel brief e nel design originale): Docker espone la porta
  su tutte le interfacce, quindi il database con credenziali semplici sarebbe raggiungibile dalla
  rete locale.

## Decisione 41: costruzione delle entità JPA (implementazione)

### Scelta

Ogni entity ha un costruttore pubblico con i campi obbligatori (NOT NULL senza default del
database) e `@NoArgsConstructor(access = AccessLevel.PROTECTED)`, che serve solo a JPA. Gli altri
campi restano con i setter. Per le entity con chiave composta il costruttore riceve i dati della
chiave. Le entity nuove nascono già così; `User`, `UserRole` e `UserRoleId` la rispettano. Ogni entity ha `@ToString`. Il campo
`id` non ha setter (`@Setter(AccessLevel.NONE)`) e i campi sensibili, come l'hash della password,
stanno fuori da JSON e da `toString` (`@JsonIgnore`, `@ToString.Exclude`). `@AllArgsConstructor` non
si usa in nessuna classe: i costruttori si scrivono a mano, assegnando i campi con `this.`.

### Motivazione

Un oggetto incompleto, per esempio un utente senza email, non si può creare: l'errore si vede alla
compilazione e non come violazione di `NOT NULL` al salvataggio. Hibernate continua a creare gli
oggetti con il costruttore vuoto, che resta protetto e quindi non usabile dal codice normale.

### Alternative scartate

- **Solo `@Getter`/`@Setter` con costruttore implicito** (modello di NoseY e prima versione del
  design, sezione 2.1): permette entity incomplete, con l'errore rinviato al database.
- **`@AllArgsConstructor`**: inutilizzabile con molti campi facoltativi e con campi valorizzati dal
  database, come `created_at`.
- **Builder**: più codice per ogni entity, per un vantaggio piccolo quando i campi obbligatori sono
  pochi.

## Decisione 42: commento del codice (implementazione)

### Scelta

Commenti in italiano. Nel codice di produzione una riga di Javadoc su ogni classe e su ogni metodo
non banale (esclusi getter, setter e costruttori ovvi), che dice cosa fa e perché; le scelte non
ovvie hanno un commento sul perché con il riferimento "progettazione, sezione N". I campi delle
entity sono commentati solo se la colonna ha una regola o un'unità. Nei test: una riga per classe che
dice cosa verifica e un commento sui casi non evidenti dal nome del test. La regola vale anche per il
codice già scritto (applicata a F0) e per ogni file che una card crea o modifica.

### Motivazione

Il progetto è un lavoro di studio da presentare e da mantenere dopo la consegna: una riga per classe e
per metodo rende il codice leggibile senza aprire il design. Il limite ai metodi non banali evita
commenti che ripetono il codice.

### Alternative scartate

- **Solo classi e scelte non ovvie** (livello che c'era prima): i metodi restano senza spiegazione.
- **Tutto, anche campi e costruttori**: più rumore e più tempo su ogni card, con la scadenza del 25
  ottobre.
- **Test commentati come il codice di produzione**: quasi ogni test avrebbe un commento, quando il
  nome descrittivo basta.

## Decisione 43: lunghezze delle colonne solo nelle migrazioni e nei DTO (implementazione)

### Scelta

Le entity non dichiarano `length` nelle `@Column`. La lunghezza delle colonne la fissano le migrazioni
Flyway (descritte in `docs/schema-db.md`) e la validazione dei DTO. Le lunghezze di `users` restano
quelle del design (sezione 3.2): non sono state ridotte.

### Motivazione

Lo schema lo decide Flyway (`ddl-auto: validate`, mai `update`): ripetere la lunghezza nell'entity è
una seconda fonte da tenere allineata. Con `validate` Hibernate non controlla la lunghezza delle
colonne: l'avvio e i test passano anche con lunghezze diverse da quelle del database.

### Alternative scartate

- **`length` ripetuta in ogni `@Column`** (com'era in `User`): doppia dichiarazione senza effetto
  sullo schema.
- **Ridurre le lunghezze di `users` (per esempio email 100, `password_hash` 60, `avatar_url` 255)**:
  valutata e non adottata per scelta dello studente; avrebbe richiesto di riscrivere V1 o di
  aggiungere una migrazione e di aggiornare il design.

## Decisione 44: PageParams con componenti Integer (implementazione)

### Scelta

`PageParams` è un record con componenti `Integer page` e `Integer size`, non `int` come nella tabella
delle interfacce del piano. Il costruttore compatto applica i default (page 0, size 20) quando il
parametro manca.

### Motivazione

Con `int` un parametro assente e uno a 0 sono indistinguibili: `size=0` deve dare 400
(progettazione, sezione 6.1) e `size` assente deve valere 20. Con `Integer` l'assenza è `null`. Il
comportamento è verificato su una vera richiesta in `PageParamsBindingTest`.

### Alternative scartate

- **`int` con il default nel controller (`@RequestParam(defaultValue = ...)`)**: il default andrebbe
  ripetuto in ogni endpoint e si perderebbe la validazione comune.
- **`int` con "0 = default"**: accetterebbe `size=0` invece di rifiutarlo.

## Decisione 45: codice UNSUPPORTED_MEDIA_TYPE per il Content-Type non supportato (implementazione)

### Scelta

Una richiesta con un body il cui `Content-Type` non è supportato (l'API accetta solo JSON) risponde
415 con il codice `UNSUPPORTED_MEDIA_TYPE`. Il codice è stato aggiunto al catalogo della sezione 6.2
del design, che non lo prevedeva. Una richiesta con un `Accept` non soddisfacibile (406) non è gestita:
la risposta d'errore stessa è JSON e non si potrebbe scrivere.

### Motivazione

È un errore del client, non del server. Senza un handler dedicato il catch-all lo trasformava in un 500
`INTERNAL_ERROR` con una voce di errore nel log, come se fosse un guasto dell'applicazione.

### Alternative scartate

- **`VALIDATION_ERROR` 400**: lo stato HTTP corretto per questo caso è 415, e un client che decide in
  base a `code` confonderebbe un tipo di contenuto sbagliato con dei campi non validi.
- **Lasciare il 500**: segnala un guasto che non c'è e riempie il log.

## Decisione 46: percorsi /api inesistenti riconosciuti dai soli mapping dei controller (implementazione)

### Scelta

Un percorso `/api/...` per cui nessun controller ha un handler risponde sempre 404 `NOT_FOUND` in JSON,
anche senza token e anche sotto `/api/admin/**` (design, sezione 6.3). Lo ottiene la **prima** regola di
`SecurityConfig`, un `RequestMatcher` (`UnmappedApiRequestMatcher`) che interroga **solo** i
`RequestMappingHandlerMapping` (i controller) e lascia passare la richiesta se nessuno ha un handler. Se
un mapping solleva un'eccezione (metodo o tipo di contenuto non accettati) il percorso esiste e segue le
regole normali: 401 o 403 prima del 405. La ricerca gira su una copia della richiesta che tiene per sé gli
attributi, così la ricerca vera del `DispatcherServlet` parte pulita.

### Motivazione

Il piano suggeriva di basare il matcher su `HandlerMappingIntrospector.getMatchableHandlerMapping`. In
Spring Boot però il mapping delle risorse statiche (`/**`) risponde a qualunque percorso, quindi
l'introspector troverebbe sempre un handler e ogni `/api/...` inesistente diventerebbe un 401. Limitare la
ricerca ai controller dà la risposta giusta; il fallback SPA di F6-03 non la cambia, perché riguarda solo i
percorsi fuori da `/api/**`.

### Conseguenza accettata

Senza token, 404 e 401 distinguono le rotte inesistenti da quelle esistenti ma protette: chi non è
autenticato può quindi capire se un percorso `/api/...` esiste. È la forma che il design richiede
(sezione 6.3) e non espone dati: i percorsi dell'API non sono segreti (compaiono in Swagger, F6-02) e i
dati restano dietro l'autenticazione. Vale anche per il metodo: un percorso esistente chiamato con il
metodo sbagliato risponde 401 o 403 prima del 405, non 404.

### Allineamento del design

Nella stessa card il design è stato corretto in due punti:

- `UserAccessService.loadActive` (sezioni 5.2, 7.2 e 8.2) è diventato `UserAccessService.resolve`, il nome
  del piano e del codice. `resolve` restituisce anche gli stati `SUSPENDED`, `NOT_VERIFIED` e
  `NOT_FOUND`, che i chiamanti (filtro, login, refresh) distinguono.
- Nella tabella della sezione 6.2 la riga `ACCESS_DENIED` non cita più l'"origine non ammessa": il rifiuto
  CORS è un 403 senza corpo JSON, scritto da Spring prima di arrivare ai nostri handler, quindi non ha il
  codice `ACCESS_DENIED`. Il frontend non può leggerlo come un `ErrorResponse`.

### Alternative scartate

- **`HandlerMappingIntrospector.getMatchableHandlerMapping` così com'è**: vede anche il mapping delle
  risorse statiche, quindi non distingue i percorsi inesistenti.
- **Disattivare il mapping delle risorse statiche**: romperebbe il servizio dei file del frontend (D1).
- **Rispondere 401 a tutto ciò che non è pubblico**: contraddice il design (404 anche sotto
  `/api/admin/**`) e il frontend scambierebbe un percorso sbagliato per un token scaduto, facendo
  partire un refresh inutile.

## Decisione 47: Origin del refresh e forward-headers-strategy in produzione (implementazione)

### Scelta

Due cose vanno insieme:

1. **Profilo `prod`: `server.forward-headers-strategy: native`.** Il TLS termina nel proxy di Render, che
   inoltra la richiesta in HTTP con `X-Forwarded-Proto: https`. Con `native` il `RemoteIpValve` di Tomcat
   ricostruisce schema e porta veri, così Spring vede la richiesta come HTTPS.
2. **Controllo dell'`Origin` su refresh e logout** (progettazione, sezioni 4.8 e 8.5): un `Origin` è
   accettato se è fra le origini configurate (`ALLOWED_ORIGIN`) oppure se host e porta coincidono con quelli
   dell'header `Host`; lo schema non si confronta. Un `Origin` assente passa (lo difendono `SameSite=Lax` e
   `X-Requested-With`).

### Motivazione

Il filtro CORS di Spring gira **prima** del controller e considera cross-origin ogni richiesta il cui
`Origin` non coincide con schema, host e porta che vede. I browser inviano `Origin` su ogni POST, anche
same-origin. Senza il punto 1, dietro il proxy il servizio vede `http` mentre l'`Origin` è `https`: il filtro
risponde 403 "Invalid CORS request" (testo semplice, non il nostro JSON) a **login, refresh e logout**, cioè
a ogni POST/DELETE del frontend. Il problema è stato riprodotto in F1-02 con una richiesta simulata
(`Host`, `X-Forwarded-Proto: https`, `Origin: https://...`) e risolto da `ForwardedHeadersRealServerTest`,
che avvia un server vero su porta casuale con i profili `test` e `prod`: login, refresh e logout passano, un
`Origin` esterno, `null` o con lo stesso prefisso dell'host resta bloccato, e senza `X-Forwarded-Proto` un
`Origin` https è bloccato.

Il controllo nel controller (punto 2) è quindi un secondo livello: per `Origin` esterno e `null` risponde già il
filtro CORS. Resta utile per i casi che il filtro lascia passare e per non dipendere da una sola difesa. Il
confronto sull'host è esatto (non "inizia con"): `host.evil.example` non passa.

### Cosa si assume sul proxy di Render (verificato al primo deploy, F2-03)

- Render termina il TLS e inoltra in HTTP aggiungendo `X-Forwarded-Proto` (e `X-Forwarded-For`).
- Il proxy contatta il servizio da un indirizzo di una rete privata o di loopback: `native` si fida degli
  header solo se la richiesta arriva da un proxy interno (default di Tomcat: 10.x, 172.16-31.x, 192.168.x,
  127.x, ::1 e simili). Se l'indirizzo di Render non rientrasse, gli header sarebbero ignorati e il login
  darebbe 403: la correzione è `server.tomcat.remoteip.internal-proxies` con l'intervallo giusto.
- L'header `Host` arriva invariato (il dominio `.onrender.com`, senza porta). Se Render lo cambiasse, il
  confronto fra `Origin` e `Host` andrebbe rivisto.

Esito del primo deploy (15 ottobre, con `curl`): login e refresh con `Origin` uguale all'indirizzo
`https://…onrender.com` rispondono 200 e un `Origin` di un altro sito 403, quindi gli header del proxy
sono accettati e `remoteip.internal-proxies` non serve. Il cookie `resonance_refresh` arriva `Secure`.
Non è stata provata la richiesta da un browser reale (si farà con il frontend).

### Alternative scartate

- **`forward-headers-strategy: framework`** (`ForwardedHeaderFilter` di Spring): funziona anche se
  l'indirizzo del proxy non è "interno", ma si fida di `X-Forwarded-*` da chiunque, anche da chi contatta il
  servizio direttamente. `native` limita la fiducia ai proxy noti ed è applicato in Tomcat, prima dei filtri
  di Spring.
- **Confrontare l'`Origin` con una sola origine configurata (`APP_ORIGIN`)**: una variabile in più da non
  dimenticare e da tenere uguale al dominio assegnato da Render, e non risolve il 403 del filtro CORS.
- **Escludere refresh e login dal CORS**: il filtro è globale su `/api/**`; escluderne alcuni percorsi
  indebolirebbe la difesa del punto 2 e della sezione 8.5.

### Dettagli collegati

I `details` di un errore possono avere valori `null` (`suspendedUntil` di una sospensione a tempo
indeterminato, che il design vuole presente nel JSON): `AppException` ed `ErrorResponse` non usano più
`Map.copyOf`, che rifiuta i `null`, ma una copia non modificabile che li ammette.

## Decisione 48: limite dei login falliti per email e confronto BCrypt fittizio (implementazione)

### Scelta

- **Limite dei fallimenti (`LOGIN_FAILED`, progettazione 4.7 e 8.8)**: la chiave è l'**email**, 10
  fallimenti in 15 minuti, finestra scorrevole in memoria. Il controllo viene prima delle credenziali: oltre
  il limite il login risponde 429 anche con la password giusta. Un login riuscito azzera il contatore; i
  controlli di email non verificata e di sospensione, fatti solo dopo la password giusta, non contano come
  fallimenti.
- **Confronto BCrypt fittizio**: se l'email non esiste, `AuthService` confronta comunque la password con un
  hash calcolato una volta all'avvio con lo stesso `PasswordEncoder` (stesso costo) da una stringa casuale, e
  scarta il risultato. Il test `AuthServiceTest` verifica che `matches` sia chiamato anche per un'email
  sconosciuta. Sopra i 72 byte BCrypt non si chiama né per utenti veri né per il confronto fittizio.

### Motivazione

Senza il confronto fittizio l'email sconosciuta risponde in circa 6 ms contro circa 68 ms di una password
errata (misurato in locale in F1-02): il tempo rivela quali email sono registrate, vanificando la risposta
identica 401 `INVALID_CREDENTIALS`. La chiave per email protegge una password dall'attacco a tentativi
ripetuti senza bloccare chi ne prova una sola su molti account.

### Conseguenza accettata

Poiché la chiave è l'email e non l'utente o l'indirizzo IP, **chiunque può bloccare il login di un altro
utente per 15 minuti**: basta inviare 10 login falliti con la sua email. L'utente bloccato non perde nulla
(il limite è solo in memoria, scade da solo e non tocca la sessione già aperta), ma non può accedere finché la
finestra non scorre. Un limite per IP non risolverebbe: dietro i proxy l'indirizzo è condiviso e manipolabile,
e un attaccante con molti indirizzi lo aggirerebbe. Nell'MVP si accetta; un CAPTCHA o un limite combinato
sono evoluzioni successive (Post-V1).

### Alternative scartate

- **Chiave per indirizzo IP**: dietro il proxy di Render tutti gli utenti condividono pochi indirizzi
  (falsi positivi) e un attaccante distribuito lo aggira.
- **Nessun confronto fittizio (come NoseY)**: più semplice, ma la differenza di tempo rende l'enumerazione
  delle email immediata.
- **Ritardo casuale invece del confronto fittizio**: meno affidabile (il tempo medio resta diverso) e
  allunga anche le risposte legittime.

## Decisione 49: id nei DTO di risposta solo dove servono a un'azione (implementazione)

### Scelta

Un DTO di risposta contiene un id solo se il client lo usa per un'azione successiva (aprire un dettaglio,
mettere un like, scrivere a un utente). Per questo:

- la registrazione risponde solo `{email}` (progettazione 4.4 e 6.4): dopo di essa il client deve solo
  verificare l'email e fare il login;
- `MeResponse` **contiene l'`id`**, solo per il proprio profilo: il frontend lo confronta con
  `AuthorSummary.id` e `senderId` per riconoscere i propri contenuti;
- gli id dei contenuti e degli autori restano nelle liste e nei dettagli; l'interfaccia non mostra mai un id
  all'utente (regola per le card FE).

### Motivazione

Mostrare meno dati riduce l'esposizione, ma non è un livello di sicurezza: la protezione reale sono i
controlli nel service (ruoli dal database, `NOT_OWNER`, 404 sui contenuti nascosti). L'id di un utente è
comunque già nel `sub` del JWT e nelle risposte degli altri utenti. Togliere l'id da `MeResponse` lasciava
senza risposta la domanda "questo contenuto è mio?", che il design risolve con il confronto degli id.

### Alternative scartate

- **Flag `mine`/`fromMe` calcolati dal server in ogni DTO**: il client non avrebbe bisogno del proprio id,
  ma cambia molti DTO e gli eventi WebSocket (chat, notifiche) andrebbero calcolati per ogni destinatario.
- **Identificatore pubblico separato dall'id interno (`public_id`, slug)**: sarebbe comunque un
  identificatore visibile, con migrazioni su ogni tabella esposta e card già fatte da rifare; non aggiunge
  sicurezza.
- **Id temporanei per sessione**: stato in memoria che si perde al riavvio del servizio gratuito, problemi
  con più schede e con la chat in tempo reale.

## Decisione 50: codice email in chiaro e registrazione su email non verificata (implementazione)

### Scelta

- **Codice in chiaro.** Il codice di verifica di 6 cifre è salvato in chiaro nella colonna
  `email_codes.code`. La protezione reale sono i 5 tentativi consumati in modo atomico, i 15 minuti di
  validità e i limiti di invio (1 al minuto, 5 in 24 ore); il confronto resta a tempo costante. Dopo l'uso
  la colonna torna NULL.
- **Registrazione su email già presente ma non verificata.** Dopo aver emesso il nuovo codice (e quindi
  superato i limiti di invio), la registrazione sovrascrive nome e password. Chi registra l'email altrui non
  può verificarla, perché il codice arriva solo alla casella del proprietario. Può però far arrivare fino a 5
  email al giorno e, finché dura il limite, impedire al proprietario di registrarsi di nuovo (risposta 429 per
  quasi un giorno). È la scelta del design (sezione 4.4) e di NoseY, accettata per l'MVP.

### Motivazione

Un hash di un numero con un milione di valori si inverte in pochi istanti: non aggiungerebbe protezione e
complicherebbe il confronto. Per la sovrascrittura, chi si registra con una password dimenticata o un nome
sbagliato deve poter ripartire senza assistenza; il passo di verifica richiede la password della
registrazione, quindi il codice da solo non basta a prendere l'account.

### Alternative scartate

- **Hash del codice (SHA-256 o BCrypt)**: nessun vantaggio reale con 6 cifre, in più un confronto meno
  semplice da testare.
- **Non sovrascrivere e rinviare solo il codice**: elimina il disturbo di chi registra l'email altrui, ma
  chi ha dimenticato la password scelta non potrebbe più completare la registrazione.

## Decisione 51: errori del reset e della password dimenticata che non rivelano gli account (implementazione)

### Scelta

- **Reset.** Con un codice sbagliato, scaduto, esaurito (5 tentativi) o assente, `POST /api/auth/password/reset`
  risponde sempre `400 CODE_INVALID`, anche per un account sospeso, non verificato o inesistente. Il `403
  ACCOUNT_SUSPENDED` arriva solo con un codice valido. Il codice si verifica prima dello stato dell'account.
  Il tentativo consumato resta salvato in ogni caso.
- **Perché il login e il reset sono diversi.** Il login dà `ACCOUNT_SUSPENDED` dopo aver verificato la
  password; il reset lo dà dopo aver verificato il codice. In entrambi i casi chi lo legge ha già dimostrato
  qualcosa che solo il proprietario possiede (la password, o l'accesso alla casella), quindi l'informazione
  non è sfruttabile da un estraneo che prova email a caso.
- **Forgot.** `POST /api/auth/password/forgot` risponde sempre `204` per email sconosciuta, non verificata,
  sospesa e per account verificato e attivo; il codice parte solo nell'ultimo caso. Il `429` per un secondo
  invio entro 60 secondi (o oltre 5 in 24 ore) scatta solo per gli account verificati e attivi, perché solo
  per loro esiste una riga di invio. Il `429` quindi distingue le email verificate, come già nel reinvio del
  codice di verifica (sezione 4.6). È una perdita di riservatezza piccola e nota, accettata per l'MVP.

### Motivazione

Il design (sezione 4.10) chiede lo "stesso schema di controlli" della verifica, dove però lo stato
dell'account (sospeso) veniva controllato prima del codice e quindi lo rivelava a chiunque conoscesse
un'email. Spostare il controllo dopo il codice chiude questa strada senza costi per l'utente legittimo.
Le due condizioni di `CODE_EXPIRED` e `CODE_INVALID` si fondono nel reset: all'utente basta sapere che deve
chiedere un nuovo codice.

### Alternative scartate

- **Lasciare `ACCOUNT_SUSPENDED` prima del codice**: rivela a chiunque quali email sono sospese.
- **Rispondere `CODE_INVALID` anche con il codice valido su un account sospeso**: nasconde tutto, ma
  l'utente sospeso non capirebbe perché il reset non funziona.
- **Rendere il `429` di forgot identico per tutte le email** (limite in memoria per email invece di una riga
  per account): elimina la distinzione, ma richiede un secondo meccanismo di limite e non è nel design.

## Decisione 52: DatabaseUrl non forza sslmode (implementazione)

### Scelta

`DatabaseUrl` converte `DATABASE_URL` (`postgresql://utente:password@host:porta/db`) in un URL JDBC con le
credenziali separate e **mantiene i parametri già presenti nell'URL**, senza aggiungerne. Non c'è più
`sslmode=require` forzato. L'URL **esterno** di Render ha già `?sslmode=require` e quindi usa TLS; l'URL
**interno** non ha parametri e il suo server non offre TLS, quindi la connessione resta in chiaro dentro la
rete privata di Render. Anche lo schema `postgres://` è accettato. Il log stampa l'URL JDBC senza credenziali e
oscura un eventuale parametro `password=`.

### Motivazione

La scelta è stata fatta dopo un avvio di prova con il profilo `prod` e una `DATABASE_URL` in formato Render
senza parametri verso il PostgreSQL di Docker Compose (che non offre TLS): con `sslmode=require` forzato
l'applicazione non partiva (Flyway: "Il server non supporta SSL"). Lo stesso succederebbe sull'URL interno di
Render, che è quello collegato dal Blueprint (`fromDatabase`, `connectionString`; da confermare al primo deploy, F2-03). Lasciare i parametri a chi fornisce l'URL è più
semplice e corretto: chi vuole TLS lo ha già nell'URL (quello esterno), chi non lo offre non viene rotto.
Dopo la modifica la stessa prova parte, Flyway applica le tre migrazioni e il SUPERADMIN viene creato.

### Alternative scartate

- **`sslmode=require` sempre** (design originale, sezione 12.3 e brief): funziona solo se il server offre TLS,
  quindi rompe l'URL interno di Render e il database locale di Compose.
- **`sslmode=require` solo se manca nell'URL e l'host non è interno**: richiede di indovinare dall'host se il
  server offre TLS, fragile e non verificabile senza Render.
- **Variabile d'ambiente dedicata (`DB_SSLMODE`)**: una configurazione in più da tenere allineata quando
  l'URL può già contenere il parametro.

## Decisione 53: attivazione dei ruoli con un solo INSERT idempotente (implementazione)

### Scelta

`POST /api/users/me/roles/musician` e `/host` assegnano il ruolo con un unico `INSERT ... ON CONFLICT DO
NOTHING` (`UserRoleRepository.addIfAbsent`, query nativa con `cast(:role as user_role)`). L'endpoint risponde 200
`MeResponse` sia quando il ruolo viene aggiunto sia quando c'era già. Il service accetta solo MUSICIAN e HOST.

### Motivazione

Il design chiede che l'attivazione sia idempotente (sezione 5.3). Un controllo `existsById` seguito da `save`
non lo è con due richieste concorrenti (ad esempio un doppio clic): la seconda violerebbe `pk_user_roles` e
risponderebbe 409 invece di 200. L'`INSERT` condizionale è atomico e non richiede lock sull'utente.

### Alternative scartate

- **`existsById` + `save`**: semplice, ma con richieste concorrenti dà un 409 a un'operazione che deve essere
  idempotente.
- **Lock pessimistico sull'utente** (`findWithLockById`) prima del controllo: corretto, ma serializza richieste
  che non hanno bisogno di lock e costa una query in più.
- **Intercettare la `DataIntegrityViolationException` e ignorarla**: dentro una transazione la violazione la
  segna come da annullare, quindi la risposta riuscirebbe ma il commit fallirebbe.

## Decisione 54: controlli della nomina ADMIN e dell'elenco utenti (implementazione)

### Scelta

- **Verifiche solo alla nomina.** `USER_NOT_VERIFIED` e `USER_NOT_ACTIVE` (409) si applicano a
  `POST /api/superadmin/users/{id}/admin`, non alla revoca: un ADMIN sospeso o non verificato si può sempre
  revocare. La regola dei livelli vale per entrambe.
- **"Sospeso" tiene conto della scadenza.** Per `USER_NOT_ACTIVE` un utente con `suspended_until` già passato
  conta come attivo, anche se la riattivazione pigra non ha ancora chiuso la riga (progettazione, sezione 5.5).
- **`LAST_SUPERADMIN` è una difesa non raggiungibile via HTTP.** La regola dei livelli rifiuta già la
  sospensione di qualsiasi SUPERADMIN, quindi il controllo (che viene dopo) non scatta mai da una richiesta
  reale. Resta nel codice come previsto dal design e si prova con un test unitario di `AdminUserService` in cui
  la regola dei livelli è sostituita da un finto che lascia passare tutto.
- **Elenco utenti con `Specification`.** Filtri su email, nome e stato costruiti con i criteri JPA e `LIKE ...
  ESCAPE '\'`; `%`, `_` e `\` cercati dall'amministratore sono caratteri normali (`escapeLike`, riusata da
  NoseY). I ruoli della pagina si leggono con una sola query, non una per riga. Il filtro `status` mostra lo
  stato salvato: una sospensione scaduta ma non ancora chiusa risulta ancora SUSPENDED fino al primo accesso
  dell'utente.

### Motivazione

- Revocare non può dipendere dallo stato dell'utente: sospendere un ADMIN e non poterlo poi privare del ruolo
  sarebbe un blocco senza uscita.
- Chiamare "sospeso" un utente la cui sospensione è finita impedirebbe di nominarlo senza motivo, dato che nel
  sistema non c'è un job che chiuda le sospensioni scadute.
- Un controllo irraggiungibile ma senza test sarebbe codice morto non verificato; il test unitario lo tiene
  vivo senza indebolire la regola dei livelli.
- Una `Specification` aggiunge solo le condizioni che servono, senza parametri nulli, ed è il modo usato
  anche da NoseY.

### Alternative scartate

- **Verifiche anche alla revoca**: più simmetrico, ma lascia un ADMIN sospeso con i suoi poteri fino alla fine
  della sospensione.
- **Riattivare le sospensioni scadute prima di ogni nomina o elenco**: scritture dentro una lettura e un
  comportamento diverso dal resto del sistema, dove la riattivazione avviene solo all'accesso dell'utente.
- **Eliminare il controllo `LAST_SUPERADMIN`**: scelta contraria al design; lo protegge se in futuro la regola
  dei livelli cambiasse.
- **Query JPQL con `(:status is null or u.status = :status)`**: non provata: con il tipo enum nominato di
  PostgreSQL un parametro nullo può non avere un tipo determinabile, e la `Specification` evita il problema.

## Decisione 55: ogni errore del client Nominatim è GEOCODING_UNAVAILABLE (implementazione)

### Scelta

Nel client `NominatimGeocodingService` ogni errore del servizio diventa `GEOCODING_UNAVAILABLE` (502): timeout,
errore di rete, risposta 429 o 5xx (come già previsto dalla decisione 3), ma anche corpo JSON illeggibile,
coordinate non numeriche e attesa del proprio turno interrotta. Un indirizzo vuoto o una lista di risultati
vuota danno `ADDRESS_NOT_FOUND` (400, `fields.address`), l'indirizzo vuoto senza chiamare Nominatim. Nel log
finiscono solo il tipo di eccezione e lo stato HTTP, mai l'indirizzo.

### Motivazione

- Per chi pubblica un evento una risposta malformata di Nominatim equivale a un servizio che non funziona: può
  solo riprovare più tardi, e il frontend mostra lo stesso messaggio.
- L'indirizzo è un dato scritto dall'utente: tenerlo fuori dal log evita di conservare luoghi e indirizzi privati.
- Questa decisione estende l'elenco della decisione 3 (che nominava solo timeout, rete, 5xx e 429); la regola
  arriva all'API con F3-02, la prima card in cui questi errori vengono mostrati al client.

### Alternative scartate

- **500 `INTERNAL_ERROR` per le risposte malformate**: il frontend non potrebbe distinguere un servizio esterno
  fuori uso da un errore dell'applicazione, e l'errore finirebbe nel log come bug nostro.

## Decisione 56: scelte di implementazione dei concerti ufficiali (implementazione)

### Scelta

- **`Moderation` non è mai null nell'entity.** `OfficialConcert.getModeration()` ricrea un `Moderation` vuoto se
  Hibernate ne ha letto uno nullo. Con `@Embeddable` e tutte le colonne a `NULL` (cioè ogni contenuto visibile)
  Hibernate 7 restituisce `null`: l'impostazione `hibernate.create_empty_composites.enabled`, che lo evitava nelle
  versioni precedenti, non esiste più. Lo stesso getter servirà alle altre tre entity moderabili.
- **Ricerca nelle vicinanze in due query.** La query nativa (bounding box + Haversine SQL, sezione 10.2)
  restituisce solo id e distanza della pagina, insieme a una query di conteggio con gli stessi filtri; i concerti
  e i loro autori si caricano con una seconda query (`findByIdIn` con `EntityGraph`) e si rimettono nell'ordine
  della prima. La formula della distanza sta in una costante condivisa dalle due query native.
- **Geocodifica fuori dalla transazione con `TransactionTemplate`.** `OfficialConcertService.create` non è
  `@Transactional`: chiama Nominatim e poi apre la transazione di salvataggio con `TransactionTemplate`, perché
  una chiamata a un metodo `@Transactional` della stessa classe non passerebbe dal proxy.
- **Un body con un valore illeggibile indica il campo.** Per `HttpMessageNotReadableException`, se Jackson sa
  quale campo non ha potuto leggere (per esempio `eventDate: "2026-10-20T21:00"`, senza fuso orario),
  `GlobalExceptionHandler` lo mette in `fields`, come una validazione; con JSON malformato `fields` resta vuoto.
  Il valore ricevuto non viene mai ripetuto nella risposta.
- **`radiusKm` obbligatorio** insieme a `lat` e `lng` in `GET /api/official-concerts/nearby`: nessun raggio di
  default inventato; la mancanza di uno dei tre è un 400 `VALIDATION_ERROR`.
- **Gli admin non cancellano come proprietari.** `DELETE /api/official-concerts/{id}` fatto da un non
  proprietario, admin compresi, è 403 `NOT_OWNER`: gli admin moderano con gli endpoint dedicati (F4-03). Un
  concerto già nascosto è 404 per tutti, proprietario compreso.

### Motivazione

- Un getter che non restituisce mai null evita controlli sparsi nel codice e funziona con qualsiasi versione di
  Hibernate; un `@Embeddable` con costruttore vuoto non permette di fare di meglio senza una configurazione
  non più disponibile.
- Una query sola con tutte le colonne più la distanza obbligherebbe a mappare un'entity con un campo calcolato;
  due query semplici sono più chiare e il costo è una lettura per chiave primaria su una pagina da al massimo 100
  righe.
- Il metodo `@Transactional` interno ignorato dal proxy è un errore classico di Spring: `TransactionTemplate`
  rende esplicito dove inizia la transazione.
- Dire all'utente quale campo ha sbagliato (la data senza fuso orario) è più utile di un errore generico e non
  richiede di cambiare il tipo del campo in `String`.

### Alternative scartate

- **Un metodo `@Transactional` in un bean separato per il salvataggio**: funziona, ma crea una classe in più
  solo per aprire una transazione.
- **Query nativa che restituisce direttamente le entity più un campo distanza**: mappatura più fragile, e la
  paginazione e il conteggio sarebbero comunque due query.
- **`eventDate` come `String` da convertire a mano**: perde la validazione `@Future` di Bean Validation e
  sposta nel service il controllo del formato.
- **Raggio di default (per esempio 25 km)**: una scelta di prodotto non prevista dal design.

## Decisione 57: scelte di implementazione degli indie event (implementazione)

### Scelta

- **Bozza altrui = 404, anche per publish e delete.** Una bozza la vede solo il proprietario: per chiunque altro
  (anonimi e admin compresi) dettaglio, `publish` e `DELETE` rispondono 404 `NOT_FOUND`, non 403. `NOT_OWNER`
  resta per le azioni su un evento già pubblicato di un altro utente, come per i concerti (decisione 56).
- **Dettaglio pubblico con autenticazione facoltativa.** `GET /api/indie-events/{id}` è `permitAll`, ma il
  `JwtFilter` imposta comunque l'utente se il token è valido; il controller riceve `null` per gli anonimi e il
  service decide se mostrare la bozza. Un token non valido su questo endpoint non lo blocca. In `SecurityConfig`
  `GET /api/indie-events/mine` (autenticato) precede `{id}`, che altrimenti lo renderebbe pubblico.
- **`EventInputNormalizer` condiviso dalle richieste.** Trim, "vuoto = assente" e normalizzazione dei generi
  stanno in una classe del package `event` usata da `CreateOfficialConcertRequest` e `CreateIndieEventRequest`;
  le due entity restano separate. Nello spostare il codice è emerso un difetto già presente nei concerti: un
  genere `null` (`"genreTags": [null]`) dava 500, perché `@Size` accetta `null` e `List.copyOf` lancia
  `NullPointerException`. Ora `normalizeTags` non usa `List.copyOf` e gli elementi hanno `@NotNull` in entrambe le
  richieste: 400 `VALIDATION_ERROR` su `genreTags`.
- **Data passata alla pubblicazione decisa dal `Clock`.** `publish` confronta `eventDate` con il `Clock`
  dell'applicazione (non con `@Future`, che usa l'orologio di sistema), così il caso "bozza diventata passata" si
  verifica nei test avanzando il `MutableClock`. L'errore è 400 `EVENT_DATE_PAST`, con `fields.eventDate`.
- **`mine` elenca tutto ciò che non è nascosto,** bozze, pubblicati e passati, dal più recente
  (`created_at desc, id desc`): il design non fissa l'ordine e questo è quello di collab e feed.
- **La ricerca nearby non mostra mai le bozze,** nemmeno al proprietario, che le trova in `mine`.
- **La formula della distanza è quella dei concerti.** `IndieEventRepository` riusa la costante
  `OfficialConcertRepository.DISTANCE_KM` (alias di tabella `c` in entrambe le query).

### Motivazione

- Rispondere 403 su una bozza altrui rivelerebbe che esiste; il 404 è coerente con il design (sezione 6.6) e con
  il trattamento dei contenuti nascosti.
- Non rendere pubblico il dettaglio solo ai proprietari obbligherebbe a due endpoint o a un secondo percorso
  nel service; leggere l'utente facoltativo è il modo più semplice e non cambia i permessi di nessun altro
  endpoint.
- Una sola implementazione della normalizzazione evita che concerti e indie event divergano nelle regole sui
  generi.
- Un test con il `Clock` finto è deterministico; con l'orologio di sistema servirebbe attendere o scrivere date
  nel passato direttamente nel database.

### Alternative scartate

- **403 `NOT_OWNER` sulle bozze altrui:** conferma l'esistenza della bozza.
- **Unificare `OfficialConcert` e `IndieEvent` in un'unica entity con un tipo:** il design le tiene separate
  (colonne e permessi diversi) e il piano lo esclude.
- **Rendere pubblico `mine` o filtrarlo per stato:** non richiesto; il filtro per stato si potrà aggiungere se
  serve al frontend.

## Decisione 58: patch di sicurezza sulle dipendenze transitive (implementazione)

### Scelta

- Nel `pom.xml` si sovrascrivono, con le proprietà del BOM di Spring Boot 4.1.1, le versioni di quattro librerie
  transitive con CVE segnalate dall'analisi dell'IDE (Mend.io): `tomcat.version` 11.0.24 → 11.0.27,
  `jackson-2-bom.version` 2.21.5 → 2.21.7, `jackson-bom.version` 3.1.5 → 3.1.7, `postgresql.version`
  42.7.13 → 42.7.14. Sono tutte patch della stessa linea minore.
- Anche `logback` (`logback.version` 1.5.38 → 1.6.5) e `asm` (9.7.1 → 9.11) sono aggiornati. `asm` arriva da
  `spring-boot-starter-test` (json-smart) e non ha una proprietà nel BOM: si fissa con un `dependencyManagement`.
  `logback` salta di linea minore (1.5 → 1.6), perché per la 1.5 non esiste una patch successiva alla 1.5.38.
- Le sovrascritture vanno rimosse quando una nuova patch di Spring Boot 4.1.x include versioni uguali o più
  recenti.

### Motivazione

- Tomcat e Jackson sono raggiungibili da internet (richieste HTTP, WebSocket, JSON di ogni endpoint) e le CVE di
  Tomcat arrivano a gravità 9.8; il primo deploy su Render è già stato fatto.
- Restare sulla stessa linea minore limita il rischio di incompatibilità con Spring Boot 4.1.1; `./mvnw -q verify`
  passa interamente dopo la modifica. Il salto di `logback` a 1.6 è l'eccezione: Boot 4.1.1 è pensato per la 1.5
  (con slf4j 2.0.18), quindi il log di Render va controllato dopo il deploy; in caso di problemi basta togliere
  la proprietà `logback.version`. `asm` è solo in scope `test`, senza effetti sul runtime.

### Alternative scartate

- **Aggiornare il parent Spring Boot:** 4.1.1 è l'ultima 4.1.x disponibile; 4.2 è solo milestone.
- **Salire alle linee minori più recenti (Jackson 2.22/3.2):** cambio di minore non testato con il BOM di Boot.
- **Rimandare a una card dedicata:** l'esposizione è già in produzione.

## Decisione 59: chat solo fra amici, ricerca utenti e sblocchi da candidature e contatti (richiesta dello studente, sostituisce la chat libera del brief)

### Scelta

Su richiesta dello studente (16 ottobre) la regola del brief "chiunque può scrivere a chiunque" (§7.1, §8.3-E,
§8.4) è **sostituita**, come la D1 dalla decisione 1. Il brief resta invariato; questa decisione prevale.

- **Amicizie** (package `friendship`, tabella `friendships`, migrazione `V8__friendships.sql`, card F4-04).
  Una riga per coppia (indice univoco sulla coppia canonica `LEAST`/`GREATEST` degli id), stati persistenti
  `PENDING`, `ACCEPTED`, `DECLINED`, `CANCELLED`, `REMOVED`, colonna `closed_by` e **rifiuto silenzioso** come
  NoseY (`request_masked`): chi è stato rifiutato continua a vedere la propria richiesta come inviata.
  Endpoint: richiesta, accetta, rifiuta, annulla, rimuovi, elenchi (progettazione, sezione 6.14). Dopo un
  rifiuto o una rimozione può chiedere di nuovo solo chi ha chiuso; dopo un annullamento chiunque. Limite
  `FRIEND_REQUESTS` (20 in 24 ore). Nessuna eccezione per ADMIN e SUPERADMIN.
- **Ricerca utenti** `GET /api/users/search?q` (card F4-05): solo autenticati; solo utenti verificati e ACTIVE,
  escluso chi cerca; solo su `displayName` (mai email), 2–50 caratteri; paginata; limite `USER_SEARCH`
  (30 al minuto); ogni risultato riporta lo stato dell'amicizia visto da chi cerca e il `friendshipId` quando
  serve a un'azione.
- **Permesso di scrittura in chat**: in una conversazione si scrive se i due utenti sono **amici** oppure se
  esiste uno **sblocco** la cui origine è ancora aperta (tabella `chat_unlocks`, migrazione `V9__chat.sql`):
  - candidatura a un annuncio collab (F5-03): aperto finché l'annuncio non è chiuso ("risolto"), cancellato
    dal proprietario o nascosto da un admin;
  - contatto di un concerto ufficiale o di un indie event pubblicato (F5-04): aperto fino all'**inizio**
    dell'evento (`event_date`), se non cancellato o nascosto. Il contatto si può aprire solo prima dell'inizio.
  Il controllo vale a ogni invio (STOMP, dopo il controllo di appartenenza) e alla creazione di una
  conversazione nuova con `POST /api/chats` (solo fra amici). Lo storico resta sempre leggibile;
  `ConversationResponse.canSend` dice al frontend se può scrivere.
- **Notifiche live delle richieste di amicizia**: fuori dall'MVP.
- **Tagli**: amicizie e ricerca diventano non tagliabili (la chat ne dipende); il contatto degli eventi
  (F5-04) entra nell'ordine dei tagli prima della bacheca collab.

### Motivazione

- Lo studente vuole che i messaggi fra utenti singoli siano consensuali; la ricerca serve a trovare chi
  aggiungere.
- Le candidature e i contatti degli eventi restano utili solo se chi non si conosce può scriversi: lo
  sblocco è legato a un'origine concreta e finisce con essa, quindi non diventa una chat libera permanente.
- Gli stati persistenti con rifiuto silenzioso sono già collaudati in NoseY e limitano lo spam: chi è stato
  rifiutato o rimosso non può insistere.
- Una tabella di sblocchi con l'origine gestisce più motivi per la stessa coppia (una sola conversazione).

### Alternative scartate

- **Riga cancellata a ogni rifiuto, annullamento o rimozione:** più semplice, ma chi è rifiutato può
  ripetere la richiesta all'infinito (scelta dello studente).
- **Stato `UNAVAILABLE` visibile a chi è stato rifiutato:** più semplice del rifiuto silenzioso, ma rivela il
  rifiuto.
- **Candidatura che sblocca solo il primo messaggio, o sblocco permanente:** il primo rende inutile la bacheca
  collab, il secondo trasforma una candidatura in una chat libera per sempre.
- **Chiusura degli eventi a fine evento (durata convenzionale o nuovo campo `endDate`):** la prima inventa una
  durata, la seconda modifica le card F3 già chiuse; la chat serve ad accordarsi prima dell'evento.
- **Contatto solo per le collab:** lo studente vuole anche il contatto con l'organizzatore degli eventi.
- **Colonna booleana di sblocco su `chat_conversations`:** non distingue le origini, quindi non può chiudersi
  quando l'origine si chiude.

### Rischi dichiarati

- Circa +8,5 h di lavoro (calendario nella progettazione, sezione 14): il giorno di anticipo serve tutto.
- `chat_unlocks.source_id` non ha una FK vera (punta a tre tabelle): l'integrità è garantita dal service, che
  crea lo sblocco solo dopo aver letto l'origine.

## Decisione 60: scelte di implementazione degli annunci collab (implementazione)

### Scelta

- **`PATCH /{id}/close` risponde 200 con l'annuncio aggiornato** (`CollabPostResponse`, `isOpen: false`), non con
  un body vuoto: il design fissa solo "idempotente → 200" e il frontend può aggiornare la scheda senza una seconda
  chiamata. Chiuderlo di nuovo dà lo stesso 200.
- **Stesse regole di accesso degli indie event (decisione 57).** Annuncio nascosto o inesistente = 404 per tutti,
  anche su `close` e `DELETE`; annuncio altrui, admin compresi, = 403 `NOT_OWNER`. Gli admin moderano con gli
  endpoint dedicati (F4-03). Un annuncio chiuso si può comunque cancellare.
- **`CollabPostResponse`** = `{id, musician: AuthorSummary, title, description, roleNeeded, genreTags, location,
  isOpen, createdAt}`: il design (sezione 6.7) non la definisce; ricalca `IndieEventResponse`, senza l'email
  dell'autore.
- **Generi e testi normalizzati con `EventInputNormalizer`** (package `event`, decisione 57), così annunci ed eventi
  seguono le stesse regole sui generi; `location` è testo libero e non viene geocodificato.
- **Indice parziale `ix_collab_posts_open_created (created_at DESC, id DESC) WHERE is_open AND hidden_at IS NULL`**
  nella V6, per la lista pubblica; il design (sezione 3.2) non elenca indici per `collab_posts`. Con un solo
  indice parziale la lista usa l'ordinamento voluto (`created_at desc, id desc`) senza ordinare in memoria.

### Motivazione

- Restituire l'annuncio evita una GET subito dopo la chiusura e non cambia il contratto del design (200).
- Un'unica regola per 404/403 su tutti i contenuti del proprietario rende il comportamento prevedibile e testabile
  allo stesso modo.
- L'indice parziale ha dimensione minima (solo gli annunci visibili) e copre la sola query frequente.

### Alternative scartate

- **204 senza body su `close`:** vale, ma obbliga il client a rileggere l'annuncio.
- **403 invece di 404 su un annuncio nascosto altrui:** rivelerebbe l'esistenza di un contenuto ritirato.
- **Indice completo su `(created_at, id)`:** più grande e include annunci chiusi o nascosti che la lista non mostra mai.

## Decisione 61: scelte di implementazione del feed e dei like (implementazione)

### Scelta

- **Filtro per raggio incompleto = 400 `VALIDATION_ERROR`** con in `fields` solo i parametri mancanti (`lat`, `lng`,
  `radiusKm`); i valori fuori range li rifiuta `NearbyQuery`, come per gli eventi. Il design (sezione 6.8) dice
  "tutti e tre i parametri o nessuno" senza fissare l'errore.
- **Con il filtro l'ordine resta `created_at desc, id desc`**, non per distanza (sezione 10.2). `distanceKm` è solo
  un campo della risposta: valorizzato nella lista filtrata, `null` senza filtro e nel dettaglio.
- **`@CoordinatesTogether` generalizzato con l'interfaccia `HasCoordinates`** (package `user.dto`): la regola
  "coordinate insieme o nessuna" vale per `UpdateProfileRequest` e `CreateFeedPostRequest`, con l'errore su
  `latitude` e `longitude`.
- **`likes_count` è in sola lettura nell'entity** (`insertable=false`, `updatable=false`, senza setter). Lo cambiano
  solo gli UPDATE nativi `likes_count + 1` e `- 1` (sezione 3.4); dopo like e unlike il valore si rilegge con una
  query scalare, perché l'entity in cache sarebbe vecchia.
- **`PUT` e `DELETE /{id}/like` rispondono 200 con `LikeStatusResponse {likesCount, likedByMe}`**, come nella sezione
  6.8. Su post nascosto o inesistente rispondono 404; il like dell'autore al proprio post è ammesso.
- **Come per annunci ed eventi (decisioni 57 e 60):** post nascosto o inesistente = 404 per tutti, post altrui (admin
  compresi) = 403 `NOT_OWNER` sulla cancellazione, che nasconde il post con motivo facoltativo.
- **Lista e dettaglio pubblici calcolano `likedByMe` se c'è un utente autenticato.** Un token non valido su questi
  endpoint si tratta come anonimo (sezione 8.2): `likedByMe = false`, non 401.
- **Indici della V7:** `ix_feed_posts_created (created_at DESC, id DESC) WHERE hidden_at IS NULL` e
  `ix_feed_posts_coordinates (latitude, longitude) WHERE latitude IS NOT NULL`, più `ix_feed_posts_author`; il
  design (sezione 3.2) non elenca indici per `feed_posts`.

### Motivazione

- Nominare i parametri mancanti permette al frontend di evidenziare il campo giusto, come per le altre validazioni.
- L'ordine per data mantiene il feed uguale con e senza filtro: il raggio restringe i post, non cambia l'ordine.
- Riusare la regola delle coordinate evita un secondo validatore identico.
- Tenere il contatore fuori dalle scritture dell'entity impedisce per costruzione l'aggiornamento "leggi, somma,
  salva" che perde like simultanei.
- Gli indici parziali coprono solo i post visibili (e quelli con coordinate) e le due query frequenti.

### Alternative scartate

- **Ignorare un filtro incompleto e restituire il feed intero:** nasconderebbe l'errore del client.
- **Ordinare per distanza con il filtro:** il feed cambierebbe ordine solo quando si indica il raggio; il design lo
  vuole per data.
- **Duplicare il validatore delle coordinate nel package `feed`:** stessa regola in due punti da tenere allineati.
- **`likes_count` modificabile dall'entity con `@Version` o lock:** più codice e contesa sulla riga, per un risultato
  che l'UPDATE atomico dà già.
- **Indice completo su `(created_at, id)`:** include i post nascosti, che la lista non mostra mai.

## Decisione 62: scelte di implementazione della moderazione admin (implementazione)

### Scelta

- **Ordine dei controlli di `hide` e `restore`:** contenuto inesistente = 404; poi la regola dei livelli sull'autore
  (403 `INSUFFICIENT_PLATFORM_LEVEL`); poi lo stato (409 `CONTENT_ALREADY_HIDDEN`, `CONTENT_NOT_HIDDEN`,
  `RESTORE_NOT_ALLOWED`). I ruoli dell'autore si leggono dal database. Un admin che modera un proprio contenuto riceve
  403 (la regola vieta di agire su se stessi).
- **`{type}` sconosciuto = 400 `VALIDATION_ERROR`:** un `Converter<String, ModeratedContentType>` traduce il segmento
  dell'URL (`feed-posts`, ...) e lancia `IllegalArgumentException` per i valori sconosciuti, che il
  `GlobalExceptionHandler` già trasforma in 400.
- **L'admin vede anche i contenuti nascosti:** `hide` su un contenuto già cancellato dal proprietario risponde 409
  `CONTENT_ALREADY_HIDDEN`, non 404. Gli eventi indie in bozza si possono nascondere.
- **`reason` di `hide`:** si tolgono gli spazi ai bordi prima di validare (3–500 caratteri); un motivo di soli spazi è
  400.
- **Elenco dei nascosti:** `HiddenContentResponse {id, author, title, hiddenAt, hiddenBy, hiddenReason, deletedByOwner}`.
  `author` è un `AuthorSummary`; `title` è il titolo, oppure per i post del feed il testo, accorciato a 100 caratteri
  con `...`. Ordine fisso `hidden_at desc, id desc`. Ogni repository ha `findByModerationHiddenAtIsNotNull` con
  l'autore caricato insieme (nessuna query per riga).
- **Un solo service per i quattro tipi**, con una vista interna `Content(author, moderation)` costruita da un `switch`
  sul tipo; non c'è un'interfaccia comune sulle entity, che restano indipendenti.

### Motivazione

- Il livello è una regola di accesso e si controlla prima di guardare lo stato: chi non può agire su un autore riceve
  sempre 403, qualunque sia lo stato del contenuto; il 404 resta solo per ciò che non esiste.
- Il converter usa i segmenti del design (sezione 5.7) senza cambiare i nomi dell'enum.
- Mostrare i nascosti all'admin gli permette di distinguere "già nascosto" da "inesistente" e di moderare ogni stato.
- Il troncamento a 100 caratteri tiene l'elenco leggero anche con post molto lunghi.
- Lo `switch` evita di toccare le entity (decisioni 41 e 43) e tiene la regola di moderazione in un punto solo.

### Alternative scartate

- **404 per un contenuto già nascosto:** confonderebbe l'admin, che deve poterlo ripristinare o capire perché non può.
- **Una `@Query` nativa con `UNION` sulle quattro tabelle per l'elenco:** il tipo è già nell'URL, quindi basta una
  query per tipo, più semplice e paginata dal database.
- **Interfaccia `Moderable` implementata dalle quattro entity:** cambierebbe classi già consegnate per risparmiare
  quattro righe in uno `switch`.
- **Lasciare che un admin moderi i propri contenuti:** la sezione 5.6 vieta di agire su se stessi.

---

## Decisione 63: scelte di implementazione delle amicizie (implementazione)

### Scelta

- **Ordine dei controlli su accetta, rifiuta e annulla (scelta dello studente):** amicizia inesistente o che non
  riguarda il chiamante = 404; poi il permesso (403 `NOT_FRIENDSHIP_ADDRESSEE` o `NOT_FRIENDSHIP_REQUESTER`); poi lo
  stato (409 `FRIEND_REQUEST_NOT_PENDING`); per l'accettazione infine il richiedente non più attivo (409
  `USER_NOT_ACTIVE`). Chi non ha il permesso riceve quindi 403 anche se la richiesta non è più in attesa. Rimuovi:
  404, poi 403 `NOT_FRIENDS` se lo stato non è `ACCEPTED`.
- **`relationsFor` tiene conto dello stato dell'altro utente (scelta dello studente, come NoseY):** se l'altro non è
  verificato e `ACTIVE`, la relazione è `UNAVAILABLE`, tranne se siete già amici (resta `FRIENDS`). Un id che non è
  un utente è `UNAVAILABLE`; chi chiede, se compare fra gli id, viene ignorato; la mappa ha una voce per ogni altro id.
  `friendshipId` è valorizzato solo per `OUTGOING`, `INCOMING` e `FRIENDS`, cioè quando serve per accettare,
  annullare o rimuovere. Una sola query: `User` con `left join` sulle amicizie dell'utente che chiede. `UNAVAILABLE`
  ha quindi due origini (rimozione subita, altro utente non disponibile) e il frontend le tratta allo stesso modo
  (niente pulsante "Aggiungi").
- **Destinatario di una richiesta:** si valuta con `UserAccessService.resolve`, che applica anche la riattivazione
  pigra delle sospensioni scadute; se non è `ACTIVE` è 404. Lo stesso controllo vale per il richiedente
  all'accettazione.
- **`closed_by` come `UUID` nell'entity**, non come relazione verso `User` (come `Moderation.hiddenBy` e
  `User.suspendedBy`): serve solo a confrontare l'id, senza caricare l'utente.
- **Stato visto nell'entity (`Friendship.viewFor`):** la tabella della sezione 6.14 sta in un solo metodo, usato da
  risposte, elenchi e `relationsFor`.
- **Annullare un rifiuto silenzioso:** la riga resta `DECLINED` e `closed_by` resta, cade solo `request_masked`;
  `updated_at` si aggiorna.
- **Elenchi:** ordine fisso `updated_at desc, id desc`; `type` mancante o sconosciuto = 400 `VALIDATION_ERROR` (lo
  gestisce già il `GlobalExceptionHandler`); i due utenti si caricano con la riga (`EntityGraph`), nessuna query per
  riga; gli utenti sospesi restano negli elenchi.
- **Limite `FRIEND_REQUESTS`:** 20 in 24 ore per utente in `application.yml`, consumato per primo, quindi conta anche
  se la richiesta poi fallisce.
- **Codici d'errore nuovi:** `CANNOT_FRIEND_SELF` (400), `FRIEND_REQUEST_ALREADY_SENT`,
  `FRIEND_REQUEST_ALREADY_RECEIVED`, `ALREADY_FRIENDS`, `FRIENDSHIP_UNAVAILABLE`, `FRIEND_REQUEST_NOT_PENDING` (409),
  `NOT_FRIENDSHIP_ADDRESSEE`, `NOT_FRIENDSHIP_REQUESTER`, `NOT_FRIENDS` (403).
- **Postman:** la cartella Friends usa `accessToken` e `fanAccessToken` come le due parti, più `userId` di Users;
  una richiesta di preparazione salva `friendUserId`. La sequenza finisce con l'amicizia rimossa da `accessToken`, che
  così può chiedere di nuovo: si può rieseguire (entro il limite di richieste).

### Motivazione

- Il permesso è una regola di accesso e si controlla prima dello stato, come nella decisione 62: chi non può agire
  non impara niente sullo stato della richiesta.
- Per `relationsFor`, copiare NoseY evita che la ricerca e la chat propongano un'amicizia con chi non può riceverla.
  L'eccezione per gli amici impedisce che una sospensione cancelli un'amicizia già esistente dalla vista.
- Il 404 per le amicizie altrui le rende indistinguibili da quelle inesistenti (sezione 6.14).
- Tenere `viewFor` nell'entity evita di ripetere la tabella degli stati in tre punti.

### Alternative scartate

- **409 prima del 403:** rivelerebbe lo stato della richiesta a chi non ha il permesso.
- **`relationsFor` solo sulla riga di amicizia:** più semplice, ma ricerca e chat dovrebbero ricontrollare lo stato
  dell'altro utente a parte.
- **Stato dell'altro utente in una seconda query:** due query invece di una; il piano chiede una sola query.
- **`closed_by` come `@ManyToOne` verso `User`:** un proxy in più per un confronto di id.
- **Rifiutare le richieste incrociate simultanee con un controllo applicativo:** il vincolo `uq_friendships_pair` le
  rende già un 409 `CONFLICT`, senza codice in più.

## Decisione 64: scelte di implementazione della ricerca utenti (implementazione)

### Scelta

- **`escapeLike` diventa `common.LikePattern.escape` (scelta dello studente):** la regola che rende letterali `\`, `%`
  e `_` sta in una classe condivisa; `AdminUserService` la usa al posto del suo metodo, la ricerca utenti la usa per
  `q`. Il comportamento dell'elenco admin non cambia.
- **Limite `USER_SEARCH` consumato prima di validare `q` (scelta dello studente):** 30 al minuto per utente, chiave
  l'id di chi cerca. Come `FRIEND_REQUESTS`, conta anche una richiesta che poi risulta non valida (400): il 31º
  tentativo in un minuto è un 429 anche se `q` è sbagliato.
- **Validazione di `q` nel service:** dopo il trim deve avere 2-50 caratteri, altrimenti 400 `VALIDATION_ERROR` con
  `fields.q`; `q` assente è un 400 dello stesso codice (parametro obbligatorio). Non usa le annotazioni di Bean
  Validation perché il trim va fatto prima del conteggio e il limite va consumato prima di tutto.
- **Query nel repository degli utenti:** `UserRepository.searchByDisplayName` in JPQL con `lower(displayName) like
  lower(:pattern) escape '\'`, email verificata, stato passato come parametro (`ACTIVE`; un letterale enum non si
  converte nel tipo di PostgreSQL), esclusi `me`, ordine `lower(displayName), id` scritto nella query (il `Pageable`
  porta solo pagina e dimensione), con `countQuery` esplicita. L'utente con sospensione scaduta compare solo dopo la
  riattivazione pigra, come da design.
- **Stato dell'amicizia:** una sola chiamata a `FriendshipService.relationsFor` per pagina. `UserSearchResult` =
  `{id, displayName, avatarUrl, city, friendship: {status, friendshipId}}` (`FriendshipSummary`); nessun altro campo,
  quindi mai email, coordinate o ruoli. Un risultato `UNAVAILABLE` (amicizia rimossa dall'altro) compare comunque
  nell'elenco, senza `friendshipId`.
- **Sicurezza:** `GET /api/users/search` è `authenticated()` in `SecurityConfig`, nella stessa regola di `/api/users/me`
  e prima di quella pubblica di `GET /api/users/{id}`, che resta pubblico.

### Motivazione

- Una sola copia dell'escape evita che la correzione di un buco in una ricerca lasci aperta l'altra.
- Contare anche le richieste non valide impedisce di aggirare il limite con richieste che costano poco ma restano
  richieste; il costo (budget consumato da un frontend che cerca con una lettera) si evita con un'attesa prima di
  cercare.
- Ordine e paginazione nella query evitano che un `Sort` su un'espressione (`lower(...)`) debba passare dal
  `Pageable`.

### Alternative scartate

- **Copia di `escapeLike` in `friendship`:** due copie della stessa regola di sicurezza da tenere allineate.
- **Rendere pubblico `escapeLike` di `AdminUserService`:** `friendship` dipenderebbe dal package `admin`.
- **Consumare il limite dopo la validazione:** le richieste non valide non sarebbero limitate.
- **`@Size` su `q` con Bean Validation:** non applica il trim prima del conteggio e valida prima che il limite sia
  consumato.

## Decisione 65: scelte di implementazione del WebSocket e della chiusura delle sessioni (implementazione)

### Scelta

- **Errori senza informazioni inutili (scelta dello studente):** al CONNECT, un token mancante, malformato o scaduto,
  un utente inesistente e un utente con email non verificata ricevono tutti `TOKEN_INVALID` con lo stesso messaggio
  generico ("Token mancante, scaduto o non valido"). Solo un utente sospeso con token valido riceve
  `ACCOUNT_SUSPENDED`, come da design (sezioni 7.2 e 7.8), senza motivo né scadenza della sospensione.
- **`ACCESS_DENIED` sul WebSocket non ripete la destinazione:** SEND o SUBSCRIBE non ammessi ricevono
  `ACCESS_DENIED` con il messaggio fisso "Operazione non consentita". Nessun eco di destinazioni o identificativi
  chiesti dal client.
- **Eccezioni inattese:** sia `StompErrorHandler` (frame ERROR) sia `WebSocketExceptionHandler` (code degli errori)
  rispondono `INTERNAL_ERROR` con "Errore interno del server"; il dettaglio resta solo nel log.
- **Frame prima del CONNECT:** Spring rifiuta un SEND o una SUBSCRIBE di una sessione senza CONNECT con
  un'`IllegalStateException` ("Unknown session"), prima dell'interceptor. `StompErrorHandler` la traduce in
  `TOKEN_INVALID` (sezione 7.3) invece di `INTERNAL_ERROR`, e non la scrive nel log come errore. La traduzione
  riconosce l'inizio del messaggio di Spring: il test `sendBeforeConnect_isRejectedWithTokenInvalid` segnala un
  cambiamento dopo un aggiornamento. Il controllo sull'utente assente nell'interceptor resta come difesa.
- **Registro delle sessioni:** `WebSocketSessionRegistry` conserva le `WebSocketSession` con un decorator
  dell'handler (registrato in `configureWebSocketTransport`) e associa sessione e utente con `SessionConnectedEvent`;
  `SessionDisconnectEvent` e la chiusura della connessione la tolgono. `closeAll(userId)` chiude con
  `POLICY_VIOLATION`; una chiusura fallita viene registrata nel log e non ferma le altre.
- **Chiusura con pausa di 500 ms:** `UserSuspendedSessionCloser` (AFTER_COMMIT) manda `ACCOUNT_SUSPENDED` su
  `/user/queue/errors` e chiude le sessioni dopo 500 ms (`CompletableFuture.delayedExecutor`). L'invio passa da canali
  asincroni: una chiusura immediata farebbe perdere l'avviso al client. Se l'utente non ha sessioni aperte non
  succede nulla.
- **`ErrorCode.TOKEN_INVALID` senza stato HTTP** (solo WebSocket, come da piano): `httpStatus()` è `null`; nessun
  endpoint REST lo usa.
- **Test:** `StompTestClient` (in `support`) apre le connessioni su porta casuale e raccoglie frame ERROR e messaggi
  in code bloccanti; `StompTestController` (`@TestComponent`, importato solo dai test del WebSocket) espone
  `/app/test/echo`, `/denied` e `/boom` per provare che un SEND ammesso arriva a un controller e che i suoi errori
  passano dal gestore. Le classi di test estendono `IntegrationTest` con `RANDOM_PORT`.

### Motivazione

- Chi non ha un token valido non deve poter distinguere "l'account non esiste" da "l'email non è verificata" da
  "il token è scaduto", né scoprire quali code esistono: meno informazioni, meno superficie per chi esplora il
  sistema.
- `ACCOUNT_SUSPENDED` resta distinto perché il frontend deve mostrare "account sospeso" e non "sessione scaduta", e
  lo vede solo chi ha un token valido di quell'account.
- Un SEND senza CONNECT fatto dopo un attacco o per errore non deve riempire il log di errori né rispondere "errore
  interno": è un token mancante.

### Alternative scartate

- **`EMAIL_NOT_VERIFIED` per l'email non verificata:** più preciso per la UI ma rivela lo stato dell'account a chi
  ha un token; un utente non verificato non può comunque fare il login.
- **Messaggio di `ACCESS_DENIED` con la destinazione (come NoseY):** fa da eco su code e identificativi.
- **Chiusura immediata delle sessioni:** l'avviso `ACCOUNT_SUSPENDED` non arriverebbe in modo affidabile.
- **Scheduler di Spring per il ritardo:** con il WebSocket attivo i `TaskScheduler` sono più d'uno e l'iniezione per
  tipo è ambigua; `delayedExecutor` non richiede bean.
- **`@Controller` annidato in una `@TestConfiguration` per il controller di prova:** Spring registra le classi
  annidate due volte (mapping ambiguo); una classe a sé con `@TestComponent` non viene scansionata dagli altri test.

## Decisione 66: scelte di implementazione della chat (implementazione)

### Scelta

- **`NEW_MESSAGE` resta a F5-03 (scelta dello studente):** `ChatService.send` pubblica solo `ChatMessageEvent`
  (consegna del messaggio a mittente e destinatario). La notifica `NEW_MESSAGE` della sezione 7.5, passo 6, la aggiunge
  F5-03 insieme a `LiveNotificationEvent`, come già previsto dal suo sotto-task 1.
- **Ordine dei controlli in `POST /api/chats` (scelta dello studente):** se stessi 400 `CANNOT_MESSAGE_SELF`; se la
  coppia ha già una conversazione la si restituisce senza altri controlli e senza toccare il limite; per una
  conversazione nuova: destinatario inesistente, non verificato o sospeso 404, non amici 403 `NOT_FRIENDS`, solo alla fine
  il limite `CONVERSATIONS_CREATED` e la creazione. I rifiuti non consumano le 20 creazioni al giorno.
- **Un membro sospeso blocca la scrittura (scelta dello studente, regola nuova rispetto alla sezione 6.9):** `canSend`
  è falso se uno dei due membri non è attivo (una sospensione scaduta conta come attivo, come nella riattivazione
  pigra), anche fra amici o con uno sblocco aperto. L'invio risponde `CHAT_LOCKED` con il testo neutro "Al momento non
  puoi inviare messaggi a questo utente": non dice che l'altro è sospeso. Lista e storico restano leggibili, e una
  conversazione già esistente con un sospeso si restituisce comunque.
- **Coppia canonica ordinata come stringhe:** `ck_chat_conversations_order` confronta gli uuid byte per byte senza
  segno, mentre `UUID.compareTo` di Java è con segno; l'applicazione ordina quindi le stringhe esadecimali minuscole
  (larghezza fissa, stesso ordine di PostgreSQL). Con `compareTo` una coppia con un id che inizia per 8-f violerebbe
  il vincolo.
- **Creazione concorrente:** `INSERT ... ON CONFLICT DO NOTHING` sulla coppia canonica e rilettura; due `POST`
  contemporanei danno la stessa conversazione. Il limite è consumato prima dell'inserimento: due richieste
  concorrenti per la stessa coppia nuova possono consumarne due, un caso trascurabile.
- **`ChatService.canSend(conversation)` senza `me`:** controlla entrambi i membri, quindi vale per l'invio e per la
  lista. Per la lista il calcolo è per pagina con due query più i due utenti già caricati (`relationsFor` per le
  amicizie, una query per gli sblocchi aperti); per il singolo invio sono `areFriends`, la query con i tre `EXISTS` e
  due `resolve`.
- **`ChatUnlock` è un'entity di sola lettura:** le righe si creano solo con `insertIfAbsent` nativo (`ON CONFLICT DO
  NOTHING`, enum con `cast`), mai con `save`; l'entity serve a `ddl-auto: validate`.
- **`sent_at` dall'orologio dell'applicazione:** non dal `DEFAULT now()`, così i test controllano l'ordine dei messaggi
  e la finestra di `CHAT_MESSAGES` con lo stesso `Clock`.
- **Cursore:** `before` è l'id del messaggio più vecchio già caricato; se non appartiene alla conversazione 404
  `NOT_FOUND`. Il confronto su `(sent_at, id)` legge il cursore dal database nella stessa query. `size` 1-100
  (default 30) con `@Min`/`@Max` sul parametro: fuori range 400 `VALIDATION_ERROR`.
- **Errori di appartenenza:** conversazione inesistente 404; esistente ma non membro 403 `NOT_CONVERSATION_MEMBER`
  (come da sezione 6.9) per storico, lettura e invio; nell'invio il controllo viene prima del permesso (sezione 7.5).
- **Interfaccia per F5-03 e F5-04:** `findOrCreateConversation(a, b)`, `unlock(...)` e `appendMessage(...)`
  sono pubblici; `appendMessage` aggiorna `last_message_at` ma non pubblica eventi né controlla il permesso: chi lo
  chiama pubblica `ChatMessageEvent` nella stessa transazione. Da F7-02 (ottimizzazione O3, decisione 75) candidature
  e contatti non lo fanno più a mano: `sendUnlockedMessage(senderId, recipientId, source, sourceId, body)` esegue
  nello stesso metodo transazionale conversazione, sblocco, messaggio e `ChatMessageEvent`, e restituisce il messaggio
  salvato; `appendMessage` resta pubblico e senza eventi, perché `send` lo usa con i propri controlli.

### Motivazione

- Un messaggio a un sospeso non verrebbe letto né consegnato (le sue sessioni sono chiuse); bloccarlo con un testo
  neutro avvisa chi scrive senza rivelare un dato di moderazione, in linea con il rifiuto silenzioso delle amicizie.
- Contare il limite solo quando la creazione sta per avvenire evita che chi prova con non amici esaurisca le
  creazioni; le conversazioni esistenti sono una lettura.
- Una sola regola di scrittura per invio e lista evita che il frontend mostri il campo di testo e l'invio fallisca
  (o il contrario).

### Alternative scartate

- **Motivo esplicito ("account sospeso") a chi scrive:** più chiaro, ma rivela la moderazione a chiunque abbia una
  chat con quell'utente.
- **Nessun blocco verso i sospesi:** i messaggi resterebbero in attesa senza avviso.
- **Limite consumato prima di ogni controllo:** più semplice, ma ogni tentativo con un non amico brucerebbe una
  creazione.
- **Creare ora una versione minima di `LiveNotificationEvent`:** anticiperebbe lavoro di F5-03.
- **`UUID.compareTo` per la coppia canonica:** discorde dal confronto di PostgreSQL.


## Decisione 67: scelte di implementazione delle notifiche live e delle candidature (implementazione)

### Scelta

- **Messaggio di candidatura da 1 a 1800 caratteri (scelta dello studente, scostamento dalla sezione 6.7):** il
  testo salvato in chat è `Candidatura per «<titolo>»:` + a capo + messaggio. Il titolo può avere 150 caratteri e
  `chat_messages.body` ne accetta 2000: con 2000 di messaggio il totale li supererebbe e il database darebbe 500.
  Con 1800 il totale resta sempre sotto 2000 (150 + circa 22 di prefisso + 1800). Oltre 1800: 400
  `VALIDATION_ERROR` con il campo `message`.
- **Autore non attivo = annuncio inesistente (scelta dello studente):** se l'autore dell'annuncio è sospeso o non
  verificato, la candidatura risponde 404 `NOT_FOUND` "Annuncio non trovato", come per il destinatario di
  `POST /api/chats` (decisione 66): non si crea nessun messaggio e la sospensione non si rivela.
- **Ordine dei controlli della candidatura:** annuncio non nascosto (404), autore attivo (404), annuncio aperto (409
  `COLLAB_CLOSED`), autore diverso dal candidato (400 `CANNOT_APPLY_OWN_POST`) e solo alla fine il limite
  `COLLAB_APPLICATIONS`: i rifiuti non consumano le 10 candidature al giorno.
- **Nessun controllo sul ruolo del candidato:** basta essere autenticati, come da sezione 6.7.
- **Notifiche con `preview` solo per `NEW_MESSAGE`:** `NEW_LIKE` e `COLLAB_APPLICATION` hanno `preview` nullo; il
  testo della candidatura arriva già come messaggio su `/user/queue/messages`. L'anteprima è tagliata a 100 punti di
  codice, non a 100 unità UTF-16, così una emoji non viene spezzata.
- **`createdAt` della notifica dall'orologio dell'applicazione:** per `NEW_MESSAGE` e `COLLAB_APPLICATION` è il
  `sent_at` del messaggio, per `NEW_LIKE` l'istante del like (`Clock`).
- **`FeedService.like` carica il post con l'autore** (prima solo `exists`) per conoscere il destinatario; l'utente che
  mette like si carica solo se l'inserimento è effettivo e l'autore è un altro.
- **Test del rollback con un listener sincrono:** un bean di prova con `@EventListener` (che gira dentro la
  transazione) fa fallire `FeedService.like` dopo la pubblicazione dell'evento; il test verifica che nessuna
  notifica parta entro 2 secondi e che il like non sia stato salvato.
- **`ChatTestSupport` pubblica:** i test di `collab` e `notification` ne riusano gli helper (utenti, amicizie,
  annunci inseriti nel database).

### Motivazione

- Il limite a 1800 evita una migrazione solo per le candidature e dà un errore chiaro invece di un 500; 1800
  caratteri restano più che sufficienti per una presentazione.
- Trattare l'autore sospeso come un annuncio inesistente è coerente con la chat e non crea messaggi che nessuno può
  leggere né risolvere (la conversazione avrebbe `canSend` falso).
- Contare il limite solo a controlli superati evita che i tentativi su annunci chiusi esauriscano le candidature.

### Alternative scartate

- **Migrazione V10 con `body` più lungo:** tocca uno schema già approvato per un caso limite.
- **Tagliare il titolo nel prefisso:** con messaggio di 2000 non resta spazio e il testo verrebbe tagliato.
- **Nessun controllo sull'autore sospeso:** la candidatura passerebbe e il messaggio resterebbe in una conversazione
  bloccata.
- **`preview` anche per le candidature (titolo dell'annuncio):** non previsto dal design; il frontend ha già
  `targetId` per aprire l'annuncio.

## Decisione 68: scalabilità predisposta, non realizzata (progettazione, sezioni 12.8 e 15)

### Scelta

L'applicazione è **predisposta alla scalabilità, ma non scalata**: l'MVP gira su una sola istanza e regge i volumi
della demo; le scelte di design non chiudono la strada a una crescita, ma nessun componente per il carico elevato
viene costruito ora.

Già predisposto:

- **API REST stateless** (JWT, nessuna sessione sul server): più istanze dietro un load balancer funzionerebbero.
- **Database:** indici mirati sulle query frequenti (parziali per i contenuti visibili, `(created_at DESC, id DESC)`
  per l'ordinamento senza sort in memoria, bounding box su `(latitude, longitude)`, cursore della chat).
- **Query controllate:** paginazione uniforme (default 20, massimo 100), filtro per raggio e paginazione nel database,
  ruoli letti con una query per pagina.
- **Chat:** storico a cursore, perché è la tabella che cresce di più.
- **Email:** `@Async` dopo il commit, l'invio a Brevo non rallenta le richieste.
- **Portabilità:** configurazione solo da variabili d'ambiente e immagine Docker unica (sezione 12.8).

Rimandato (fuori dall'MVP, da progettare solo se serve):

- broker STOMP esterno e limiti di frequenza condivisi: sessioni WebSocket, simple broker e rate limit stanno in
  memoria di una sola istanza;
- paginazione a cursore sul feed (oggi a offset, con il limite noto dello spostamento dei post);
- indice `pg_trgm` per la ricerca utenti (oggi `ILIKE` senza indice);
- coda persistente per le email (le `@Async` in corso si perdono se l'app si riavvia).

Limiti dei servizi esterni, che nessuna scelta di codice rimuove:

- **Render (piano gratuito):** il servizio si sospende dopo l'inattività e la prima richiesta è lenta (con il servizio
  unico si sospende anche il frontend); il database gratuito ha una scadenza dopo la creazione.
- **Brevo (piano gratuito):** quota giornaliera di email; oltre la quota l'invio fallisce senza bloccare l'azione
  dell'utente.

### Motivazione

- Il brief non chiede un carico elevato e il tempo disponibile è fissato: costruire broker esterno, cache o code
  porterebbe complessità senza essere verificabile sul piano gratuito.
- Le scelte a basso costo (stateless, indici, paginazione, configurazione da ambiente) sono già state prese e
  rendono la crescita possibile senza riscrivere il codice.
- Dichiarare i limiti rende onesta la documentazione: l'MVP non viene presentato come scalabile oltre ciò che è.

### Alternative scartate

- **Broker esterno (RabbitMQ o Redis) subito:** non esiste sul piano gratuito di Render e la demo gira su una sola
  istanza.
- **Cache applicativa:** i volumi dell'MVP non la giustificano e introdurrebbe problemi di invalidazione.
- **Nessuna dichiarazione:** la domanda sulla scalabilità resterebbe senza risposta documentata.

## Decisione 69: scelte di implementazione del contatto degli eventi (implementazione)

### Scelta

- **Messaggio di contatto da 1 a 1800 caratteri (scelta dello studente, scostamento dalla sezione 6.6):** il testo
  salvato è `Contatto per «<titolo>»:` + a capo + messaggio. Come per le candidature (decisione 67), con 2000 di
  messaggio e un titolo di 150 il totale supererebbe i 2000 di `chat_messages.body` e il database darebbe 500. Oltre
  1800: 400 `VALIDATION_ERROR` con il campo `message`.
- **Organizzatore non attivo = evento inesistente (scelta dello studente):** se l'organizzatore è sospeso o non
  verificato, il contatto risponde 404 `NOT_FOUND` con lo stesso messaggio dell'evento nascosto («Concerto non
  trovato» o «Evento non trovato»), come per le candidature (decisione 67) e per `POST /api/chats` (decisione 66): la
  sospensione non si rivela e non si crea un messaggio in una conversazione bloccata.
- **`EventContactService` condiviso (scelta dello studente):** la logica comune ai due contatti sta in un service
  nuovo del package `event`; `OfficialConcertService.contact` e `IndieEventService.contact` fanno solo i controlli
  di visibilità (404) e gli passano un `Target` (origine dello sblocco, id, titolo, organizzatore, data). Scostamento
  dalla lista file del piano, che nominava solo i due service.
- **Ordine dei controlli:** evento non nascosto, pubblicato se indie, con organizzatore attivo (404), non ancora
  iniziato (409 `EVENT_CLOSED`), organizzatore diverso dal chiamante (400 `CANNOT_CONTACT_OWN_EVENT`) e solo alla fine
  il limite `EVENT_CONTACTS`: i rifiuti non lo consumano. Un proprio evento già iniziato dà quindi 409, non 400.
- **Solo indie event `PUBLISHED`, anche per il proprietario:** una bozza è un 404 per tutti, perché non è ancora un
  evento da contattare; il 404 viene prima del 400 anche sul proprio evento.
- **Evento aperto fino all'istante di inizio escluso:** `event_date > now` (dal `Clock`), lo stesso confronto che
  apre lo sblocco in `canSend` (sezione 6.9), così contatto e permesso di scrittura non divergono.
- **Parte finale in `ChatService` (F7-02, ottimizzazione O3):** dopo i controlli e il limite, `contact` chiama
  `ChatService.sendUnlockedMessage`, che salva il messaggio e pubblica `ChatMessageEvent`; la notifica `NEW_MESSAGE`
  resta in `contact`. L'ordine dei controlli non cambia, e la regola «chi aggiunge un messaggio pubblica
  `ChatMessageEvent` nella stessa transazione» (decisione 66) sta in un punto solo.
- **`NEW_MESSAGE` all'organizzatore:** a differenza della candidatura (che ha `COLLAB_APPLICATION`) il contatto non ha
  un tipo suo; si invia `NEW_MESSAGE` con `targetId` la conversazione e `preview` dei primi 100 caratteri del testo
  salvato, prefisso compreso. `ChatService.preview` è diventato pubblico per riusarlo.
- **Limite `EVENT_CONTACTS` unico:** 10 in 24 ore per utente, condiviso fra concerti e indie event (chiave: id
  dell'utente), in `app.rate-limits.event-contacts`.
- **Nessun controllo sul ruolo del chiamante:** basta essere autenticati, come da sezione 6.6.

### Motivazione

- Il limite a 1800 dà un errore chiaro invece di un 500 e non richiede una migrazione; resta più che sufficiente per
  presentarsi a un organizzatore.
- Trattare l'organizzatore sospeso come un evento inesistente è coerente con chat e candidature e impedisce messaggi
  che nessuno può leggere né risolvere (`canSend` sarebbe falso).
- Un service solo per le regole comuni evita di copiare due volte i controlli di accesso: una differenza fra
  concerti e indie event sarebbe difficile da notare.
- Confrontare con lo stesso `event_date > now` dello sblocco evita un contatto accettato su un evento per cui la chat
  sarebbe già bloccata.

### Alternative scartate

- **Messaggio fino a 2000 con prefisso tagliato:** il titolo nel messaggio salvato non sarebbe più quello reale.
- **Messaggio fino a 2000 con rifiuto solo se il totale sfora:** errore poco prevedibile, che compare solo con titoli
  lunghi.
- **Organizzatore sospeso ammesso:** il contatto riuscirebbe, ma la chat sarebbe subito `CHAT_LOCKED` e la sospensione
  si intuirebbe.
- **Logica duplicata nei due service:** una quindicina di righe ripetute, con il rischio che le regole divergano.
- **Un tipo di notifica nuovo per il contatto:** non previsto dalla sezione 7.4; `NEW_MESSAGE` basta al frontend per
  aprire la conversazione.

## Decisione 70: hardening della sicurezza (implementazione)

### Scelta

- **Header di risposta (scelta dello studente):** restano quelli predefiniti di Spring Security (`X-Content-Type-Options`,
  `X-Frame-Options: DENY`, `Cache-Control`, HSTS sulle richieste https) e in `SecurityConfig` si aggiungono
  `Referrer-Policy: no-referrer` e `Permissions-Policy: geolocation=(self), camera=(), microphone=()`. La
  geolocalizzazione del sito stesso resta ammessa perché il frontend la usa per gli eventi vicini. Il test
  `SecurityHeadersIntegrationTest` li verifica su risposte di successo, 401 e 404.
- **Email del primo SUPERADMIN nel log di avvio (scelta dello studente):** `SuperadminBootstrap` continua a scrivere
  l'email (mai la password), perché su Render serve a verificare il bootstrap. Va mascherata a fine MVP completo
  (backend e frontend), dopo i test finali. Mascherare riguarda solo il log: database ed elenco admin
  (`GET /api/admin/users`) mostrano le email intere.
- **Matrice di accesso (test in più rispetto al piano):** `AccessMatrixIntegrationTest` legge dagli handler mappati
  tutti gli endpoint `/api/**` e verifica che senza token rispondano 401 tutti tranne quelli dell'elenco pubblico
  della sezione 6.3 (che a sua volta deve contenere solo endpoint esistenti). Un endpoint nuovo dimenticato in
  `SecurityConfig` o nell'elenco fa fallire il test.
- **Prove di mutazione (scelta dello studente: circa 8, ne sono state fatte 11):** ruolo HOST sui concerti,
  proprietà di un post, contenuti nascosti, utente sospeso nel filtro JWT, chat bloccata, risposta alle amicizie solo
  del destinatario, contatto di un evento iniziato, riuso del refresh token, header CSRF del refresh, area admin e
  ricerca utenti pubblica. Ognuna è stata intercettata da test con nome: nessun test aggiunto per questo motivo.
- **Postman eseguita solo in locale (scelta dello studente):** 143 richieste su 143 senza errori, su un database di
  prova separato, con un backend avviato da uno script di appoggio non versionato. La prova con l'environment
  `render` è nel sotto-task 2 di F6-03. Corretto un errore della collection: «Verify con codice sbagliato (400)»
  stava dopo «Verify (200)» e a email già verificata risponde 409; ora è prima.
- **Revisione del codice:** nessuna correzione necessaria su endpoint pubblici (coincidono con la sezione 6.3), log
  (nessuna password, token o codice in produzione; il codice di verifica è scritto solo da `LogEmailService`, profilo
  `!prod`), query native (solo parametri legati; le concatenazioni riguardano costanti SQL) e `@Valid` (presente su
  tutti i body REST; il body STOMP è validato a mano nel service).
- **Copertura della tabella 11.2:** tutte le righe hanno test, tranne il fallback SPA, che nasce in F6-03.

### Motivazione

- Gli header predefiniti proteggono già da clickjacking e sniffing del tipo di file, ma nessun test lo garantiva: un
  test li blocca contro una disattivazione accidentale. Referrer-Policy e Permissions-Policy riducono ciò che il
  browser rivela o consente senza costi.
- Tenere l'email nel log per ora evita di perdere un'informazione utile mentre si fa debug; il momento giusto per
  oscurarla è dopo i test finali.
- La matrice di accesso protegge dalla dimenticanza più probabile (un endpoint nuovo senza regola) senza dover
  scrivere un test per ogni endpoint.
- Le mutazioni mostrano che i test falliscono davvero quando un controllo viene tolto, non solo che passano.

### Alternative scartate

- **Solo i default, senza header extra:** nessuna difesa in più per il referrer e i permessi del browser.
- **Mascherare subito l'email nel log, o toglierla:** meno comodo per verificare il bootstrap su Render.
- **Un test per ogni endpoint per le regole di accesso:** già coperti dai test di ogni card; la matrice evita di
  duplicarli.
- **Eseguire Postman anche su Render adesso:** l'istanza non è ancora quella definitiva; si fa in F6-03.
- **Rendere la collection autonoma (utenti creati dalla collection):** i codici email arrivano solo nel log in
  sviluppo, quindi non funzionerebbe su Render.

## Decisione 71: fase 7 di valutazione dell'ottimizzazione, condizionata (progettazione, sezione 14)

### Scelta

- **Fase 7 come ultima fase, solo di valutazione (scelta dello studente):** una card, F7-01, che produce
  `docs/ottimizzazione.md` con proposte per alleggerire o riorganizzare il backend, senza modificare codice.
- **Condizionata:** parte solo dopo F6-03 e solo se resta tempo; il frontend ha la precedenza dal 20 ottobre. Se
  manca tempo si salta senza conseguenze sulle funzionalità.
- **Criteri per le proposte:** non cambiano il comportamento osservabile, sono coperte da test già esistenti e
  hanno un beneficio concreto (meno duplicazione o complessità, o un punto lento misurato). Il codice solido anche
  se più pesante, soprattutto concorrenza e sicurezza, non si tocca.
- **Poi si decide:** le card di realizzazione (F7-02 e seguenti) nascono solo dopo la scelta dello studente; la
  fase può anche concludersi con la decisione di non procedere.

### Motivazione

- Il brainstorming è solo analisi: non sposta il calendario del 25 ottobre e non rischia regressioni.
- Con 813 test e la collection Postman le proposte si possono verificare senza cambiare le funzioni.
- Separare la valutazione dalla realizzazione evita refactor a intuito, vietati fuori dalla fase da `CLAUDE.md`.

### Alternative scartate

- **Voce Post-V1 dopo la consegna:** valida, ma lo studente preferisce valutare subito se c'è tempo.
- **Card F6-04 in coda alla fase 6:** mescola ottimizzazione e rilascio e ruba tempo al frontend.
- **Fase 7 di realizzazione già pianificata:** prematura senza un elenco di proposte misurate.
- **Non aggiungerla:** il backend resterebbe senza una verifica esplicita delle parti alleggeribili.

## Decisione 72: springdoc-openapi 3.1.1 con documentazione pubblica (F6-02, decisione 5)

### Scelta

- Dipendenza `springdoc-openapi-starter-webmvc-ui` **3.1.1** (ultima della serie 3.x, la serie per Spring Boot 4;
  compilata contro Boot 4.1.0, quindi compatibile con il 4.1.1 del progetto). La versione sta nella proprietà
  `springdoc.version` del `pom.xml`, perché il BOM di Spring Boot non la gestisce.
- `OpenApiConfig` dichiara titolo, descrizione e lo schema `bearerAuth` (HTTP Bearer JWT) come requisito globale.
- Percorsi pubblici solo in `GET`: `/v3/api-docs/**`, `/swagger-ui/**`, `/swagger-ui.html`, elencati in
  `SecurityConfig`. Restano attivi in tutti i profili, produzione compresa.
- Nessuna annotazione `@Operation` o `@Schema` sul codice: la descrizione è quella dedotta da controller e DTO.
- Pubblica anche in produzione: confermato dallo studente fra tre opzioni (pubblica ovunque, spenta in `prod`,
  solo ADMIN); la scelta si può rivedere a fine backend.

### Motivazione

- La serie 2.x di springdoc è per Spring Boot 3 e non funziona con Spring Framework 7.
- La documentazione descrive la forma delle API, non contiene dati; chi sviluppa il frontend la consulta anche da
  Render senza login. Gli endpoint protetti restano protetti: il pulsante "Authorize" invia il Bearer.
- Il requisito Bearer globale non rende privati gli endpoint pubblici: il filtro ignora un token assente o non
  valido (sezione 8.2).
- Le annotazioni su ogni metodo gonfierebbero i controller e costerebbero tempo fuori dal perimetro della card.

### Alternative scartate

- **Swagger UI solo in dev:** il frontend e la demo usano Render, dove la documentazione serve.
- **Documentazione dietro login ADMIN:** complica l'uso da Swagger UI e non protegge dati.
- **springdoc 2.x:** incompatibile con Spring Boot 4.
- **Annotare ogni endpoint:** documentazione più ricca ma costosa; la collection Postman resta il riferimento d'uso.

## Decisione 73: due diagrammi per lo schema, panoramica e dettaglio (progettazione, sezione 3.7)

### Scelta

- In `docs/schema-db.md`, sezione "Relazioni": un **flowchart di panoramica** (`flowchart TB`, linee a gradini)
  con solo i nomi delle tabelle, `users` in alto e le altre raggruppate per area (autenticazione, eventi, social,
  chat), e sulle frecce la cardinalità (1:N, N:N).
- Sotto, l'**erDiagram di dettaglio** con colonne, PK/FK e cardinalità, diviso in quattro diagrammi per area;
  `USERS` si ripete in ciascuno (completa nel primo, solo con la chiave negli altri).
- In fondo resta l'**ER completo**: l'erDiagram unico con tutte le tabelle, come prima, per chi vuole la vista
  d'insieme anche se le linee si incrociano.
- A ogni migrazione che cambia lo schema si aggiornano tutti e tre (regola in `CLAUDE.md` e progettazione, 3.7).
  Nessun test li confronta con le migrazioni: `ddl-auto: validate` copre già entity e schema, e un controllo
  sul testo Mermaid costerebbe più della sua utilità.

### Motivazione

- Con 13 tabelle quasi tutte legate a `users`, il layout automatico dell'erDiagram incrocia le linee attorno
  alla tabella centrale e il quadro d'insieme si perde.
- Il flowchart dà la struttura a colpo d'occhio; l'erDiagram resta il riferimento per i dettagli, senza ripeterli.

### Alternative scartate

- **Solo l'erDiagram completo:** è il caso poco leggibile descritto sopra; per questo è affiancato, non sostituito.
- **Solo la panoramica:** perde colonne e chiavi, che servono per verificare le migrazioni.
- **Test che confronta i diagrammi con lo schema:** fragile e di poco valore, vedi sopra.

## Decisione 74: fallback SPA, cache e verifica del rilascio finale (F6-03, decisione 1, progettazione, sezioni 6.3 e 12.5)

### Scelta

- **Un solo handler `/**`:** `spring.web.resources.add-mappings: false` e `SpaResourceConfig` registra due handler:
  `/assets/**` (da `classpath:/static/assets/`, senza fallback) e `/**` (da `classpath:/static/`, con un resolver
  che per un percorso senza estensione, fuori da `/api` e `/ws`, restituisce `index.html`).
- **Cache:** `/assets/**` con `max-age=31536000, public, immutable` (Vite mette l'hash nel nome dei file);
  tutto il resto, `index.html` compreso, `no-cache`.
- **Sicurezza:** una regola in `SecurityConfig` rende pubblici i soli `GET` fuori da `/api` e `/ws`, dopo le
  regole dell'API. Solo `GET`: `HEAD` e `OPTIONS` fuori da `/api` restano protetti. Un `POST /qualcosa` risponde 401.
- **Un file con estensione mancante** (es. `/assets/mancante.js`) e un `/api/...` inesistente rispondono 404 JSON
  `NOT_FOUND`, mai `index.html`. La pagina iniziale `/` la gestisce il welcome page di Spring Boot (forward a `index.html`).
- **Verifica su Render:** cookie di refresh e WebSocket si provano dalla console del browser aperto sulla stessa
  origine (snippet nel README). La pagina `tools/stomp-test/` resta per lo sviluppo locale: su Render non è
  ammessa nessuna origine esterna.

### Motivazione

- Con `add-mappings` attivo, Boot registra a sua volta un handler `/**` e il fallback dipenderebbe dall'ordine
  dei configurer; così il comportamento è deterministico. Si perdono solo i `/webjars/**` di Boot, che non si usano
  (Swagger UI registra i suoi handler).
- Un nome con hash non cambia mai contenuto: un anno di cache è sicuro, mentre `index.html` rivalidato a ogni
  apertura carica subito i nuovi file dopo un deploy.
- Il browser carica pagine e file solo con `GET`; ogni altro metodo passa dall'API, che ha le sue regole.
- La prova nella console usa la stessa origine che avrà il frontend, senza toccare la configurazione di produzione.

### Alternative scartate

- **Lasciare attivo il mapping di Boot:** due registrazioni di `/**`, con il fallback non garantito.
- **Cache di 30 giorni senza `immutable`:** più richieste di rivalidazione, senza vantaggio con i nomi con hash.
- **`GET` e `HEAD` pubblici:** estensione di sezione 6.3 non richiesta dal frontend.
- **Aprire `ALLOWED_ORIGIN` su Render per usare la pagina STOMP:** cambia la configurazione di produzione e non prova la stessa origine.
- **Pagina di prova nuova in `tools/`, cartella Postman "Demo", anticipo di FE-01:** file e lavoro fuori dalla card.

## Decisione 75: realizzazione delle proposte di ottimizzazione in F7-02 (F7-01, decisione 71)

### Scelta

- **Metodo di F7-01:** prima una revisione di tutto `src/main`, delle migrazioni e della configurazione, fatta senza
  leggere decisioni, progettazione e test (30 segnalazioni); poi il filtro dei tre criteri della decisione 71 e delle
  decisioni già prese. Le query sospette sono misurate con `EXPLAIN (ANALYZE, BUFFERS)` su un database separato nel
  container di sviluppo, con volumi sintetici circa cento volte la demo, eliminato alla fine. Esito in
  `docs/ottimizzazione.md`: cinque proposte ammesse (O1–O5) e l'elenco motivato di ciò che non si tocca.
- **Realizzazione (scelta dello studente, 18 ottobre):** tutte e cinque le proposte in una sola card, F7-02, il 19
  ottobre, prima del frontend. Ordine: O1, O2, O4, O5 e per ultima O3, la più delicata (ordine degli eventi nella
  transazione) e la prima da tagliare se il tempo stringe.
- **Nessun test nuovo o modificato:** la copertura è quella indicata per ogni proposta. Se un test fallisce, la
  proposta cambia il comportamento e si ritira; il test non si adatta.
- **Confronto prima e dopo (scelta dello studente):** la collection Postman si esegue in locale sul codice non ancora
  modificato e di nuovo a fine card, e gli esiti devono coincidere. Su O1 e O3, le due proposte più delicate, una
  prova di copertura: la nuova versione rotta apposta deve far fallire test con nome, poi si ripristina.
- **Caricamento "utente o 404" scartato** (sette copie identiche): il ramo 404 non è raggiungibile, perché l'utente è
  quello autenticato o è già stato controllato, e nessun test lo copre.

### Motivazione

- Il backend è in anticipo sul calendario e il 19 è ancora un giorno di backend; le proposte valgono circa un'ora e
  mezza e ognuna ha test già esistenti.
- Il codice valutato al capstone perde duplicazioni e codice usato solo dai test; O1 è l'unico guadagno di velocità
  misurato (da 27 ms a 0,08 ms con 20 conversazioni da 2.000 messaggi).
- Una revisione fatta senza le motivazioni scritte non giustifica in partenza il codice esistente; il filtro successivo
  evita di proporre ciò che le decisioni escludono.

### Alternative scartate

- **Non procedere:** nessun rischio, ma le duplicazioni restano nel codice consegnato.
- **Solo O1:** è l'unico guadagno misurato, ma con i volumi della demo non si nota.
- **Rimandare dopo la consegna:** dopo il 25 non serve più alla valutazione.
- **Revisione fatta solo con il contesto del progetto:** rischia di confermare le scelte esistenti senza metterle in
  discussione.
- **Solo i test Java come confronto:** coprono il comportamento, ma la collection lo prova anche via HTTP come lo vedrà
  il frontend; senza la prova di copertura, "coperta da test" resterebbe un'affermazione.

## Decisione 76: rinforzo di sicurezza di F7-03 (analisi del 18 ottobre, decisioni 48, 55 e 68)

### Scelta

- **Metodo:** analisi di sicurezza del backend del 18 ottobre (decisioni, progettazione, report di sicurezza,
  `docs/ottimizzazione.md`, codice e test), senza modifiche al codice: dieci voci (S1–S10) non coperte da un test o da un
  controllo, ordinate per gravità e per rapporto fra beneficio e costo. Scelta dello studente: le quattro raccomandate,
  in una sola card, F7-03 (circa 4 ore, prima del frontend), nell'ordine S2, S1, S3, S5.
- **S2, limite dei login falliti prenotato in modo atomico:** il tentativo si registra con `consume` prima di BCrypt,
  invece di `check` prima e `record` dopo. Un login riuscito azzera il contatore come oggi; con la password giusta ma
  email non verificata o account sospeso il tentativo si restituisce (`release`), così questi casi continuano a non
  contare come fallimenti (decisione 48).
- **S1, reset della password serializzato con refresh e login:** rotazione e login bloccano la riga dell'utente prima di
  creare un refresh token, nello stesso ordine di reset e sospensione (prima l'utente, poi i token). Il login esegue
  BCrypt fuori dal lock e, sotto il lock, controlla che l'hash della password non sia cambiato.
- **S3, geocodifica:** attesa massima del turno di 10 s (`app.geocoding.max-wait`), oltre la quale la risposta è 502
  `GEOCODING_UNAVAILABLE` (decisione 55); nuovo limite `EVENTS_CREATED`, 20 creazioni in 24 ore per utente, unico per
  concerti e indie event, consumato prima della geocodifica.
- **S5, tetto del body JSON:** 256 KB con `StreamReadConstraints.maxDocumentLength` di Jackson; oltre, 400
  `VALIDATION_ERROR` con l'handler già esistente.
- **S4, Content-Security-Policy sugli script** (`script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors
  'none'; form-action 'self'`): spostata in FE-11, dove si prova con il frontend compilato. Vincolo per tutte le card FE:
  niente script inline, script da CDN o `eval`.
- **Rischi accettati, fuori dalla card:** S6, carattere NUL e caratteri bidi o di controllo nei testi (PostgreSQL rifiuta
  il NUL; il rimedio tocca molti DTO e deve rispettare le emoji composte); S7, raffica di richieste sugli endpoint
  pubblici con email sempre diverse (quota di Brevo e CPU di BCrypt), che richiederebbe un limite per IP (vedi decisione
  48 e la demo in aula); S8, connessioni e SUBSCRIBE WebSocket senza limite; S9, `Retry-After` sui 429; S10, dettagli di
  PostgreSQL nel log di Hibernate. Post-V1: CAPTCHA o limite combinato (decisione 48).
- **Verifica:** TDD, con un test che fallisce sul codice attuale per ogni voce; prove di mutazione su S1 e S2; collection
  Postman in locale a fine card con gli stessi esiti di F7-02. Nessun endpoint nuovo e nessuna migrazione.
- **Esito (F7-03, 18 ottobre):** le quattro correzioni sono realizzate come descritto. Dettagli di realizzazione:
  nel login il lock sull'utente è una query nativa `select password_hash ... for update`
  (`UserRepository.lockAndReadPasswordHashById`), perché `findWithLockById` restituirebbe l'entity già caricata, con
  l'hash vecchio; nella rotazione l'id dell'utente si legge con una query scalare
  (`RefreshTokenRepository.findUserIdByTokenHash`) prima dei lock, per non portare in memoria un token che dopo
  l'attesa risulterebbe superato. Il tetto del body è un `JsonFactoryBuilderCustomizer` (in Jackson 3 le costanti di
  lettura stanno sulla factory, non sul mapper). Il limite delle creazioni conta anche i tentativi respinti dalla
  geocodifica (indirizzo non trovato), perché è proprio la geocodifica che protegge. Test, prove di mutazione ed
  esiti sono nel report di sicurezza.

### Motivazione

- **S1:** in PostgreSQL l'`UPDATE` che revoca tutti i token non vede le righe inserite da una transazione che fa commit
  dopo l'inizio dell'istruzione. Un refresh o un login in corso durante il reset crea un token che resta valido e si
  rinnova all'infinito: la garanzia della tabella 4.11 ("reset = revoca di tutti") non vale contro chi ha già rubato la
  sessione e la rinnova di continuo. La sospensione non ha il problema, perché lo stato SUSPENDED resta salvato e ogni
  rotazione lo ricontrolla. Lo stesso ordine dei lock in tutte le operazioni evita i deadlock; BCrypt fuori dal lock
  evita di tenere bloccata la riga durante l'hash.
- **S2:** con `check` prima e `record` dopo, richieste parallele passano tutte il controllo prima che una sola registri il
  fallimento: con i 200 thread di Tomcat si provano circa 200 password per finestra invece di 10.
- **S3:** MUSICIAN e HOST si attivano in self-service; senza attesa massima le creazioni in coda sul lock della
  geocodifica occupano i thread di Tomcat e fermano tutto il servizio, frontend compreso. 10 s lasciano passare circa
  dieci creazioni contemporanee (una demo in aula) con una risposta nel caso peggiore di circa 15 s. Il limite delle
  creazioni ferma il singolo utente e protegge l'uso di Nominatim.
- **S5:** il limite di Tomcat vale per i form, non per il JSON; pochi body di decine di MB esauriscono la memoria del
  piano gratuito. Il body legittimo più grande sta sotto i 40 KB.
- **S4 in FE-11:** oggi si potrebbe provare solo con Swagger UI; con il frontend compilato la prova è reale.

### Alternative scartate

- **Tutte le voci S1–S10 in F7-03:** circa 8 ore, troppe prima del frontend.
- **Solo S1:** lascia aperte due vie di disservizio (S3, S5) e l'aggiramento del limite dei login (S2), che costano poco.
- **S1 con `FOR SHARE` sulla riga dell'utente:** due refresh simultanei che riattivano una sospensione scaduta
  dovrebbero passare da `FOR SHARE` a un lock di scrittura e andrebbero in deadlock.
- **S1 con il lock sull'utente tenuto durante BCrypt:** login paralleli sullo stesso account terrebbero occupate le
  connessioni del database per tutta la durata dell'hash.
- **S2 con `reset` invece di `release` per email non verificata o account sospeso:** azzererebbe i fallimenti con una
  password giusta, contro la decisione 48.
- **Attesa massima di 5 s o di 30 s:** 5 s darebbe 502 inutili con molti utenti insieme; 30 s terrebbe i thread
  occupati a lungo e l'utente davanti a un caricamento senza fine.
- **Limite per IP sugli endpoint pubblici (S7):** falsi positivi dietro lo stesso IP (la demo in aula) e aggirabile con
  più indirizzi, come già osservato nella decisione 48.
- **CSP subito in F7-03:** senza frontend la prova sarebbe parziale e una violazione si scoprirebbe solo al deploy.

## Decisione 77: elenchi dei contenuti dell'utente nell'MVP (richiesta dello studente, card F7-04)

### Scelta

- Durante la pianificazione del frontend (18 ottobre) è emerso che il backend ha un solo elenco dei contenuti
  creati da un utente, `GET /api/indie-events/mine` (decisione 57): mancano concerti, annunci collab e post del
  feed. Lo studente li porta nell'MVP con la card **F7-04**, eseguita prima di FE-01.
- Endpoint: `GET /api/official-concerts/mine`, `GET /api/collab-posts/mine`, `GET /api/feed-posts/mine`, con le
  regole di `indie-events/mine`: autenticato senza ruolo richiesto; contenuti del chiamante non nascosti (né dal
  proprietario né da un admin), compresi concerti passati e annunci chiusi; ordine `created_at desc, id desc`;
  `PageParams`; stessi DTO di risposta degli endpoint esistenti (nel feed `likedByMe` calcolato, `distanceKm`
  nullo). In `SecurityConfig` ogni `/mine` precede `/{id}`.
- **Esito (card F7-04, 19 ottobre):** i tre endpoint sono implementati come descritto, con una query derivata per
  ciascuno (`findByHostId…`, `findByMusicianId…`, `findByAuthorId…` più `AndModerationHiddenAtIsNull`) e il grafo
  dell'entity per caricare l'autore. Le regole di `SecurityConfig` per `/mine` precedono quelle di `/{id}`; un test
  per endpoint (401 senza token) protegge l'ordine. Un utente senza il ruolo di creazione (per esempio un FAN su
  `official-concerts/mine`) riceve 200 con elenco vuoto, non 403. `likedByMe` nel feed è calcolato con la stessa
  query dei like usata dalla lista pubblica. Tabelle di progettazione 6.6, 6.7 e 6.8 aggiornate.
- Nel frontend la pagina "Area personale" (FE-04) mostra una scheda per tipo di contenuto.
- Solo i contenuti **creati** dall'utente. La partecipazione agli eventi ("parteciperò") non esiste nell'MVP: va in
  Post-V1, accanto ai `tickets` (progettazione, sezione 15).

### Motivazione

- Senza questi elenchi HOST e MUSICIAN ritrovano i propri concerti e annunci solo nelle liste pubbliche: la
  ricerca dei concerti richiede una posizione e un raggio massimo di 200 km, la bacheca collab mostra solo gli
  annunci aperti, quindi un annuncio chiuso o un concerto lontano non si ritrovano più.
- Le stesse regole di un endpoint già esistente e testato rendono la card prevedibile e a basso rischio.
- La partecipazione è una funzione nuova (tabella, endpoint, pulsante) e la versione gratuita dei biglietti, già
  previsti in Post-V1.

### Alternative scartate

- **Solo frontend, con il limite dichiarato:** nessun lavoro sul backend, ma niente area personale.
- **Anche i contenuti pubblici degli altri nel profilo (`/api/users/{id}/...`):** quattro endpoint pubblici in più,
  circa 4,5 h di backend; il margine del calendario scenderebbe a zero.
- **Parametro `?mine=true` sugli elenchi esistenti:** lo stesso endpoint cambierebbe regole (pubblico o
  autenticato, annunci chiusi solo per sé), più difficile da proteggere e da testare.
- **Partecipazione agli eventi nell'MVP o in Post-V2:** nell'MVP è troppo grande; in Post-V2 aspetterebbe i
  pagamenti, che non le servono.

## Decisione 78: piano del frontend (brainstorming del 18 ottobre, brief sezione 12)

### Scelta

Scelte dello studente, una per una, durante il brainstorming del piano
`docs/superpowers/plans/2026-10-18-resonance-frontend.md`:

- **Schermate irrinunciabili** oltre a quelle della demo (§14): registrazione e verifica, profilo e ruoli,
  pubblicazione degli eventi, password dimenticata e reset.
- **Interfaccia curata su base Bootstrap**, con identità visiva propria nelle CSS custom properties; **react-bootstrap**
  per i componenti interattivi (tipizzati, guidati dallo stato di React).
- **Dati del server con RTK Query** (parte di Redux Toolkit, già usato in NoseY); slice scritti a mano solo per
  sessione e notifiche.
- **Mappa:** MapLibre GL + react-map-gl + OpenFreeMap, riusata da NoseY (decisione 8 di NoseY) con gli stili riscritti.
- **Riuso selettivo della logica del frontend di NoseY**, mai gli stili Tailwind, con nomi in inglese; mappa in
  `docs/riuso-nosey.md` (FE-01).
- **Responsive mobile-first** in ogni card, con controllo a 375, 768 e 1280 px.
- **Test:** Vitest + React Testing Library + MSW sulle parti critiche (circa 30 test) e checklist manuale a fine card.
- **Strumenti del brief:** Google Stitch usato dallo studente come solo riferimento visivo; skill impeccable per i
  token in FE-01 e per la revisione in FE-12; ReactBits (2–3 componenti senza WebGL) in FE-12.
- **Fasi e card:** A (FE-01–FE-03), B (FE-04–FE-08), C (FE-09a, FE-09b, FE-10), D (FE-12, FE-11); la FE-09 originale è
  divisa in FE-09a (amicizie e ricerca) e FE-09b (chat, notifiche e contatto) senza rinumerare le card.
- **Ordine dei tagli:** ReactBits → notifiche live → contatto degli eventi → bacheca collab → revisione con impeccable.
- **Struttura delle cartelle "a forma fissa":** ogni area di `features/` con `api/`, `components/`, `pages/`; parti
  condivise in `lib/`, `hooks/`, `components/`, `types/`; percorsi in `app/routes.ts`; test accanto al file; nessun
  file barile. Una funzione nuova (per esempio quelle di Post-V1) è una cartella nuova con la stessa forma.
- **Ricerca nelle vicinanze:** raggio a livelli 5, 15, 25, 50 e 100 km (iniziale 15); centro dalla posizione del
  browser, poi dal profilo, altrimenti Firenze con un avviso.
- **Due icone in barra:** messaggi (somma degli `unreadCount` del server, aggiornata a ogni `NEW_MESSAGE`) e
  campanella (richieste di amicizia in attesa più le notifiche live della sessione). Il conteggio delle richieste si
  ricarica all'apertura, al ritorno sulla scheda e dopo ogni azione, **senza polling**: le notifiche live delle
  amicizie sono fuori dall'MVP (decisione 59) e un aggiornamento periodico le imiterebbe.
- **Contatto per i ricorsi** (questione aperta della progettazione, sezione 1.4): costante in `src/config.ts`.
- **Sessione:** rinnovo anticipato dell'access token 60 s prima della scadenza, con riconnessione STOMP, oltre al
  refresh su 401.
- **Rilascio:** merge `develop → main` a fine di F7-04 e di ogni fase del frontend, per provare presto su Render
  cookie, fallback SPA e Dockerfile.
- **Strumenti di sviluppo:** Node 24 LTS, npm, React 19, TypeScript `strict`, ESLint e Prettier; tipi dei DTO scritti a
  mano dal codice del backend; la CSP della decisione 76 anche in `vite preview` da FE-01.
- **Lingue:** interfaccia e percorsi in italiano, codice in inglese, commenti in italiano (decisione 42).

### Motivazione

- Ogni scelta è stata presa dallo studente fra alternative con pro, contro e impatto sulle stime; il calendario
  (circa 56 h dal 19 al 23 ottobre, demo il 24) lascia come margine solo la mattina del 24 e l'ordine dei tagli.
- Riuso e librerie già conosciute da NoseY riducono il rischio; la forma fissa delle cartelle rende prevedibile dove
  va ogni file e lascia crescere il frontend dopo l'MVP.
- Il conteggio delle amicizie senza polling rispetta la decisione 59 senza anticipare una funzione Post-V1.

### Alternative scartate

- **Bootstrap essenziale o design tutto su misura:** il primo generico, il secondo circa +15 h.
- **`createAsyncThunk` e `fetch` a mano:** circa +4 h di codice ripetitivo e più ricariche da ricordare.
- **Bootstrap con il suo JavaScript originale:** stato dei componenti fuori da React e attributi non controllati da
  TypeScript.
- **Leaflet:** da scrivere da zero, tessere raster con limiti d'uso più stretti.
- **Tailwind per riusare NoseY così com'è:** vietato dal brief e mai usato dallo studente.
- **Playwright sulla demo:** circa +7 h, fragile con i codici email.
- **FE-09 intera o card rinumerate:** una card da 9 h oppure card Trello da rinominare.
- **Slider continuo del raggio:** più valori diversi e quindi più chiamate; i livelli restano in cache.
- **Polling delle richieste di amicizia:** anticipa la funzione Post-V1 delle notifiche live delle amicizie.
- **Cartelle per tipo di file o aree piatte:** file di una stessa area sparsi, oppure 10–15 file nella stessa cartella.

## Decisione 79: testo degli utenti come elementi React, senza DOMPurify (piano del frontend, sostituisce DOMPurify dello stack del brief)

### Scelta

- Ogni testo scritto da un utente (descrizioni, post, annunci, messaggi, bio) passa dal componente `UserText`, che lo
  mostra con l'escape di React e trasforma gli URL `http`/`https` in elementi React `<a>` con
  `rel="noopener noreferrer"`. Al clic una modale mostra il dominio di destinazione e chiede conferma prima di aprire
  la scheda.
- `dangerouslySetInnerHTML` è vietato in tutto il frontend da una regola ESLint.
- DOMPurify, citato nello stack del brief (sezione 12), non si installa; la progettazione, sezione 8.6, è corretta di
  conseguenza.
- Post-V1: testo ricco (grassetto, menzioni, markdown); DOMPurify rientra con una lista di tag ammessi, solo in
  `UserText`.

### Motivazione

- Nessun testo degli utenti diventa HTML, quindi non c'è una superficie XSS da sanificare (riduzione della superficie
  d'attacco). React fa l'escape del testo e blocca gli `href` `javascript:`; la CSP `script-src 'self'` (decisione 76)
  resta come seconda barriera.
- DOMPurify su un testo che React mostra già come testo non cambierebbe mai il risultato: sarebbe codice morto.
- La conferma con il dominio riduce il rischio di phishing dei link inviati da sconosciuti (candidature e contatti).

### Alternative scartate

- **DOMPurify sul testo semplice:** non cambia mai il risultato (codice morto).
- **Link generati come HTML e puliti da DOMPurify:** uso reale della libreria, ma crea la superficie che poi deve
  chiudere.
- **Escape scritti a mano e `innerHTML`:** fragili (ordine delle sostituzioni, virgolette negli attributi, `&` negli
  URL) e contrari alle linee guida OWASP.
- **URL non cliccabili, eventualmente con aspetto da link:** sicuri, ma meno utili; con l'aspetto da link sembrano un
  difetto.
- **`href="javascript:void(0)"`:** bloccato dalla CSP e da React, ed è proprio il tipo di link che si vuole evitare.

## Decisione 80: tema scuro, token di design e bagliore da palco (card FE-01)

### Scelta

- **Tema scuro unico** (`data-bs-theme="dark"` su `<html>`), con tono da palco: fondo `#0a0a0a`, pannelli `#121212`, accento
  giallo `#ffd60a`, pulsante primario grigio chiaro con testo scuro, campi con la sola linea inferiore (gialla al focus),
  raggi piccoli (2, 4 e 8 px). Il riferimento è il mock-up di accesso approvato dallo studente il 19 ottobre.
- **Font Barlow Condensed** dal pacchetto npm `@fontsource/barlow-condensed` (pesi 400, 500, 600, 700, solo latino),
  incluso nel bundle: nessun font da CDN (decisione 76).
- **Token in tre file** (`src/styles/`): `tokens.css` con le custom properties `--rs-*` (colori, tipografia,
  spaziature, raggi, ombre, movimento), `bootstrap-overrides.css` che le collega alle variabili `--bs-*` e ritocca
  pulsanti, campi, card, barra e badge, `index.css` con font, base della pagina, selezione, cursore, barre di
  scorrimento, focus e movimento ridotto. Nessun Sass.
- **Bagliore da palco** (faro giallo dall'angolo in alto a destra più una griglia da 24 px quasi invisibile), applicato
  per fascia di schermo con le classi `rs-app`, `rs-main` e `rs-nav` di `AppShell` e `NavBar`: telefono (sotto 768 px)
  su tutta la pagina, barra compresa; tablet (768–1199 px) solo sul corpo della pagina; desktop (da 1200 px) solo sulla
  barra di navigazione.
- **Le schermate di Stitch** (progetto "Resonance v2", id `697298539032039664`) sono solo un riferimento visivo di stile
  e di struttura. Le funzioni che mostrano e che il backend non ha (partecipazione agli eventi, prezzi, rating, gear,
  link a Spotify, canali di gruppo, esportazione CSV) non si implementano; il contenuto delle schermate lo decide il
  piano.
- **Test dei token** (`tokens.test.ts`): ogni variabile `--rs-*` usata dai fogli di stile deve essere definita in
  `tokens.css`.

### Motivazione

- Il tema scuro e il bagliore sono la scelta visiva dello studente; farli passare da variabili permette di cambiarli in
  un punto solo e di decidere dove si applicano senza toccare i componenti.
- Una variabile CSS mancante non dà errori (il valore sparisce in silenzio): il test la intercetta.
- I contrasti dei testi sulle superfici scure restano sopra 4,5:1; i testi più piccoli del mock-up (8–9 px) salgono a
  12 px.
- Sulla barra di navigazione la soglia di 1200 px segue il breakpoint `xl` di Bootstrap, quella di 768 px `md`.

### Alternative scartate

- **Bagliore su tutta la pagina a ogni larghezza:** sul desktop affaticherebbe le schermate dense (liste, mappa).
- **Font di sistema o da CDN:** il primo non ha il carattere del mock-up, il secondo è vietato dalla CSP.
- **Tema chiaro e scuro commutabili:** il doppio dei valori da curare e da provare, senza una richiesta dello studente.
- **Sass o Tailwind per i token:** vietati dalla decisione 79 e dal piano (custom properties e Bootstrap).
- **Rigenerare con Stitch tutte le schermate mancanti (feed, admin, Host, registrazione, password):** molte ore perse per
  timeout e copie; bastano il piano e lo stile già definito.

## Decisione 81: progetto creato dallo studente con create-vite e TypeScript fissato a 6.0.3 (card FE-01)

### Scelta

- **Creazione a mano:** `Resonance_FE/` lo crea lo studente con `npm create vite@latest` (React + TypeScript) e con npm, guidato
  passo passo; Claude non scrive lo scheletro. Poi si fondono nei file del template le configurazioni del piano: `strict`
  esplicito, alias `@/`, proxy `/api` e `/ws`, CSP in `vite preview`, Vitest con jsdom e MSW, divieto di
  `dangerouslySetInnerHTML`. Il codice di esempio del template (`App.tsx`, `App.css`, `index.css`, `assets/`, `public/`)
  è stato tolto.
- **Versioni (19 ottobre):** `create-vite` 9.3.0 è il generatore; la libreria `vite` è la 8.3.4, l'ultima pubblicata (la 9.3.0 che si vede con `npm create vite` è il generatore, non la libreria), React 19.3.1.
- **TypeScript `~6.0.3`**, non la 7.0.2 messa dal template: `typescript-eslint` 8.71.2 (l'ultima) accetta solo
  `>=4.8.4 <6.1.0` e `npm install` falliva con ERESOLVE. Da rivedere quando `typescript-eslint` supporterà la 7.
- **Stitch tramite MCP** (server HTTP `stitch` nel profilo dell'utente, fuori dal repository), scelta dello studente al posto
  dell'uso a mano con screenshot previsto dalla decisione 78; la chiave API non sta in nessun file del progetto.

### Motivazione

- Lo studente vuole sapere come nasce il progetto: creato da lui, ogni scelta è tracciabile.
- Con il template i file di base sono quelli ufficiali e restano aggiornabili; le aggiunte del piano sono poche e si vedono.
- Aggirare il conflitto con `--legacy-peer-deps` avrebbe nascosto un'incompatibilità vera; la 6.0.3 è già quella di NoseY.
- Con l'MCP lo stile delle schermate si legge dai progetti Stitch, senza esportare immagini a mano.

### Alternative scartate

- **Scheletro scritto da Claude:** più veloce, ma lo studente non sa come è fatto (era la prima versione di FE-01).
- **`--legacy-peer-deps` o `--force`:** installa, ma ignora un conflitto reale fra TypeScript e il lint.
- **TypeScript 7.0.2 senza `typescript-eslint`:** si perderebbe il lint dei tipi e il divieto in ESLint resterebbe solo sulla sintassi.
- **Stitch solo a mano, con screenshot:** nessuna configurazione, ma il contesto della schermata si perde.

## Decisione 82: client API con refresh silenzioso (card FE-02, progettazione, sezioni 4.8 e 4.13)

Ogni punto è stato proposto allo studente con alternative, pro, contro e raccomandazione, e approvato il 19 ottobre.

### Scelta

- **Pagina richiesta dopo il login:** `RequireAuth` manda a `ROUTES.login` (`/accesso`) con la pagina richiesta nello stato del
  router (`{from}`), non nell'URL. FE-03 deve ricopiare lo stato fra login, registrazione e verifica.
- **Refresh come endpoint RTK Query:** `api.endpoints.refresh` (mutazione `POST /api/auth/refresh`, con `X-Requested-With` e
  `credentials: 'include'`), lanciato con `track: false` perché il risultato non resti nella cache. `refreshSession` (in
  `lib/api/apiSlice.ts`) lo chiama una alla volta: più 401 in parallelo, l'avvio in StrictMode e il timer condividono la stessa
  promessa. Gli endpoint `/api/auth/*` non attivano mai il refresh, e nemmeno un 401 senza sessione aperta.
- **409 `REFRESH_CONFLICT`:** attesa di 1 secondo e un solo secondo tentativo.
- **Richiesta ripetuta senza nuovo refresh:** se mentre una richiesta era in volo il token nello store è già cambiato, si ripete
  con il token nuovo senza un secondo refresh.
- **Tre esiti del refresh:** `refreshed`; `ended` (qualunque 401, oppure 403 `ACCOUNT_SUSPENDED` con i dettagli: sessione chiusa e
  cache svuotata); `failed` (rete, 5xx, doppio 409): sessione lasciata aperta.
- **Refresh fallito a sessione aperta:** la richiesta che era partita riceve un errore di rete (`FETCH_ERROR`, "Server non
  raggiungibile"), non il 401 "sessione scaduta", che sarebbe falso.
- **Refresh fallito all'avvio:** si prosegue da anonimi (le pagine pubbliche funzionano) e compare nella barra degli avvisi
  "Non riesco a contattare il server: la tua sessione potrebbe essere ancora attiva" con il pulsante Riprova, che rifà il refresh;
  se il server risponde (sessione ripresa o scaduta davvero) l'avviso sparisce.
- **Rinnovo anticipato:** hook `useTokenRenewal`, montato da `SessionBootstrap`: rinnova 60 s prima della scadenza; se fallisce per
  un errore passeggero ritenta una volta dopo 15 s. `onTokenRefreshed` avvisa i listener (STOMP, FE-09b).
- **Barra degli avvisi unica** (`NoticeBar` in `AppShell`, stato in `lib/notices/noticeSlice.ts`): mostra uno alla volta
  `serverUnreachable` e `logoutIncomplete`, chiudibile.
- **Logout:** `authApi.logout` (`DELETE /api/auth/refresh`) chiude sempre la sessione nell'app; se il server non risponde mostra
  l'avviso "Sei uscito da questo dispositivo, ma il server non ha risposto: la sessione potrebbe riaprirsi al prossimo
  caricamento. Riprova a uscire quando la rete torna", perché il cookie resta valido. Il login lo scrive FE-03: in FE-02 non c'è
  nel codice di produzione (il test usa un endpoint di prova).
- **Protezioni:** `RequireRole` manda gli anonimi al login e a chi non ha il ruolo mostra la pagina "Accesso negato" allo stesso
  indirizzo, con testo generico che non nomina ruoli.
- **`selectHasRole('ADMIN')` vale anche per SUPERADMIN**, come la `RoleHierarchy` del backend (sezione 5.1): il SUPERADMIN creato
  all'avvio ha solo FAN e SUPERADMIN. Gli altri ruoli non si ereditano.
- **Errori:** `getErrorMessage` decide sul `code` (un testo italiano per ogni codice di §6.2, tutti approvati); con un codice
  sconosciuto ripiega sul `message` del backend; `FETCH_ERROR`, 502/503/504 e risposte non JSON dicono "server non raggiungibile";
  un errore tecnico non mostra mai il proprio testo. `WRONG_PASSWORD` (alla verifica) è generico, come `INVALID_CREDENTIALS`, e
  dice di registrarsi di nuovo con la stessa email: "password dimenticata" non funziona per un account non verificato.
  `getFieldErrors` legge `fields` solo per `VALIDATION_ERROR` e `ADDRESS_NOT_FOUND`.
- **Base degli URL = `window.location.origin`:** equivale a un URL relativo nel browser (una sola origine, sezione 4.3) ma funziona
  anche con la `fetch` di Node nei test.
- **Store con `makeStore()`:** l'app usa `store`, i test uno per prova. Un listener su `sessionEnded` svuota la cache di `api`.
- **Test oltre quelli del piano** (stato della sessione, rinnovo anticipato, logout, avvisi, `ErrorAlert`): tutti tenuti.

### Motivazione

- Un unico refresh per scheda evita 409 inutili e protegge la rotazione del token (decisione 10).
- Un errore passeggero non deve far uscire l'utente: solo i rifiuti definitivi del backend chiudono la sessione, e il messaggio
  all'utente dice la verità (server non raggiungibile, non sessione scaduta).
- La pagina richiesta nello stato del router non si può falsificare con un link: nessun reindirizzamento aperto.
- Il logout deve funzionare anche a server spento, ma l'utente deve sapere che il cookie può riaprire la sessione.
- Svuotare la cache in un ascoltatore dello store rende impossibile dimenticarlo in un punto nuovo (privacy su computer condivisi).

### Alternative scartate

- **`?redirect=` nell'URL (come NoseY):** va validato a ogni uso, altrimenti è un reindirizzamento aperto. **Campo nello store:**
  si perde al ricaricamento.
- **Chiudere la sessione a ogni refresh fallito:** una caduta di rete farebbe uscire l'utente con una sessione valida.
- **Schermata di errore bloccante all'avvio:** bloccherebbe anche chi vuole solo vedere gli eventi pubblici.
- **Refresh con `fetch` diretta:** più semplice, ma fuori dal sistema di richieste dell'app.
- **Attesa di 200 ms o nessuna attesa dopo il 409:** meno margine per il cookie nuovo.
- **Rinnovare sempre a ogni 401:** più rotazioni del cookie del necessario e 409 evitabili.
- **Nessun nuovo tentativo del rinnovo anticipato:** una connessione chat potrebbe restare con un token scaduto.
- **"Non trovato" o "Home" per chi non ha il ruolo:** "non trovato" non spiega il motivo a chi ha perso un ruolo; la home senza
  avviso lascia l'utente senza spiegazione.
- **Ruoli letti alla lettera:** basta dimenticare SUPERADMIN in una pagina per lasciarlo fuori da un'area che il backend gli permette.
- **Login in `authApi` già in FE-02:** anticipa FE-03.
- **Logout in silenzio o che resta aperto con errore:** nel primo caso la sessione può riaprirsi senza che l'utente lo sappia, nel
  secondo senza rete non si può uscire.
- **Indirizzi relativi nel codice con i test adattati:** il codice di produzione resta pulito, ma serve un trucco nel setup dei test.
- **Pulizia della cache esplicita in ogni punto che chiude la sessione:** una dimenticanza lascerebbe i dati in memoria.
- **Solo i test del piano:** timer del rinnovo, logout e transizioni della sessione resterebbero senza un test dedicato.

## Decisione 83: accesso, registrazione, verifica e reset nel frontend (card FE-03, progettazione, sezioni 4.4–4.10)

Ogni punto è stato proposto allo studente con alternative, pro, contro e raccomandazione, e approvato il 19 ottobre.

### Scelta

- **Riferimento visivo:** la schermata Stitch "Accesso e Stati Account" (progetto "Resonance v2", decisione 80). Aspetto: barra con freccia
  indietro e logo RESO**NANCE** a due colori; schede scure impilate, larghe al massimo 448 px, con striscia gialla in alto; intestazione
  "ACCEDI •" con "Non hai un account? Registrati qui" a destra; "Password dimenticata?" sulla riga della password; pulsante argento
  "ENTRA" con il microtesto "…nella Zona"; verifica con sei caselle, errore con icona, "VERIFICA →" e "Invia di nuovo il codice (30 s)";
  il codice è presentato con l'email mascherata ("m***@dominio.it"). I testi che il prototipo non ha (registrazione, reset, errori del
  client) restano quelli approvati il 19 ottobre, nello stesso tono.
- **Account sospeso:** scheda con bordo ambra, badge "RESTRIZIONE ATTIVA", titolo "Account sospeso", "Sospeso fino al" con la data in
  ora locale (formato breve, es. 30/10/2026: dal 21 ottobre tutto in numeri, decisione 90) oppure "A tempo indeterminato", "Motivo: …" e "Per un ricorso scrivi a …" con il contatto.
  Serve un colore ambra nei token (`--rs-color-warning`).
- **Campi vuoti all'accesso:** messaggi nostri sotto il campo ("Scrivi la tua email.", "Scrivi la password.") con l'icona di errore del
  prototipo; il server non viene chiamato. Niente attributo `required` del browser.
- **Registrazione con i soli tre campi del backend** (nome visibile, email, password): niente "Ripeti password" e niente casella dei
  termini. Password con l'occhio per mostrarla e il contatore "N / 72 byte".
- **Email in `/verifica`:** arriva dalla navigazione (stato del router) già scritta; il campo è modificabile e dopo un
  ricaricamento resta vuoto. Nessun dato salvato nel browser, nessuna email nell'indirizzo.
- **Contatto per i ricorsi** (sezione 1.4): segnaposto `ricorsi@resonance.example` in `src/config.ts`. Va sostituito con un indirizzo
  vero prima di una consegna reale.
- **Navigazione come nel prototipo:** su telefono barra in alto (logo, campanella, cerchio giallo del profilo) e barra di tab in basso
  (Eventi, Collab, Feed, Messaggi, Profilo); su desktop colonna di navigazione a sinistra e in alto campanella e profilo. Niente
  hamburger. Si realizza in una **card nuova, dopo FE-03 e in fase A, "Navigazione e footer"** (circa 6 h in più, senza tagli per ora).
  In FE-03 resta la barra in alto di FE-01, con `UserMenu`: cerchio giallo con l'iniziale del nome (la foto arriva con FE-04) e menu
  con "Esci"; l'anonimo vede Accedi e Registrati. Le pagine di accesso non hanno la barra di tab.
- **Footer** (card "Navigazione e footer"): informativa privacy come pagina vera e cliccabile; copyright e termini di servizio come
  link vuoti segnaposto. Compare a fondo pagina come pop-up dal basso, su telefono e su desktop. Sul telefono si aggiunge alla barra di
  tab: sale tutto, il footer sta sotto e le tab restano visibili sopra. *(Aggiornato in FE-03b, decisione 85: le tab restano ferme e il footer esce da dietro di esse.)* Non deve coprire né le tab, né la paginazione, né altre funzioni:
  il contenuto riserva in fondo uno spazio pari a tab e footer insieme.
- **Dopo il reset della password:** si va a `/accesso` con un avviso verde ("Password cambiata. Accedi con la nuova password."),
  presente solo in quell'arrivo.
- **Attesa del reinvio del codice (60 s):** conto alla rovescia che riparte da zero a ogni ricaricamento; se si clicca troppo presto il
  server risponde `TOO_MANY_REQUESTS` e si mostra l'attesa. Nulla nel browser.
- **Utente già loggato** su `/accesso`, `/registrazione`, `/verifica` e reset: reindirizzato alla home (o alla pagina richiesta, se
  la sessione parte proprio da quella pagina).
- **Freccia indietro delle pagine di accesso:** porta a una destinazione fissa, non alla cronologia: alla home da `/accesso`,
  `/registrazione` e `/password-dimenticata`; a `/registrazione` da `/verifica` e a `/password-dimenticata` da `/password/reset`
  (per correggere un'email sbagliata). La destinazione la dichiara la rotta in `handle.backTo`, letta da `AuthLayout`.
- **Registrazione, dettagli approvati:** segnaposto "Come ti vedranno gli altri" nel nome e "tuonome@dominio.it" nell'email, nessuno
  nella password (solo il contatore "N / 72 byte"). Il nome ha da 3 a 30 caratteri (il backend lo porta da 50 a 30 con F7-05).
  `EMAIL_ALREADY_REGISTERED` dice "Esiste già un account con questa email." (senza "Prova ad accedere") e sotto compare il
  collegamento "Vai all'accesso". Con `VALIDATION_ERROR` i messaggi del server vanno sotto i campi corrispondenti (nome, email,
  password); un campo sconosciuto lascia solo l'avviso generico in alto.
- **Emoji:** nel form il nome e la nuova password (registrazione e reset) non ammettono emoji: si possono scrivere o incollare, ma
  sotto il campo compare "Le emoji non sono ammesse nel nome." (o "…nella password.") e il pulsante non invia. Il backend applicherà
  la stessa regola con la card F7-05 (decisione 84): nome senza emoji né caratteri invisibili, password senza emoji, solo alla
  scrittura (non nel login e nella verifica). Le emoji restano ammesse nei messaggi della chat (FE-09b).
- **Verifica (`/verifica`):** il campo "Email" c'è sempre (già scritto se si arriva dalla registrazione o dall'accesso, modificabile),
  poi le sei caselle del codice e la password. Testo: "Abbiamo inviato un codice a 6 cifre alla tua email. Inseriscilo per confermare
  la tua identità da palco." (l'email non è mascherata, perché il campo la mostra). `CODE_INVALID` e `CODE_EXPIRED` compaiono sotto
  le caselle, che restano riempite e diventano rosse; gli altri errori in un avviso in alto; `ALREADY_VERIFIED` con "Vai all'accesso";
  `ACCOUNT_SUSPENDED` con la scheda. Codice incompleto: "Scrivi le 6 cifre del codice."
- **Reinvio del codice:** attesa di **60 secondi**, non 45: il backend accetta un invio ogni 60 (progettazione, sezione 4.6) e con 45
  si vedrebbero errori `TOO_MANY_REQUESTS` causati dall'interfaccia. Il pulsante mostra "Invia di nuovo il codice (42 s)"; l'attesa
  parte subito dopo una registrazione o dopo l'invio da "password dimenticata" (segno `codeSent` nello stato del router), non arrivando
  dall'accesso o dopo un ricaricamento. Dopo un reinvio compare "Se l'indirizzo è in attesa di verifica, il codice sta arrivando. Non
  puoi chiederne un altro subito: controlla se ti è arrivato, anche nella cartella spam." (non promette che il codice parta: il
  backend risponde sempre 204, decisione 51). Con `TOO_MANY_REQUESTS` l'attesa riparte.
- **Password dimenticata e reset:** `/password-dimenticata` dice "Ti verrà mandato un codice a 6 cifre per il ripristino password."
  e ha il collegamento "Hai già un codice? Inseriscilo". A invio riuscito si va a `/password/reset` con l'email e il segno
  `codeSent`, che mostra l'avviso neutro "Se l'indirizzo è registrato e verificato, ti abbiamo inviato un codice." Il reset ha email,
  codice, nuova password (stesse regole della registrazione, con il contatore dei byte) e il reinvio del codice (stesso
  componente, stesso endpoint di "password dimenticata"). A successo la sessione si chiude e si va all'accesso con l'avviso verde.
- **Form:** gli errori dei campi compaiono all'invio e poi si aggiornano mentre si scrive; il pulsante si disattiva solo durante
  l'invio.
- **Colori:** solo variabili `--rs-*` e Bootstrap, nessun colore scritto nei componenti, per poterli cambiare a fine frontend da
  `tokens.css`.
- **Due colonne su desktop** per le pagine di accesso: rimandate a FE-12 come rifinitura finale.

### Motivazione

- Il piano chiede "validazioni come il backend": aggiungere campi o requisiti (termini senza una pagina dei termini) sarebbe
  inventare funzioni.
- Il prototipo di accesso è già approvato dallo studente (decisione 80): seguirlo evita di rifare le pagine.
- Salvare l'email nel browser o nell'indirizzo espone un dato personale per un vantaggio piccolo.
- La navigazione a tab e il footer si progettano insieme, perché sul telefono occupano lo stesso spazio in basso.

### Alternative scartate

- **Ripeti password e casella dei termini (come NoseY):** un campo in più sul telefono e un link a una pagina che non esiste.
- **Email in `sessionStorage` o in `?email=`:** dato personale nel browser, nella cronologia e nei log.
- **Attesa del reinvio salvata nel browser:** più precisa, ma salva l'ora dell'ultimo invio legata all'email.
- **Hamburger con le azioni dell'account (prima versione di questa decisione):** sostituito dalla navigazione del prototipo.
- **Navigazione e footer dentro FE-03:** la card passerebbe a circa 11 h mescolando layout e autenticazione.
- **Footer rimandato a FE-12:** lo spazio in fondo (paginazione) andrebbe rivisto dopo, in tutte le schermate.
- **Avviso di sospensione rosso, messaggi del browser per i campi vuoti:** non coerenti con il prototipo e con il resto dei form.

## Decisione 84: regole su nome e password (card F7-05, progettazione, sezioni 4.4, 6.4 e 6.5)

Ogni punto è stato proposto allo studente con considerazioni e raccomandazione, e approvato il 19 ottobre. Nata dal frontend
(decisione 83), che applica la stessa regola nel form.

### Scelta

- **Nome (`displayName`):** da 3 a 30 caratteri (era 2–50) in registrazione e in `PATCH /api/users/me`. La colonna
  `display_name` resta `varchar(50)`: nessuna migrazione. La ricerca utenti (`q`, 2–50) non cambia. Il minimo di 3 caratteri è
  una correzione dello stesso giorno (prima era 2): lo studente aveva chiesto 5 o 6, poi ha scelto 3 dopo aver visto cosa escludevano.
- **Password:** invariata, 8–72 caratteri e massimo 72 byte.
- **Emoji:** vietate nel nome e nella nuova password (registrazione e reset). Due annotazioni in `common/`:
  `@NoEmoji` (emoji grafiche, modificatori di colore, indicatori di bandiera, selettore U+FE0F, collante ZWJ U+200D; cifre, `#` e
  `*` restano ammessi; bloccati anche © ® ™, che Unicode tratta come emoji) e `@NoInvisibleChars` (caratteri di controllo,
  di formato e separatori di riga e paragrafo; gli spazi normali restano). Il nome le ha entrambe, la password solo la prima.
- **Messaggi dei campi:** "non può contenere emoji" e "non può contenere caratteri invisibili".
- **Solo alla scrittura:** non si applicano a login, verifica e `SuperadminBootstrap`, e gli utenti già presenti non sono toccati
  (la regola non è retroattiva; il database non aveva dati veri).
- **Test:** i test del limite dei 72 byte (registrazione e reset) usano 40 "è" (80 byte) invece di 30 emoji, perché le emoji
  sarebbero fermate dalla regola nuova e il test non proverebbe più il limite dei byte. Il login con 30 emoji resta 401
  `INVALID_CREDENTIALS` (test esistente).
- **Chat:** le emoji restano ammesse nei messaggi (FE-09b); la regola non la riguarda.

### Motivazione

- Le emoji nel nome non sono naturali e rendono le liste meno ordinate; i caratteri invisibili e l'inversione del testo
  permettono due nomi diversi che a vista sono uguali (travestimento di un altro utente), con lo stesso codice.
- 30 caratteri bastano ai nomi di gruppo e di locale più lunghi dei mock-up (27 caratteri); 20 e 25 ne tagliavano.
- 72 è il tetto tecnico di BCrypt, non una lunghezza richiesta: abbassarlo non dà sicurezza e impedirebbe le frasi lunghe.
- Validare solo alla scrittura non blocca il login di chi ha già un account.

### Alternative scartate

- **Massimo 20 o 25 caratteri per il nome:** taglierebbe nomi di gruppo reali.
- **Minimo di 5 o 6 caratteri per il nome:** con 6 non passerebbero "Mario", "Marco" o "Paolo"; con 5 resterebbero fuori "Luca",
  "Anna", "Mina" e nomi d'arte brevi come "Muse" e "Blur". Con 3 si blocca solo il nome da due lettere, tipico dei nomi scritti a caso.
- **Abbassare il massimo della password:** nessun guadagno di sicurezza, meno frasi lunghe.
- **Elenco di caratteri ammessi per il nome:** rifiuterebbe nomi legittimi con punteggiatura (AC/DC, "!!!").
- **Regola solo nel frontend:** una chiamata diretta all'API la aggirerebbe.
- **Regola anche su login e verifica:** bloccherebbe account già esistenti.
- **Ridurre la colonna a `varchar(30)`:** una migrazione con il rischio dei nomi già salvati, senza vantaggi.

## Decisione 85: navigazione a tab e colonna, footer a comparsa e informative (card FE-03b, progettazione, sezioni 4.4 e 6)

Ogni punto è stato proposto allo studente con alternative, pro, contro e raccomandazione, e approvato il 20 ottobre.

### Scelta

- **Cinque voci per tutti:** Eventi, Collab, Feed, Messaggi, Profilo, nell'ordine del prototipo, anche per l'anonimo. I percorsi sono quelli del piano: `/eventi`, `/collab`, `/feed`, `/chat`, `/profilo` (quindi "Messaggi" va a `/chat`). Eventi, Collab e Feed sono letture pubbliche del backend. **Messaggi e Profilo stanno già dietro `RequireAuth`** in questa card: l'anonimo va a `/accesso` e torna alla pagina richiesta; il backend risponde comunque 401 ai suoi endpoint. `/` rimanda a `/eventi` (la `HomePage` di FE-01 è stata tolta) e il logo porta a `/eventi`.
- **Pagine segnaposto:** le cinque pagine hanno i nomi di quelle vere del piano (`NearbyEventsPage`, `CollabBoardPage`, `FeedPage`, `ChatPage`, `ProfilePage`) e mostrano titolo e "Questa sezione arriva presto." (`ComingSoon`): le card successive le sostituiscono nello stesso file.
- **Tre forme della navigazione:** sotto 768 px barra in alto e tab in basso; da 768 a 1199 px colonna stretta (4,5 rem) con la scritta sotto l'icona e barra in alto su tutta la larghezza; da 1200 px colonna larga (15 rem) a tutta altezza con il logo, e barra a destra di essa. Niente menu a scomparsa. La forma tab/colonna la sceglie `useMediaQuery`, tra colonna stretta e larga solo il CSS.
- **Barra in alto:** logo (non su desktop, dove sta nella colonna), titolo della pagina da `handle.title` della rotta (da 768 px), campanella solo per chi ha la sessione, nome accanto al cerchio solo su desktop. **La campanella è visibile ma disattivata** (nome "Notifiche") finché FE-09b non la collega. **Niente icona dei filtri** del prototipo: la aggiunge FE-05 con il pannello.
- **Bagliore da palco (decisione 80):** resta sulla barra in alto su desktop e sul corpo a tablet; la colonna è piatta, come nel prototipo.
- **Icone di Animate UI (Lucide animate):** pacchetti `@animate-ui/react` e `motion`; i file delle icone (calendario, persone, pila di fogli, messaggio, profilo, campanella) stanno in `src/components/animate-ui/icons/` e sono adattati (senza `'use client'`, senza l'import di React inutilizzato, con la regola `react-refresh/only-export-components` disattivata nel file). Per il feed è `layers`: `newspaper` non esiste nel registro. Un `components.json` minimo, scritto a mano e senza Tailwind, serve solo alla CLI di shadcn per le icone future.
- **Footer a comparsa:** sale dal basso quando la pagina è scrollata in fondo (o subito se non scorre) e scende risalendo; nascosto è `inert`. **Le tab restano ferme**: sul telefono il footer esce da dietro la barra e si ferma sopra di essa (modifica di un dettaglio della decisione 83, dove le tab salivano sopra il footer). Voci: "Informativa privacy" e "Informativa cookie" (pagine vere), "Copyright" e "Termini di servizio" (segnaposto senza indirizzo, `aria-disabled`; i testi si scrivono in FE-12). Il footer c'è anche nelle pagine di accesso, registrazione, verifica e reset.
- **Spazio riservato:** il contenuto lascia in fondo l'altezza del footer e, sul telefono, anche quella delle tab (token `--rs-footer-height`, `--rs-tabbar-height`, `--rs-topbar-height`), così nulla copre l'ultimo elemento né la paginazione.
- **Informative:** due pagine vere, `/informativa-privacy` e `/informativa-cookie`, con i testi approvati dallo studente il 20 ottobre (il piano ne prevedeva una sola). Il testo dice "progetto in sviluppo", non "non commerciale", e avvisa che i link ai biglietti portano a siti esterni (l'app non vende biglietti). Il contatto è un segnaposto, `PRIVACY_CONTACT = 'privacy@resonance.example'` in `src/config.ts`, da sostituire prima di una consegna reale. I testi non sono rivisti da un avvocato.

### Motivazione

- Il prototipo ha la navigazione a tab e a colonna: seguirlo è la scelta del 19 ottobre. Le stesse voci per tutti mostrano cosa offre l'app anche a chi non ha l'account.
- La guardia sulle due rotte riservate ora evita che le card successive debbano ricordarsela; il backend resta la protezione vera.
- Le tab ferme evitano che i controlli principali si spostino sotto il pollice quando compare il footer.
- Il footer anche nelle pagine di accesso permette di leggere le informative prima di dare email e password.
- Le due informative separate tengono la pagina dei cookie breve e verificabile (un solo cookie, `resonance_refresh`).

### Alternative scartate

- **Voci diverse per l'anonimo (solo tre):** la barra cambierebbe forma tra anonimo e loggato.
- **Tab non cliccabili o al "non trovato" in attesa delle pagine:** non si proverebbero la voce attiva e la guardia.
- **SVG scritti a mano o `lucide-react`:** più semplici, ma senza l'animazione scelta dallo studente.
- **`shadcn init` completo:** poteva aggiungere Tailwind, vietato dalla decisione 79.
- **Tab che salgono sopra il footer (decisione 83 originale):** le tab si spostano di colpo e i link finiscono vicino alla barra dei gesti.
- **Footer con pulsante "Info" o fisso a fine contenuto:** contraddicono "a comparsa a fondo pagina".
- **Colonna di una sola forma (larga o stretta):** diversa dal prototipo.
- **Icona dei filtri disattivata subito:** un pulsante finto senza pannello da aprire.

## Decisione 86: profilo, posizione, ruoli e schede dei contenuti nel frontend (card FE-04, progettazione, sezioni 5.3 e 6.5)

Ogni punto è stato proposto allo studente con alternative, pro, contro e raccomandazione, e approvato il 20 ottobre.

### Scelta

- **Profilo e area personale in una sola pagina, come nel prototipo Stitch:** `/profilo` mostra la scheda (foto o iniziale, nome, ruoli, città, bio, «Modifica profilo») e sotto le schede dei contenuti (`AreaTabs`); `/profilo/modifica` ha il form dei dati, la posizione e i ruoli. **La rotta `/area-personale` del piano non esiste** e `PersonalAreaPage` non viene creata. Il profilo pubblico è `/utenti/:id`.
- **Schede (`areaTabs.tsx`):** registro `{key, title, roles?, element}`; Concerti (HOST), Indie event (MUSICIAN), Annunci (MUSICIAN), Post (tutti), ognuna con «Questa sezione arriva presto.» finché FE-06, FE-07 e FE-08 non sostituiscono `element`. I ruoli servono a mostrare o nascondere: gli elenchi `/mine` non richiedono ruoli (decisione 77).
- **`PATCH /api/users/me` con i soli campi cambiati (decisione 31):** dopo il trim, stringa vuota per svuotare `bio`, `city` e `avatarUrl`, il nome non si invia mai vuoto; avatar solo `http` o `https` (`isHttpUrl`). La regola del nome è `displayNameError` di `features/auth/validation.ts`, ora esportata. «Salva» è spento finché non c'è una modifica; a salvataggio riuscito si torna a `/profilo` con l'avviso «Profilo aggiornato.» (segno nello stato del router, non nell'URL).
- **Pulsanti primari spenti:** grigio scuro (`--rs-color-border`) con testo grigio (`--rs-color-text-muted`), senza opacità, per **tutti** i pulsanti `btn-primary` (anche «Entra» mentre invia).
- **Foto del profilo:** se l'indirizzo manca o non si carica, il cerchio mostra l'iniziale del nome (`Avatar`, usato anche dal menu utente).
- **Posizione (decisione 30):** `useBrowserPosition` chiede la posizione solo al clic; il `PATCH` invia latitudine e longitudine insieme, **arrotondate a 2 decimali** (circa 1 km); «Smetti di condividere» usa `DELETE /api/users/me/location`. Le coordinate non si mostrano mai: l'interfaccia dice solo se la posizione è condivisa. Messaggi per permesso negato e posizione non trovata.
- **Ruoli (decisione 53):** una scheda per ruolo che spiega cosa sblocca e dice che non si può disattivare; **un solo clic, senza finestra di conferma**. A ruolo attivo il pulsante sparisce e resta il collegamento a ciò che si può pubblicare.
- **Menu utente:** «Pubblica concerto» (HOST) e «Pubblica indie event» (MUSICIAN), con pagine segnaposto `/concerti/nuovo` e `/indie/nuovo` dietro `RequireRole`, che FE-06 sostituisce. Post e annunci aggiungeranno le loro voci con FE-07 e FE-08.
- **Avviso di accesso richiesto:** `RequireAuth` aggiunge `loginRequired: true` allo stato del router e `LoginPage` mostra «Devi eseguire l'accesso per vedere questi contenuti.» solo in quel caso (non aprendo `/accesso` direttamente, e non passa alla registrazione). Vale per Messaggi, Profilo, la pubblicazione degli eventi e ogni pagina protetta futura.
- **Profilo pubblico aperto agli anonimi**, come `GET /api/users/{id}`; un utente inesistente o non verificato dà «Utente non trovato.». **La regola «un anonimo vede solo i profili degli autori di contenuti pubblicati» è rinviata a Post-V1** (progettazione, sezione 15): richiede un cambiamento del backend. Intanto gli id sono UUID non indovinabili, la ricerca utenti richiede il login e il profilo pubblico non mostra mai email né coordinate.
- **Controllo visivo a 375, 430, 768, 1024 e 1280 px** (telefono, telefono grande, i due estremi del tablet e il desktop più stretto); i breakpoint del CSS restano quelli della decisione 85.

### Motivazione

- Il prototipo ha un solo profilo con le schede sotto; la pagina di modifica separata tiene il form comodo sul telefono e lascia la scheda pulita.
- Il grigio spento non si scambia per un errore (il rosso) né per un pulsante attivo (lo stesso grigio chiaro, solo sbiadito).
- Due decimali bastano per cercare eventi a 5-100 km e non salvano la posizione esatta di casa.
- Il ruolo è gratuito e senza effetti dannosi: una conferma aggiungerebbe solo attrito.
- Un solo guard (`RequireAuth`) dà l'avviso a tutte le pagine protette senza ripeterlo.

### Alternative scartate

- **Due pagine come nel piano (`/profilo` e `/area-personale`):** due passaggi per vedere il proprio profilo.
- **Finestra di conferma per i ruoli:** attrito e un componente in più (`ConfirmDialog` nasce in FE-06).
- **Voci «Pubblica» solo logiche e nascoste:** il criterio non si vedrebbe in questa card.
- **Coordinate esatte:** nessun vantaggio per il raggio degli eventi.
- **Pulsante spento con lo stesso colore sbiadito (quello di Bootstrap) o rosso:** il primo sembra ancora attivo su sfondo scuro, il secondo sembra un errore.
- **Profilo pubblico dietro il login:** filtro solo nell'interfaccia, il backend resta pubblico e l'anonimo non vedrebbe chi ha scritto un annuncio.
- **Regola «solo autori» subito:** nuova card di backend (circa 2-3 ore) senza margine nel calendario.

## Decisione 87: eventi vicini, mappa e dettagli nel frontend (card FE-05, progettazione, sezioni 6.6 e 10.2)

Ogni punto è stato proposto allo studente con alternative, pro, contro e raccomandazione, e approvato il 20 ottobre.

### Scelta

- **Due schede, non un elenco misto:** `/eventi` ha le schede «Ufficiali» e «Indie», ognuna con il suo endpoint, la sua paginazione e il suo «Carica altri» (come nel piano). Il mock-up Stitch mostra un solo elenco «Tutti»: qui diverge. I nomi nell'interfaccia sono «Ufficiali» e «Indie» (non «Concerti»: anche un indie event è un concerto); i percorsi restano `/concerti/:id` e `/indie/:id`.
- **Scheda e raggio nell'indirizzo** (`?tipo=indie&raggio=25`): «Indietro» dal dettaglio ritrova scheda e raggio, e il link si condivide. I valori iniziali (Ufficiali, 15 km) non si scrivono; un raggio che non è uno dei livelli 5-15-25-50-100 torna a 15.
- **Centro della ricerca:** la posizione del browser solo dopo il clic su «Usa la mia posizione» (coerente con FE-04 e la decisione 30; nessuna richiesta di permesso a sorpresa e nessuna Permissions API), altrimenti le coordinate del profilo, altrimenti Firenze con un avviso. La posizione del browser resta nella pagina: uscendo si perde e il browser la rida subito dalla sua cache (5 minuti).
- **Mappa neutra all'apertura:** con il centro predefinito (Firenze) la ricerca usa Firenze e il raggio scelto, ma la mappa parte con zoom 5 (l'Italia dall'alto); quando arrivano i risultati si avvicina al raggio. Con un errore resta sull'Italia.
- **Mappa:** MapLibre GL, react-map-gl e lo stile scuro di OpenFreeMap, con cerchio giallo tratteggiato del raggio; il clic (o Invio) su un marker apre un fumetto con titolo, distanza e link «Dettagli» ed evidenzia la card. Provata sotto la CSP di `vite preview` (worker come file): nessuna violazione.
- **«Pubblica» fuori da FE-05:** il pulsante del mock-up arriva con FE-06.
- **Skeleton:** un solo componente condiviso (`Placeholder` di React Bootstrap), che compare dopo 200 ms, con `aria-busy` e il testo «Caricamento in corso»; usato nell'elenco e nel dettaglio degli eventi. Avatar e profilo pubblico restano come sono.
- **Descrizione dell'evento:** testo semplice con a capo (CSS `pre-wrap`, escape di React) finché FE-07 non crea `UserText`, che la sostituirà.
- **`ExternalLink`:** un pulsante, non un `<a>`; il clic apre «Stai uscendo da Resonance» con il dominio vero (anche con `utente@` davanti all'indirizzo) e solo «Continua» apre la nuova scheda con `noopener,noreferrer`. Un indirizzo che non è `http`/`https` resta testo inerte; nel dettaglio il biglietto non compare affatto.
- **Evento non trovato:** un 404 con codice `NOT_FOUND` (nascosto, inesistente, bozza di un altro) mostra una pagina dedicata «Evento non trovato» con «Torna agli eventi»; gli altri errori mostrano il messaggio con «Riprova».
- **Formati:** data in ora locale «ven 23 ott · 21:30» (nel dettaglio «venerdì 23 ottobre 2026 · 21:30»); distanza «3,2 km» con la virgola, sotto il chilometro in metri («800 m»).
- **Dettaglio:** copertina (solo se `http`/`https`) con riquadro di caricamento, senza `Referer`, che sparisce se non si carica; etichetta «Bozza» per il proprietario di una bozza; titolo della barra «Evento» per entrambe le pagine.
- **Testi dell'interfaccia** approvati nella bozza proposta (titoli, avvisi, stati vuoti, conferma d'uscita), con «Ufficiali» al posto di «Concerti».

### Motivazione

- Le due schede tengono semplice la paginazione (nessuna fusione lato client di due endpoint) e restano nelle 4 ore della card.
- L'indirizzo come stato rende la navigazione prevedibile (Indietro, link) senza uno slice in più.
- La posizione del browser solo con il clic rispetta la scelta di FE-04: nessuna richiesta di permesso a sorpresa.
- La mappa sull'Italia rende l'aspetto neutro, mentre la ricerca resta su un centro vero: il backend non cerca «in tutta Italia» (raggio massimo 200 km, centro obbligatorio).
- Un indirizzo esterno scritto da un utente non si apre mai senza conferma né con uno schema diverso da `http`/`https` (progettazione, sezione 4.13).

### Alternative scartate

- **Elenco misto «Tutti / Ufficiali / Indie»:** fusione lato client di due endpoint e «Carica altri» ambiguo, circa +1 ora.
- **Posizione automatica (se il permesso c'è già, o sempre):** Permissions API con comportamenti diversi fra browser, oppure una richiesta di permesso a sorpresa che molti rifiutano.
- **Stato solo nella pagina:** dopo il dettaglio si tornerebbe a Ufficiali e 15 km.
- **Nessuna ricerca finché non si sceglie il centro:** pagina vuota all'inizio, in contrasto con il criterio della card.
- **Fumetto sostituito dalla navigazione diretta al dettaglio:** un clic per sbaglio cambia pagina e non si vede quale card è.
- **`UserText` anticipato:** esce dalla card.
- **Pagina «Pagina non trovata» generica per gli eventi:** link verso la home e testo non specifico.
- **Skeleton anche su Avatar e profilo pubblico, o solo «Caricamento…»:** il primo tocca file di FE-04 in un giorno già pieno, il secondo fa lampeggiare l'elenco.

## Decisione 88: pubblicazione, bozze e cancellazione degli eventi nel frontend (card FE-06, progettazione, sezioni 6.6 e 10.1)

Ogni punto è stato proposto allo studente con alternative, pro, contro e raccomandazione, e approvato il 20 ottobre.

### Scelta

- **Data con offset:** il campo `datetime-local` è l'ora locale senza fuso; il form la converte con `new Date(valore).toISOString()` e invia l'istante in UTC (suffisso `Z`, Review Focus 5). Mai `"2026-10-21T21:00"`, che il backend rifiuta sul campo `eventDate` (decisione 56).
- **Attesa della geocodifica senza timeout nel client:** mentre il backend risponde (fino a circa 15 s: 10 s di coda più il timeout di Nominatim, decisione 76) il pulsante dice «Sto cercando l'indirizzo…» ed è spento, e i campi sono fermi. Il backend risponde sempre, al più con 502 `GEOCODING_UNAVAILABLE`, quindi nessuna richiesta viene annullata a metà.
- **Errori:** `ADDRESS_NOT_FOUND` e `VALIDATION_ERROR` si mostrano sotto il campo indicato da `fields` (l'errore sparisce appena si cambia quel campo); `GEOCODING_UNAVAILABLE` e `TOO_MANY_REQUESTS` sono un avviso in cima, con il form intatto e riinviabile.
- **Generi a chip:** Invio aggiunge il genere scritto (senza spazi ai bordi, minuscolo, senza doppioni, 1–30 caratteri, al massimo 10), «×» lo toglie; Invio nel campo non invia il form.
- **Pulsanti:** «Cancella» nella scheda e nel dettaglio, solo per il proprietario; «Pubblica» solo nella scheda e solo per le bozze. Nel form dell'indie event «Pubblica» è il pulsante principale e «Salva come bozza» il secondario; «Ingresso gratuito» parte spento.
- **Dopo il salvataggio:** concerto, indie event pubblicato e bozza aprono il dettaglio. Dopo una cancellazione dal dettaglio si torna a `/profilo` con l'avviso «Evento cancellato.» (segno nello stato del router, come «Profilo aggiornato.»).
- **Schede dell'area personale:** riga compatta nuova (data, etichette «Bozza» e «Concluso», titolo che porta al dettaglio, locale, azioni). Un avviso breve dice l'esito («Evento pubblicato.», «Evento cancellato.») e l'elenco si rilegge; gli errori (`EVENT_DATE_PAST`, `EVENT_ALREADY_PUBLISHED`, `NOT_OWNER`) mostrano il messaggio del loro codice. Scheda vuota: «Non sono ancora presenti eventi pubblicati.» con «Pubblica evento».
- **Conferma di cancellazione:** `ConfirmDialog` con titolo «Cancellare l'evento?», testo «L'evento non sarà più visibile a nessuno. L'operazione non si può annullare.», campo «Motivo (facoltativo)» (massimo 500, come `OwnerDeleteRequest`) e pulsanti «Cancella evento» e «Annulla». Senza motivo il `DELETE` non ha body.
- **Form in una colonna**, come «Modifica profilo»; testi dei form approvati nella bozza proposta (titoli «Pubblica concerto» e «Pubblica indie event», etichette, aiuti e messaggi dei campi).
- **File in più rispetto al piano:** `components/ui/DateTimeField.tsx`, `GenreInput.tsx`, `EventFormFields.tsx` (campi comuni ai due form) e `MyEventRow.tsx` (la riga), con i loro test.
- **Controllo visivo a 375, 768, 900 e 1280 px** (telefono, tablet, desktop piccolo e desktop), al posto delle tre larghezze del piano e delle cinque della decisione 86; i breakpoint del CSS restano quelli della decisione 85.
- **Modifica dei propri contenuti:** non esiste nell'MVP (progettazione, sezione 1, P7); è registrata in Post-V1 (sezione 15). Per correggere un evento si cancella e si ricrea.

### Motivazione

- L'istante in UTC è la stessa forma che il backend restituisce e che il browser sa leggere in qualunque fuso; un offset scritto a mano cambierebbe con l'ora legale e darebbe lo stesso istante con più codice.
- Annullare la richiesta nel client non annulla il lavoro del backend: l'evento potrebbe essere salvato lo stesso e un secondo invio creerebbe un doppione.
- I chip evitano gli errori di battitura nei separatori e mostrano subito come il backend leggerà i generi.
- «Pubblica» solo nella scheda rispetta il piano; la bozza si apre dal dettaglio solo per guardarla.
- Dopo una cancellazione il dettaglio non esiste più (sarebbe un 404): `/profilo` ha l'elenco aggiornato.
- Una riga compatta è più adatta di una card a un elenco di gestione, dove contano stato e azioni.

### Alternative scartate

- **Offset locale scritto a mano (`+02:00`):** più codice e stesso istante.
- **Annullare la richiesta dopo 20 s nel client:** rischio di doppioni se l'utente riprova.
- **Generi in un campo separati da virgola:** meno codice (30–40 min in meno), ma meno chiaro.
- **«Pubblica» anche nel dettaglio:** 15 minuti in più e un'azione da testare, fuori dal piano.
- **Dopo la bozza tornare alla scheda:** due destinazioni diverse a seconda del pulsante premuto.
- **Dopo la cancellazione andare a `/eventi`:** nessuna conferma dell'esito e la bozza non compare lì.
- **`EventCard` riusata nelle schede:** richiede di adattarla (distanza assente, azioni) per un elenco di gestione.
- **Due colonne da 768 px:** più CSS e più prove, non richiesto dal piano.

## Decisione 89: feed, like e testo degli utenti nel frontend (card FE-07, progettazione, sezioni 6.8 e 8.6)

### Scelta

- **`UserText` solo sui testi lunghi:** bio, descrizione degli eventi e corpo dei post. Titoli, nomi, locali e generi
  restano testo semplice. Nel testo l'indirizzo `http`/`https` si legge **com'è scritto**, a capo se lungo; la
  punteggiatura finale (`. , ; : ! ?` e `)`) resta testo e non fa parte del link. Gli a capo li tiene lo stile
  (`white-space: pre-line`).
- **Filtro «Vicino a me» nell'indirizzo** (`/feed?vicino=1&raggio=25`), come Eventi vicini; centro e livelli del raggio
  vengono da `useSearchCenter` e `RadiusSelector`, che passano da `features/events/` a `hooks/` e `components/ui/`
  (regola della struttura: ciò che serve a più aree sta fuori da `features/`).
- **Nuovo post:** da 768 px il modulo sta in cima al feed; su telefono c'è il pulsante «Nuovo post» che apre una
  finestra, chiusa a pubblicazione riuscita. Un anonimo legge l'invito ad accedere e, dopo l'accesso, torna al feed.
- **Posizione facoltativa del post:** casella «Aggiungi la mia posizione»; si prova il GPS del browser, poi le
  coordinate del profilo, poi niente, e in ogni caso un avviso dice che cosa è successo.
- **Immagine del post:** solo l'indirizzo (l'upload resta in Post-V1, progettazione sezione 15). Nel post è un `<img>`
  senza `Referer`, con caricamento differito, che sparisce senza lasciare un buco se non si carica. Nel modulo, se il
  browser non riesce a caricare l'indirizzo (per esempio una pagina di ricerca invece del file), un avviso sotto il
  campo lo dice: «Non riesco a caricare l'immagine: controlla l'indirizzo.» La prova parte 600 ms dopo l'ultimo tasto,
  senza `Referer`, e non blocca la pubblicazione (aggiunta il 21 ottobre dopo la prova in locale).
- **Cancellare un proprio post:** conferma semplice, **senza motivo** (in FE-06 per gli eventi il motivo c'è): è un
  contenuto proprio e il motivo serve a chi legge quando a cancellare è un admin.
- **Elenchi a pagine:** una voce di cache per pagina, come `MyEventsTab`; dopo una creazione o una cancellazione si
  rileggono le pagine aperte. Il like cambia subito il post in tutte le voci dove compare (feed e scheda «Post»), a
  risposta arrivata prende i numeri del server e con un errore torna com'era.
- **Scheda «Post» dell'area personale:** le stesse card del feed (like e «Cancella»).
- **Testi dell'interfaccia** approvati dallo studente il 21 ottobre; data del post in forma breve (dal 21 ottobre tutta in numeri, «21/10/2026», decisione 90).

### Motivazione

- Titoli e nomi stanno dentro un `Link`: un collegamento dentro un collegamento è HTML non valido.
- Mostrare l'indirizzo com'è scritto fa vedere dove porta il link; la punteggiatura finale è quasi sempre del testo.
- Il filtro nell'indirizzo fa ritrovare lo stato con «Indietro» e riusa la logica già provata in FE-05.
- Il modulo in pagina da 768 px tiene il testo a portata di mano; la finestra su telefono evita un feed allungato.
- Il GPS dice dove si trova davvero l'utente; il profilo evita di perdere la posizione se il permesso è negato.
- Una voce di cache per pagina evita i doppioni che un accodamento con `merge` produrrebbe dopo una rilettura.

### Alternative scartate

- **`UserText` anche su titoli e nomi:** collegamenti annidati da gestire con casi speciali.
- **Solo il dominio come etichetta del link:** l'utente non vede il percorso.
- **Il link arriva fino al primo spazio:** `https://example.com.` porterebbe a un indirizzo con il punto in fondo.
- **Stato del filtro solo nella pagina:** tornando dal profilo di un autore si perde.
- **Modulo sempre in una finestra, o in una pagina `/feed/nuovo`:** più passaggi per un testo breve.
- **Solo GPS o solo profilo per la posizione:** si perde la posizione nei casi che l'altra fonte copre.
- **Motivo facoltativo nella cancellazione:** un campo in più che l'autore non sa perché compilare.
- **Upload delle immagini:** richiede endpoint, controllo dei byte, storage esterno e CSP; fuori dall'MVP (sezione 15).
- **Solo link «Apri immagine»:** un feed senza immagini visibili.
- **Avviso sull'immagine rotta solo nel post, o sia nel modulo sia nel post:** chi scrive lo scoprirebbe dopo la
  pubblicazione; il doppio avviso raddoppia i comportamenti da provare.
- **Una sola voce di cache con `merge`:** dopo una rilettura accoda l'ultima pagina e duplica i post.
- **Riga compatta di sola lettura nella scheda «Post»:** secondo componente senza like né immagine.
- **Importare `useSearchCenter` e `RadiusSelector` da `features/events/`:** dipendenza fra due aree contro la regola della struttura.

## Decisione 90: bacheca collab, candidature e scheda «Annunci» nel frontend (card FE-08, progettazione, sezioni 6.7 e 6.9)

### Scelta

- **Percorsi:** `/collab/:id` per il dettaglio (aperto a tutti, anche se l'annuncio è chiuso) e `/collab/nuovo` per la
  creazione, riservata ai MUSICIAN con `RequireRole` come `/indie/nuovo`. In `routes.ts`: `ROUTES.collabPost`,
  `ROUTES.newCollab`, `collabPath(id)` e `chatPath(conversationId)`.
- **Bacheca senza filtri:** solo l'elenco degli annunci aperti dal più recente con «Carica altri» (il mock-up mostra
  anche «Sale prove» e i chip degli strumenti, ma l'API non ha filtri). Sottotitolo «Annunci per progetti, musicisti e
  collaborazioni.» (senza «in zona»: la bacheca non filtra per zona). «Pubblica annuncio» e l'invito dello stato vuoto
  solo ai MUSICIAN. Ogni card ha «Candidati / Scrivi», che porta al dettaglio; la bacheca non mostra mai annunci chiusi,
  quindi la card non ha un caso «chiuso».
- **Candidatura nel dettaglio:** il modulo (messaggio 1–1800 con contatore, «Invia candidatura») sta solo nel dettaglio.
  Non compare sul proprio annuncio; su un annuncio chiuso lo sostituisce «L'annuncio è chiuso e non accetta più
  candidature.» (non mostrato al proprietario, che vede «Chiuso»). Un anonimo vede il modulo e, all'invio, va
  all'accesso e poi torna alla stessa pagina, come per il «Mi piace» del feed. A 201 il modulo lascia il posto a
  «Candidatura inviata. Puoi continuare la conversazione in chat.» con il link «Apri la chat» verso
  `/chat/:conversationId`: la pagina nasce in FE-09b, fino ad allora il link porta a «Pagina non trovata». Gli errori
  `COLLAB_CLOSED`, `CANNOT_APPLY_OWN_POST` e `TOO_MANY_REQUESTS` mostrano i testi già in `errorMessages.ts` e il
  messaggio scritto resta.
- **Chiusura e cancellazione, nel dettaglio e nella scheda «Annunci», con la stessa conferma:** «Chiudi annuncio» ha una
  conferma che avvisa dell'effetto sulla chat («Dopo la chiusura nessuno potrà più candidarsi. Chi non è tuo amico non
  potrà più scriverti in chat: se vuoi continuare una conversazione, prima aggiungilo agli amici.»), perché lo sblocco
  dura finché l'annuncio è aperto (sezione 6.9) e il backend non ha la riapertura (decisione 60); «Cancella» ha la
  conferma con il motivo facoltativo, come gli eventi. Dal dettaglio una cancellazione riuscita porta al profilo con
  l'avviso «Annuncio cancellato.» (stato di navigazione `collabDeleted`, come `eventDeleted`).
- **Scheda «Annunci»:** ogni riga mostra data, stato «Aperto» o «Chiuso», titolo, ruolo cercato e le azioni «Apri»
  (collegamento al dettaglio), «Chiudi» (solo se aperto) e «Cancella»; il titolo non è un collegamento per non averne
  due verso lo stesso posto. Avvisi «Annuncio chiuso.» e «Annuncio cancellato.»; elenco vuoto «Non hai ancora
  pubblicato annunci.» con «Pubblica annuncio». Una voce di cache per pagina, come `MyEventsTab`.
- **Generi condivisi:** `GenreInput` passa da `features/events/components/` a `components/ui/`; `addGenre`, `GENRE_MAX`
  e `GENRES_MAX` passano da `eventForm.ts` a `lib/genres.ts` con i loro test (regola della struttura: ciò che serve a
  più aree sta fuori da `features/`).
- **Data breve tutta in numeri, con lo zero:** `formatDate` scrive «21/10/2026» e «05/11/2026» invece di «21 ott 2026».
  Vale per la card del feed e per la fine della sospensione (decisioni 85 e 89); le date degli eventi restano a parole
  («ven 23 ott · 21:30», «venerdì 23 ottobre 2026 · 21:30») perché il giorno della settimana aiuta a scegliere.
- **Uscite dal dettaglio, per tutti:** in fondo al dettaglio, dopo la pubblicazione e sempre, «Torna su Collab» (alla
  bacheca) e «Torna alla home» (a `/`, che porta agli Eventi vicini). Dicono all'utente che la creazione è finita e che
  è sul dettaglio dell'annuncio; li vedono anche anonimi e altri utenti, mentre «Chiudi annuncio» e «Cancella» restano
  solo al proprietario. Dopo la creazione il dettaglio resta la pagina d'arrivo, come per gli eventi.
- **Animazione delle icone sulla voce intera:** nella colonna a sinistra e nelle tab del telefono (FE-03b) l'icona
  animata parte ora quando il mouse entra nella voce o la si tocca, anche sulla scritta, e non solo sull'icona di 22 px
  (`AnimateIcon` con `asChild` attorno a `NavLink`). Prima sembrava in ritardo (segnalato dallo studente il 21 ottobre).
  Nei test `matchMedia` non dice più «riduci animazioni» per ogni query senza larghezza (`test/viewport.ts`).
- **Cursore sul primo campo sbagliato:** dopo un invio con errori (del client o dei campi del server) i moduli «Pubblica
  annuncio», «Pubblica concerto» e «Pubblica indie event» portano il cursore e lo schermo sul primo campo con
  `aria-invalid` (hook `useFocusFirstInvalid`). Senza, sul telefono «Pubblica» sta in fondo e l'errore in cima resta fuori
  dallo schermo: sembra che non succeda niente (riprodotto in Edge a 375 px, segnalato dallo studente il 21 ottobre).
- **Generi a chip senza spostamenti:** l'elenco dei chip c'è sempre e riserva l'altezza di una riga. Prima la prima card
  faceva scorrere «Pubblica» mentre il clic toglieva il focus al campo dei generi, e il clic andava a vuoto (ne servivano
  due). Il genere scritto si aggiunge già con Invio o uscendo dal campo.
- **Un solo occhio nel campo password:** `index.css` nasconde l'occhio che Edge aggiunge da solo (`::-ms-reveal`) nei
  campi `.rs-password`, perché c'è già il pulsante «Mostra la password» di `PasswordField` (correzione alla pagina di
  accesso di FE-03, chiesta dallo studente il 21 ottobre; un test controlla che la regola esista).
- **Funzioni future** registrate in `progettazione.md`, sezione 15 (Post-V1): filtri della bacheca per ruolo o
  strumento (servono parametri nell'API) e candidature con accettazione o rifiuto dell'autore (servono una tabella con
  lo stato, endpoint, notifiche e migrazione; l'accettazione potrebbe tenere lo sblocco della chat anche dopo la
  chiusura).
- **Altre funzioni future** (segnalate dallo studente il 21 ottobre, tutte in `progettazione.md`, sezione 15):
  elenco di generi da scegliere a chip (solo frontend), carosello degli eventi principali (Post-V1) e titolo nei post del
  feed (candidato alle rifiniture, FE-12, se avanza tempo; richiede una modifica al backend).
- **Suggerimento degli indirizzi** (segnalato dallo studente il 21 ottobre): non nell'MVP, registrato in Post-V1 con la
  stessa riga; si implementa solo se avanza tempo prima della consegna. Serve un endpoint nel backend (il frontend non
  può chiamare Nominatim: CSP e policy d'uso).
- **Testi dell'interfaccia** approvati dallo studente il 21 ottobre.

### Motivazione

- Un solo punto per la candidatura (il dettaglio) dà un solo modulo da mantenere e da provare, e tiene insieme le
  regole su proprio annuncio, annuncio chiuso e anonimo.
- Nel backend la candidatura non ha uno stato da accettare: l'autore la legge come messaggio in chat (decisione 24) e
  chiude quando vuole; l'avviso nella conferma evita la sorpresa dello sblocco che finisce con la chiusura.
- Il collegamento «Apri la chat» già nel piano di FE-08 evita di tornare su questa card dopo FE-09b.
- La data numerica è compatta e non si spezza su due righe sul telefono.
- I generi servono ora a eventi e annunci: importarli da `features/events/` creerebbe una dipendenza fra aree.

### Alternative scartate

- **Filtro dei chip nel browser:** filtrerebbe solo le pagine già scaricate, e «Sale prove» non è nei dati.
- **Tempo trascorso («2 h fa») al posto della data:** serve una funzione nuova con test che dipendono dall'ora.
- **Percorsi `/annunci/...`:** parola diversa dalla voce di menu «Collab», senza vantaggi.
- **Modulo di candidatura in una finestra sopra la bacheca:** due punti da mantenere; su telefono è più scomodo.
- **Solo l'avviso senza «Apri la chat» fino a FE-09b:** FE-09b dovrebbe tornare su FE-08 e il criterio della card non
  sarebbe soddisfatto.
- **Chiusura con un solo clic:** un clic sbagliato chiude l'annuncio per sempre.
- **Tornare alla bacheca o al profilo da sola dopo la creazione:** l'utente non vedrebbe l'annuncio appena pubblicato.
- **Scheda «Annunci» con il solo elenco e link:** più passaggi per chiudere o cancellare.
- **Importare `GenreInput` da `features/events/`:** dipendenza fra due aree contro la regola della struttura.
- **Data numerica senza zero («5/11/2026»):** la larghezza cambia da una data all'altra.
- **Tenere i due occhi o togliere il nostro:** il pulsante dell'app ha il testo accessibile e funziona in ogni browser; quello di Edge no.
- **Animazione solo sull'icona di 22 px:** il mouse sulla scritta non la fa partire e sembra in ritardo.
- **Chip dei generi che compaiono solo con il primo genere:** sposterebbero i pulsanti e il clic su «Pubblica» andrebbe a vuoto.
- **Lasciare ai moduli lo scorrimento del browser:** non arriva al campo in cima quando si preme «Pubblica» in fondo.
- **Date numeriche anche negli eventi:** nel dettaglio il giorno della settimana a parole si legge meglio.

## Decisione 91: amicizie, ricerca utenti e campanella nel frontend (card FE-09a, progettazione, sezioni 6.5 e 6.14)

### Scelta

Scelte dello studente, una per una, a inizio card:

- **Accesso:** la campanella e una voce «Amici» nel menu utente. La barra resta a 5 voci (decisione 83). Percorsi
  `/amici` (elenchi) e `/amici/cerca` (ricerca), in `routes.ts` come `ROUTES.friends`, `ROUTES.userSearch` e
  `friendsPath('ricevute' | 'inviate')`.
- **Schede nell'indirizzo:** `/amici?scheda=ricevute` o `?scheda=inviate`; senza parametro si apre «Amici». Serve a «Vedi
  tutte» della campanella e al ricarico. Un valore sconosciuto apre «Amici».
- **Ricerca nell'indirizzo:** il testo cercato sta in `?q=`, così «Indietro» dal profilo ritrova la ricerca. La chiamata
  parte 400 ms dopo l'ultimo tasto e con almeno 2 caratteri (spazi ai bordi esclusi); il campo accetta al massimo 50.
- **Campanella come pannello:** il clic apre un pannello con titolo «Notifiche» e una riga per richiesta ricevuta
  (Accetta e Rifiuta), non un semplice link. Il numero sopra l'icona va da 1 a «9+». Il pannello è pensato per ospitare in
  futuro altri tipi di notifica (notifiche live di FE-09b e oltre).
- **Una sola chiamata per numero e righe:** `GET /api/friendships?type=INCOMING&size=10`; il numero è `totalElements`. Il piano
  diceva `size=1` solo per il numero; con il pannello serve anche l'elenco.
- **Righe del pannello:** le 5 più recenti sotto i 768 px, le 10 più recenti da tablet in su; «Vedi tutte» (verso
  `/amici?scheda=ricevute`) solo se ci sono più richieste di quelle mostrate. Vuoto: «Nessuna richiesta in attesa.»
- **Ricarica senza polling:** all'apertura dell'app, all'apertura del pannello, al ritorno sulla scheda del browser e dopo ogni
  azione sulle amicizie. Il ritorno sulla scheda usa `setupListeners` in `store.ts` e `refetchOnFocus` solo sulla query della
  campanella; le altre liste non cambiano comportamento.
- **«Scrivi» spento:** nello stato `FRIENDS` il pulsante c'è ma è disattivato, con la nota «Disponibile a breve»; FE-09b lo
  attiva con `POST /api/chats` e il passaggio a `chatPath`. Il badge dei messaggi sull'icona Messaggi resta a FE-09b.
- **«Carica altri»** negli elenchi e nei risultati, come bacheca e feed. Nome e foto di ogni riga aprono il profilo
  pubblico `/utenti/:id`. Nessun pulsante dell'amicizia nel profilo pubblico: solo la ricerca restituisce lo stato.
- **Conferma scritta in cima alla pagina:** dopo un'azione riuscita compare una striscia, che sparisce dopo 4 secondi e si può
  chiudere. Testi: «Richiesta inviata», «Richiesta annullata», «Amicizia accettata», «Richiesta rifiutata», «Amicizia
  rimossa». `FRIEND_REQUEST_ALREADY_RECEIVED` non è un errore: la striscia dice «Questa persona ti ha già inviato una
  richiesta», la ricerca si ricarica e compare «Accetta».
- **Testi dell'interfaccia:** campo «Cerca per nome»; «Scrivi almeno 2 caratteri per cercare.»; «Nessuna persona trovata.»;
  pulsanti «Aggiungi», «Richiesta inviata» con «Annulla», «Accetta» e «Rifiuta», «Amici» con «Scrivi» e «Rimuovi», «Non
  disponibile» (spento); schede «Amici», «Ricevute», «Inviate»; elenchi vuoti «Non hai ancora amici.», «Nessuna richiesta
  ricevuta.», «Nessuna richiesta inviata.» con il link «Cerca persone»; rimozione con titolo «Rimuovere NOME dagli amici?» e
  testo «La chat resta leggibile, ma nessuno dei due potrà più scrivere. NOME non riceve nessun avviso.»; voce del menu «Amici».
- **`AvatarAmico` di NoseY non si porta:** il pallino «online» richiede la presenza degli utenti, che Resonance non ha.

### Motivazione

- Il pannello evita di riscrivere la campanella quando arriveranno altri tipi di notifica, e con una sola chiamata il numero e
  le righe non si possono contraddire.
- L'indirizzo che ricorda scheda e testo rende utili il tasto «Indietro» e il collegamento «Vedi tutte».
- L'attesa di 400 ms e il minimo di 2 caratteri evitano di consumare il limite `USER_SEARCH`, che conta anche le richieste non
  valide (decisione 64).
- Nessun polling: le notifiche live delle amicizie sono Post-V1 (decisione 59) e un aggiornamento periodico le imiterebbe.
- «Scrivi» spento evita di creare conversazioni che nessuno può ancora leggere.

### Alternative scartate

- **Campanella come semplice link a `/amici`:** va riscritta appena arriva un secondo tipo di notifica.
- **Due chiamate (numero con `size=1` e righe a parte):** due richieste da tenere allineate dopo ogni azione.
- **Sesta voce «Amici» nella navigazione:** contraddice le 5 voci della decisione 83 e stringe le tab del telefono.
- **Schede e testo di ricerca solo nello stato del componente:** la campanella non potrebbe aprire «Ricevute» e «Indietro»
  perderebbe la ricerca.
- **`setupListeners` scritto a mano nel componente:** codice nostro da mantenere al posto di quello della libreria.
- **«Scrivi» già collegato a `POST /api/chats`** o **nascosto:** la prima crea chat illeggibili, la seconda non distingue lo
  stato `FRIENDS`.
- **Messaggio di esito scritto nella riga:** la riga esce dalla lista dopo accettazione, rifiuto o rimozione e il messaggio
  sparirebbe con lei.
- **Caricamento automatico allo scorrimento:** codice nuovo, diverso dalle altre liste.

## Decisione 92: chat in tempo reale, notifiche e contatto degli eventi nel frontend (card FE-09b, progettazione, sezioni 6.9 e 7)

### Scelta

Scelte dello studente, una per una, a inizio card e durante il lavoro. Sostituisce in parte la decisione 91: «Scrivi» non è
più spento e la campanella non mostra più solo le richieste (testo del pannello vuoto, lista unica).

**Connessione STOMP**

- **Firma `startStomp(store)`:** il client riceve lo store (la tabella delle interfacce del piano diceva `startStomp()`).
  Serve a leggere il token corrente, chiudere la sessione per `ACCOUNT_SUSPENDED` e chiamare il refresh. I test usano uno
  store per prova, come per `useTokenRenewal`.
- **Una connessione finché la sessione è attiva:** la apre e la chiude `LiveNotifications`, montato in `AppShell`. Il token si
  legge a ogni tentativo (`beforeConnect`); riconnessione automatica ogni 5 secondi; a ogni connessione una sola SUBSCRIBE per
  ciascuna delle tre code, e più ascoltatori possono usare la stessa coda (`subscribe`).
- **Dopo ogni refresh la connessione si riapre** (`forceDisconnect`, poi stompjs si ricollega con il token nuovo): così dopo
  15 minuti di inattività il SEND non trova `TOKEN_INVALID` (Review Focus 7).
- **`TOKEN_INVALID`** (frame ERROR o coda errori): refresh; se riesce la connessione si riapre, se è rifiutato la sessione si
  chiude e il client si ferma.
- **`ACCOUNT_SUSPENDED`:** si chiama il refresh, che risponde 403 con motivo e data di fine; il codice di `doRefresh` chiude
  la sessione con l'avviso completo. Se il refresh non risponde la sessione si chiude comunque, senza motivo.
- **Dopo una riconnessione** (non la prima connessione) si ricaricano elenco delle conversazioni e storico aperto (`Chat` e
  `Messages`): i messaggi arrivati a connessione caduta non passano dal WebSocket (sezione 7.6, notifiche non salvate).
- **Indicatore dello stato** sopra la casella di scrittura («Connesso», «Connessione…», «Riconnessione…») e «Invia» spento se
  non si è connessi; fuori dalla chat non c'è un indicatore.

**Elenco delle conversazioni e badge**

- **Una sola chiamata `GET /api/chats?size=100`** (il massimo del backend) alimenta elenco, badge e ricerca; i messaggi in
  arrivo ne aggiornano la cache a mano, senza richiamare il server. Una conversazione che non è nell'elenco lo fa ricaricare.
- **Righe:** foto, nome (il collegamento, steso su tutta la riga), ora, ultimo messaggio da `UserText` con «Tu: » davanti se
  l'ha scritto chi guarda, numero dei non letti con accento giallo, lucchetto con «Chat bloccata» se `canSend` è falso (testo
  neutro, decisione 66). Senza messaggi «Nessun messaggio ancora». Niente pallino online, ruolo, filtro né «nuova chat» del
  mock-up Stitch: il backend non li ha.
- **Ricerca nell'elenco:** per nome sulle conversazioni già caricate, senza distinguere maiuscole e accenti, senza attesa e
  senza chiamate al server.
- **Badge dei messaggi** sull'icona Messaggi: somma degli `unreadCount`, da 1 a «9+» (come la campanella), nascosto a zero e
  per chi non ha la sessione; ai lettori di schermo dice il numero vero.

**Conversazione**

- **Impaginazione:** da 1200 px elenco e conversazione affiancati («Scegli una conversazione» se non ce n'è una aperta); su
  telefono e tablet un pannello alla volta. Una sola rotta `/chat/:id?` (`ROUTES.chatPage`), così il passaggio dall'elenco a
  una conversazione non rimonta la pagina.
- **Tab e footer nascosti dentro una conversazione** (`/chat/:id`, a ogni larghezza): il footer a comparsa salirebbe sopra la
  casella di scrittura, la conversazione prende tutta l'altezza sotto la barra in alto.
- **Intestazione:** freccia «Torna alle conversazioni» (solo dove c'è un pannello alla volta), foto e nome con il collegamento
  al profilo pubblico, «Chat bloccata» se non si può scrivere.
- **Storico a cursore:** 30 messaggi per volta, «Messaggi precedenti» in cima (`before` = id del più vecchio caricato). Le
  pagine si uniscono per id, dal più recente, senza doppioni; se dopo una lunga assenza la pagina nuova non tocca lo storico, si
  riparte dalla pagina nuova (nessun buco). Un messaggio ricevuto due volte compare una volta sola e non segna letto due volte
  (Review Focus 8).
- **Separatori di giorno** («Oggi», «Ieri», «sabato 18 ottobre») e ora sotto ogni messaggio; niente etichette «Nome • ora» di
  gruppo. I propri messaggi si riconoscono da `senderId`.
- **Spunte sui propri messaggi:** singola per «inviato» (salvato dal server), doppia colorata per «letto» (`readAt`),
  aggiornata solo quando i messaggi si ricaricano (apertura, riconnessione): il backend non avvisa quando l'altro legge. Il
  colore della doppia spunta è provvisorio (verde di successo), lo sceglie lo studente. Lo stato «recapitato» e la lettura in
  diretta sono nel Post-V1 (progettazione, sezione 15).
- **Lettura:** `PATCH .../read` all'apertura se ci sono non letti e a ogni messaggio dell'altro arrivato a conversazione aperta.
- **Casella di scrittura:** Invio manda, Maiusc+Invio va a capo, contatore «n / 2000», casella spenta con la nota «Al momento
  non puoi inviare messaggi a questa persona. Puoi rileggere la conversazione.» se `canSend` è falso (testo neutro).

**Invio**

- **Si aspetta l'eco del server:** il messaggio compare quando torna su `/user/queue/messages`, la stessa via del dedupe.
- **Segnaposto «Invio…»** (bolla con il testo sfumato) solo se l'eco non arriva entro 300 ms, così non lampeggia.
- **Se la connessione cade o passano 10 secondi senza eco** il segnaposto sparisce, il testo torna nella casella e compare
  «Messaggio non inviato: controlla la connessione e riprova.». Gli errori della coda (`VALIDATION_ERROR`,
  `TOO_MANY_REQUESTS`, `CHAT_LOCKED`) riportano il testo con il testo del loro codice; `CHAT_LOCKED` ricarica l'elenco e la
  casella si spegne. `TOKEN_INVALID` e `ACCOUNT_SUSPENDED` li gestisce il client e la chat non li mostra.

**Notifiche live**

- **Toast** in alto a destra con le classi del toast di Bootstrap (non il suo componente, che forza `role="alert"`; qui
  `role="status"`, letto senza interrompere): al massimo 3, 6 secondi, con la X; il clic apre il bersaglio (conversazione,
  annuncio; per un like il feed, perché non esiste una pagina del singolo post) e segna letta la notifica. Per una conversazione
  resta un solo toast. Un nuovo messaggio nella conversazione già aperta non crea né toast né voce.
- **Testi:** «NOME ha messo mi piace al tuo post», «NOME si è candidato al tuo annuncio», «Nuovo messaggio da NOME» con
  l'anteprima da `UserText`.
- **Campanella con una lista sola**, dalla più recente, di qualsiasi tipo: richieste di amicizia (data `updatedAt`) e
  notifiche della sessione (data `createdAt`). Righe: 5 sotto i 768 px, 10 da tablet in su, sulla lista unica; «Vedi tutte»
  compare se restano richieste fuori vista. Il numero somma le richieste in attesa e le notifiche non lette, da 1 a «9+».
  «Segna come lette» le segna tutte (solo le notifiche: le richieste restano finché non si accettano o si rifiutano), il clic su
  una voce segna solo quella. Vuota: «Nessuna notifica.».
- **Notifiche della sessione** (`notificationsSlice`): al massimo 20, solo in memoria, svuotate alla chiusura della sessione.
- **Conferme delle azioni in sovrimpressione** (cambia la decisione 91): la conferma di «Richiesta inviata» e simili non sta più
  in una striscia in cima alla pagina, che spostava gli elenchi sotto. È un riquadro in alto a destra, nella stessa zona dei toast
  (`ConfirmationBar` dentro `LiveNotifications`), largo quanto il testo; resta 4 secondi e si chiude con la X, come prima. Gli
  stessi testi.

**Contatto dell'organizzatore e «Scrivi»**

- **Modulo nella pagina** (`ContactOrganizer`), sotto il dettaglio di concerti e indie event, come la candidatura: titolo
  «Contatta l'organizzatore», campo «Messaggio per l'organizzatore» da 1 a 1800 con contatore, «Invia messaggio»; riuscito:
  «Messaggio inviato. Puoi continuare la conversazione in chat.» con «Apri la chat». Errori con i testi dei loro codici. Non
  compare per il proprio evento né per uno già iniziato (l'istante si prende al montaggio della pagina); un anonimo che invia
  passa dall'accesso e torna.
- **«Scrivi»** (stato `FRIENDS`): `POST /api/chats`, poi apre la chat; un rifiuto (`NOT_FRIENDS`) resta scritto nella riga.

### Motivazione

- Con lo store passato al client i test possono usare lo stesso meccanismo di rinnovo dell'app, e non c'è un globale che
  dipende da `app/store.ts`.
- I messaggi su STOMP arrivano dopo il commit (sezione 7.6): un messaggio che compare è già salvato, quindi l'attesa dell'eco è
  sicura; ma il server non conserva i push, quindi dopo una caduta si rilegge dal database.
- Una sola chiamata da 100 conversazioni dà elenco, badge e ricerca senza chiamate in più, e oltre 100 conversazioni (impossibile
  nella demo) sarebbero parziali.
- Il segnaposto ritardato evita il lampeggio col server veloce, e il limite di 10 secondi evita una bolla sospesa per sempre se la
  connessione cade dopo l'invio.
- Una lista unica nella campanella è più semplice da leggere e da provare delle due sezioni.
- Tab e footer nascosti dentro una conversazione lasciano posto ai messaggi e alla casella.

### Alternative scartate

- **`startStomp()` senza parametri con lo store importato:** i test avrebbero dovuto simulare il modulo dello store.
- **Spunta «recapitato» (doppia grigia):** il backend non ha lo stato; un evento di lettura in diretta richiede una modifica al
  backend, fuori dalla card.
- **Bolla ottimistica subito in grigio:** serve abbinare bolla ed eco senza un id del client, più casi e rischio di doppioni.
- **Pagine da 20 con «Carica altri» per l'elenco:** badge e ricerca sarebbero parziali.
- **Indicatore di connessione sempre nella barra:** elemento nuovo in ogni pagina, spazio stretto sul telefono.
- **Footer sempre visibile con lo spazio riservato:** sul telefono toglie troppo spazio ai messaggi.
- **Due sezioni separate nella campanella** e **numero solo per le amicizie:** una notifica non letta non si vedrebbe
  dall'icona, o il pannello avrebbe due elenchi da tenere allineati.
- **Contatto in una finestra:** gestione del fuoco e componente nuovi, diverso dalla candidatura.
- **`Toast` di react-bootstrap:** forza `role="alert"`, che interrompe i lettori di schermo per notifiche non urgenti.
- **Striscia di conferma in cima alla pagina (decisione 91):** sposta gli elenchi sotto quando compare e quando sparisce.
- **Etichette «Nome • ora» di gruppo (NoseY):** logica e test in più in una card già grande.

## Decisione 93: area di moderazione nel frontend (card FE-10, progettazione, sezioni 5.4–5.7 e 6.10)

### Scelta

- **Ingresso:** da 768 px la colonna di navigazione a sinistra ha, dopo Profilo, una schedina «ADMIN» (riquadro dal bordo giallo
  tenue, idea dello studente, per dire che è un'area a sé) con «Utenti» (icona `user-cog`) e «Nascosti» (icona
  `eye-off`), animate come le altre (Animate UI), solo per ADMIN e SUPERADMIN; sul telefono le tab restano cinque (aggiunta dello
  studente dopo aver visto che il menu utente passava inosservato). Sul telefono, dove la colonna non c'è, le voci «Utenti» (`/admin/utenti`) e «Contenuti
  nascosti» (`/admin/contenuti`) stanno nel menu utente (da 768 px sarebbero ridondanti e non ci sono), solo per
  ADMIN e SUPERADMIN (`selectHasRole('ADMIN')` vale anche per il SUPERADMIN). Le rotte sono dietro `RequireRole` e le pagine
  sono caricate in modo differito. È solo interfaccia: la protezione vera resta nel backend.
- **Elenco utenti:** ricerca su email e nome con attesa di 400 ms (come la ricerca persone), filtro «Tutti gli stati / Attivi /
  Sospesi», numeri di pagina con un componente nuovo (`Pagination`, adattato da `Paginazione` di NoseY) usato anche per i
  nascosti. Tabella da `lg`, schede sotto (solo CSS). La pagina scelta vale solo per i filtri con cui è stata scelta.
- **Sospensione:** motivo 1–500 e durata scelta a pulsanti fra **1, 3, 7, 30, 90 giorni** e **Indeterminata**, senza durata
  preselezionata («Sospendi» resta spento finché mancano motivo o durata). Niente giorni liberi e niente data di fine: il test
  del piano «rifiuta durata e data insieme» diventa «cambiando durata vale solo l'ultima scelta», perché giorni e indeterminata
  non possono coesistere. Il limite di 90 giorni è solo dell'interfaccia: il backend accetta fino a 3650 giorni (sezione 5.5).
  Dopo la sospensione compare «Account sospeso.» e la riga mostra scadenza e motivo.
- **Riattivazione** con finestra di conferma. **Livelli (sezione 5.6)** applicati dall'interfaccia con `canActOn`: sul bersaglio
  vietato (se stessi, ruolo pari o superiore) il pulsante è spento e una frase spiega perché; il 403 del backend resta gestito.
- **Nomina e revoca ADMIN:** solo per il SUPERADMIN, mai su un altro SUPERADMIN né su se stessi, sempre con conferma.
  «Rendi admin» è spento con la spiegazione se l'utente non è verificato o è sospeso (una sospensione già scaduta conta come
  attiva, decisione 54); «Togli admin» è sempre attivo.
- **«Nascondi»** per gli admin su card e dettagli di concerti, indie event, annunci e post (i post non hanno dettaglio), mai sui
  propri contenuti. `ConfirmDialog` è esteso con `reasonMin` (motivo obbligatorio, conferma spenta sotto il minimo: qui 3) e
  `error` (il rifiuto del backend resta nella finestra); senza queste props non cambia. L'interfaccia non conosce i ruoli
  dell'autore: se è un altro admin il 403 `INSUFFICIENT_PLATFORM_LEVEL` compare nella finestra. Dopo «Nascondi» la card sparisce
  dall'elenco; dal dettaglio si torna all'elenco della sezione.
- **Contenuti nascosti:** una scheda per tipo (Concerti, Indie, Post, Annunci) nell'indirizzo (`?scheda=`, valore sconosciuto =
  Concerti). Ogni riga mostra titolo, autore, data, motivo e chi ha nascosto: per un contenuto eliminato dal proprietario
  «Eliminato dall'utente» (nessuna chiamata), per gli altri «Nascosto da {nome}» con il nome preso dal profilo pubblico
  dell'admin, una chiamata per riga («un admin» finché non arriva o se fallisce). «Ripristina» chiede conferma ed è spento, con
  la spiegazione, per ciò che ha eliminato il proprietario (`RESTORE_NOT_ALLOWED`).
- **Cache:** «Nascondi» e «Ripristina» invalidano il contenuto, l'elenco pubblico, «i miei» e l'elenco dei nascosti di quel tipo
  (`contentTags`).

### Motivazione

- Le voci nel menu non cambiano il layout approvato (decisione 83) e seguono lo schema delle voci «Pubblica».
- Oltre tre mesi una sospensione a tempo non si distingue da quella indeterminata, che l'admin chiude comunque con «Riattiva»:
  poche durate fisse rendono il form veloce, senza validazioni di giorni e data.
- Mostrare il pulsante spento con la frase spiega all'admin perché non può agire, invece di nasconderlo.
- Estendere `ConfirmDialog` evita di duplicare contatore, spazi ai bordi, attesa e riapertura da vuoto.
- Il profilo pubblico di un admin esiste sempre (non si nomina chi non ha verificato l'email), quindi il nome si può leggere
  senza modifiche al backend; per i contenuti eliminati dal proprietario `hiddenBy` è il proprietario e la chiamata sarebbe inutile.

### Alternative scartate

- **Voci admin nelle tab del telefono:** stringono la barra di cinque voci; sul telefono restano nel solo menu utente.
- **Una voce «Admin» sola nella colonna a sinistra:** le due pagine sono distinte, due voci portano a ciascuna a un clic.
- **Pagina `/admin` con due link:** un clic in più e una pagina quasi vuota.
- **Giorni liberi o data di fine nel form:** più campi e validazioni per un'azione rara; il tetto di un anno proposto in alternativa
  è stato superato dalle durate fisse.
- **Dialogo proprio per «Nascondi»:** duplica il codice di `ConfirmDialog`.
- **Nascondere i pulsanti vietati dai livelli:** l'admin non capirebbe perché mancano.
- **«Nascosto da un admin» fisso o senza chi ha nascosto:** meno informazione per l'admin; scelto l'ibrido con il nome per i
  contenuti moderati e «Eliminato dall'utente» per gli altri.
- **«Ripristina» e riattivazione senza conferma:** un clic per sbaglio rende di nuovo pubblico un contenuto o riapre un account.

## Decisione 94: Playwright per le prove visive del frontend (card FE-10, progettazione, sezione 11)

### Scelta

- **`playwright` 1.64.1** (versione esatta) come dipendenza di sviluppo di `Resonance_FE`, con il solo Chromium (scaricato nella cache
  dell'utente, fuori dal repository). Serve a guardare le schermate vere a 375, 768 e 1280 px (controllo «tre larghezze» di ogni
  card) e, in FE-12, a rifinire l'interfaccia. Gli script di prova stanno fuori dal repository.
- **Nessun test automatico lo usa:** i test restano Vitest con jsdom e MSW; Playwright non entra in `npm test`, nel build né in CI.

### Motivazione

- Con jsdom non si vede il layout: la prova delle tre larghezze restava a occhio dello studente e ha lasciato passare difetti reali
  (celle di tabella senza distanza, pulsanti uno sopra l'altro) che con uno screenshot si vedono subito.
- Una dipendenza di sviluppo non entra nell'immagine di produzione (il Dockerfile costruisce solo il bundle).

### Alternative scartate

- **Solo controllo a occhio dello studente:** un giro in più per ogni ritocco di stile.
- **Test end-to-end con Playwright Test nel repository:** richiede backend, database e dati di prova a ogni esecuzione; fuori dal piano.
- **Puppeteer o Selenium:** stessa funzione, ma Playwright gestisce le attese e le larghezze della finestra con meno codice.

## Decisione 95: polling del server di sviluppo di Vite (card FE-10, progettazione, sezione 12.1)

### Scelta

- Il server di sviluppo di Vite controlla le modifiche dei file **a intervalli** (`server.watch: { usePolling: true, interval: 300 }`
  in `vite.config.ts`). Vale solo per `npm run dev`: `vite preview`, il build e i test non lo usano.
- Un test (`src/viteConfig.test.ts`) legge il testo di `vite.config.ts` e controlla che il polling resti attivo e che il proxy di
  `/api` e `/ws` non sia stato tolto.

### Motivazione

- Il progetto sta in una cartella di OneDrive, dove il controllo delle modifiche del disco (eventi del sistema) perde aggiornamenti:
  il browser riceveva moduli vecchi anche dopo un ricarico (visto due volte il 22 ottobre, con la barra di navigazione e con le righe
  admin) e l'unico rimedio era riavviare `npm run dev`. Il polling le vede sempre: provato modificando e ripristinando un file, con
  entrambe le versioni servite entro 3 secondi.
- 300 ms bastano per non accorgersene e pesano poco sul processore.

### Alternative scartate

- **Riavviare `npm run dev` a mano a ogni modifica:** facile da dimenticare e fa perdere tempo nelle sessioni lunghe.
- **Spostare il progetto fuori da OneDrive:** risolverebbe alla radice ma cambia l'ambiente dello studente a pochi giorni dalla consegna.
- **Intervallo più basso (100 ms, il valore predefinito):** più reattivo ma con un costo di processore inutile per uno schermo di prova.

## Decisione 96: nome utente unico e pulizia degli account non verificati (card F7-08, progettazione, sezioni 3.2, 4.4 e 6.4)

Ogni punto è stato proposto allo studente con alternative, pro, contro e raccomandazione, e approvato il 22 ottobre (nome unico: richiesta dello
studente, soluzione A fra tre; nome e cognome restano tra le funzioni future, progettazione §15).

### Scelta

- **Unicità:** il nome (`displayName`) è unico **senza distinguere le maiuscole**. Migrazione `V10__unique_display_name`: indice unico
  `uq_users_display_name_lower` su `lower(display_name)`, nessuna colonna nuova. Su Render, prima della migrazione, una `SELECT` di sola
  lettura ha trovato 5 utenti e nessun nome doppio.
- **Nomi occupati subito:** il nome vale anche per gli account con l'email non ancora verificata. Un nome lasciato da chi lo cambia torna
  disponibile.
- **Spazi:** restano ammessi nel nome (nomi di gruppo e di locale). Gli spazi ripetuti dentro il nome si riducono a uno (`DisplayNames.normalize`,
  chiamata nel costruttore dei due DTO insieme al trim), prima della validazione e del controllo. Vale solo lo spazio normale.
- **Nomi riservati:** admin, superadmin, resonance, staff, support, moderator, official, system, root (`ReservedDisplayNames`), rifiutati
  quando il **nome intero** coincide con uno dell'elenco, senza distinguere le maiuscole: «Admin Mario» passa. Errore: 400 `VALIDATION_ERROR`
  sul campo `displayName`, «Questo nome utente non è disponibile». Il controllo scatta solo quando il nome **cambia**: il superadmin
  («Superadmin», creato da `SuperadminBootstrap`, che non cambia) può modificare la bio rimandando lo stesso nome. La regola non è
  retroattiva (come la decisione 84): su Render un utente ha già un nome riservato.
- **Nome già preso:** 409 `DISPLAY_NAME_TAKEN`, messaggio «Nome già utilizzato», senza `fields` (come `EMAIL_ALREADY_REGISTERED`). Lo decide
  `DisplayNamePolicy` (nuovo componente del package `user`, usato da `AuthService.register` e da `UserService.updateProfile`) con una query che
  esclude l'utente stesso: cambiare solo le maiuscole del proprio nome, o registrarsi di nuovo con la stessa email non verificata, non è un
  conflitto. Due richieste insieme: la seconda urta l'indice e `GlobalExceptionHandler` lo traduce nello stesso 409 (`saveAndFlush`, quindi
  l'errore nasce dentro il metodo e non al commit). Nome e conflitto nella registrazione si controllano prima del codice email: un nome
  non disponibile non consuma un invio.
- **Ordine dei controlli:** validazione del DTO (lunghezza, emoji, caratteri invisibili), poi riservato, poi nome preso: chi prova un nome
  riservato non scopre se qualcuno lo usa.
- **Pulizia degli account mai verificati:** `UnverifiedAccountCleaner` (package `auth`), `@Scheduled(fixedDelay = 1h)` (gira anche all'avvio),
  con un solo `DELETE` elimina gli utenti con `email_verified = false` il cui ultimo invio del codice di verifica (`email_codes.sent_at`) è più
  vecchio di 24 ore; senza codice conta `created_at`. Chi si registra di nuovo riceve un codice nuovo e l'account riparte. Le righe collegate
  (`user_roles`, `email_codes`, `refresh_tokens`) vanno via con `ON DELETE CASCADE`.
- **Nomi quasi uguali (lettere simili, spazi che non sono lo spazio normale):** limite noto, accettato. Si confronta solo `lower(...)`.
- **Frontend:** etichetta «Nome utente» (registrazione e modifica del profilo) e messaggio «Scrivi il nome utente.» a campo vuoto;
  `DISPLAY_NAME_TAKEN` si mostra **solo sotto il campo** con «Nome già utilizzato.» (`getFieldErrors` lo mappa su `displayName`, `ErrorAlert` non
  lo ripete); nessun elenco di nomi riservati nel frontend: l'errore del server compare sul campo come quello delle emoji. L'informativa
  privacy non cambia (testi approvati in FE-03b).
- **Test:** le fixture dei test che creavano più utenti con lo stesso nome fisso («Utente», «Admin», «Mario», «Ugo») ora hanno nomi
  diversi (dalla parte dell'email prima della `@`, o con un UUID); nessun codice di produzione cambia per questo.

### Motivazione

- Gli utenti non hanno nome e cognome: il nome è il solo segno di riconoscimento e due utenti con lo stesso nome si scambiano a vista (chat,
  feed, amicizie). Un indice sull'espressione dà l'unicità senza colonne da tenere allineate, e l'indice resta l'ultima difesa anche se il
  controllo del service viene aggirato da due richieste insieme.
- Con i nomi occupati subito non esiste una gara fra due non verificati né un errore a sorpresa alla verifica, ma serve la pulizia: senza, un
  account mai confermato terrebbe il nome per sempre e le righe si accumulerebbero nel database gratuito di Render. Il job orario (e non
  giornaliero) rende la durata prevedibile, e contare dall'ultimo invio del codice evita di eliminare chi si registra di nuovo.
- Il riservato è una regola di validazione (come le emoji, decisione 84), non un conflitto con un altro utente: per questo 400 e non 409.
- Il «nome intero» non blocca nomi d'arte legittimi ("Radmin", "Systemic"); «solo se cambia» evita di bloccare chi ha già un nome riservato.

### Alternative scartate

- **Colonna con il nome normalizzato (NFKC, minuscole, senza spazi) e indice su quella:** rende uguali anche «Marco Rossi» e «MarcoRossi», ma
  cambia la soluzione A approvata (nessuna colonna nuova) e va oltre la richiesta.
- **Tabella delle sostituzioni per le lettere simili (I/l, O/0, alfabeti diversi):** lavoro senza fine, mai completo, e blocca nomi diversi
  ma legittimi.
- **Rifiutare le parole riservate anche dentro il nome:** blocca nomi d'arte come «Moderator Jazz Trio».
- **Elenco di soli tre nomi riservati:** lascia staff, support e moderator per spacciarsi per l'amministrazione.
- **Il nome conta solo dopo la verifica dell'email:** due non verificati possono avere lo stesso nome e il secondo che verifica riceve un
  errore in un punto dove oggi non ce ne sono; più codice e più test.
- **Pulizia in una card a parte:** avrebbe lasciato il nome bloccato per sempre fino alla card successiva; la scelta «occupato subito» la
  richiede subito.
- **Pulizia una volta al giorno:** un account vivrebbe fra 24 e 48 ore, e su Render il servizio si sospende.
- **Contare le 24 ore dalla creazione dell'account:** chi si registra di nuovo dopo un giorno si vedrebbe eliminare l'account.
- **Vietare gli spazi nel nome:** riapre una scelta approvata e peggiora i nomi di gruppo e di locale (decisione 84: 30 caratteri per quelli).
- **Ridurre o rifiutare i doppi spazi con un errore sul campo:** più attrito per un errore di battitura banale.
- **409 `DISPLAY_NAME_TAKEN` anche per i riservati:** nessun utente ha preso quei nomi; il codice sarebbe meno preciso.
- **Elenco dei riservati anche nel frontend:** due elenchi da tenere uguali.
- **«Nome già utilizzato» anche nell'avviso rosso in alto:** lo stesso testo due volte sullo schermo.

## Decisione 97: notifiche persistenti con stato di lettura (card F7-06, progettazione, sezioni 3.2, 6.14, 6.15 e 7)

Ogni punto è stato proposto allo studente con alternative, pro, contro e raccomandazione, e approvato il 23 ottobre. **Sostituisce** la parte
della decisione 59 che metteva le notifiche live delle richieste di amicizia fuori dall'MVP, e lo «storico delle notifiche» che la sezione 6.13
della progettazione teneva fra le funzioni Post-V1.

### Scelta

- **Eventi che si salvano:** richiesta di amicizia ricevuta (`FRIEND_REQUEST`), richiesta accettata (`FRIEND_ACCEPTED`, a chi aveva chiesto), like
  al post (`NEW_LIKE`) e candidatura all'annuncio (`COLLAB_APPLICATION`). `NEW_MESSAGE` e il contatto degli eventi restano **solo live**: i
  messaggi hanno già il badge dei non letti nella chat.
- **Rifiuto silenzioso:** la richiesta rifiutata non genera nessuna notifica a chi aveva chiesto (decisione 59). Anche il rifiuto silenzioso
  ripetuto da chi era stato rifiutato non notifica nessuno.
- **Stato di lettura:** solo letta / non letta (`read_at`), niente «vista». Il numero sull'icona conta le non lette e scende solo segnandole lette.
- **Richiesta già gestita:** se il destinatario accetta o rifiuta, la sua notifica `FRIEND_REQUEST` resta nell'elenco **segnata letta**. Se chi
  aveva chiesto **annulla** la richiesta ancora in attesa, la notifica del destinatario viene **cancellata**.
- **`targetId` delle notifiche di amicizia:** l'id dell'amicizia, così accetta, rifiuta e annulla ritrovano la notifica per quel bersaglio.
- **Like ripetuti:** una sola notifica per coppia autore-post, qualunque sia lo stato di lettura; mettere, togliere e rimettere il like non la
  rinnova. Indice univoco parziale `uq_notifications_like` e inserimento con `ON CONFLICT DO NOTHING`: la live parte solo se la riga è nuova.
- **Dati esistenti:** la migrazione crea solo la tabella; le richieste in attesa già presenti non diventano notifiche (restano in `/amici`).
- **Schema:** migrazione `V11__notifications`, enum `notification_type` (senza `NEW_MESSAGE`), tabella `notifications` con `recipient_id`, `actor_id`,
  `type`, `target_id` (senza chiave esterna), `created_at` (dall'applicazione), `read_at`; indici per l'elenco, per le non lette, per la pulizia
  e il like univoco. Dettagli in `docs/schema-db.md`.
- **Elenco:** dalla più recente (`created_at desc, id desc`), paginato come le altre liste. Conservazione **30 giorni** dalla creazione, lette o no,
  nessun tetto per utente; `NotificationService.deleteExpired` è un lavoro programmato giornaliero (`fixedDelay`, parte anche all'avvio) come la
  pulizia dei refresh token.
- **Endpoint** (sezione 6.15): `GET /api/notifications`, `GET /api/notifications/unread-count`, `POST /api/notifications/{id}/read` (204, idempotente),
  `POST /api/notifications/read-all` (204). Una notifica altrui o inesistente è un 404; risposta `{id, type, actor, targetId, createdAt, read}`, senza
  anteprima.
- **Notifiche live:** restano su `/user/queue/notifications`; il payload `LiveNotification` ha in più `id` (quello della notifica salvata, nullo per
  `NEW_MESSAGE`), così il frontend la unisce all'elenco. Nuovi tipi `FRIEND_REQUEST` e `FRIEND_ACCEPTED`.
- **Struttura del codice:** un `NotificationService` centrale nel package `notification`, chiamato da `FriendshipService`, `FeedService` e
  `CollabService` dentro la loro transazione (`Propagation.MANDATORY`): salva la riga e pubblica l'evento live dopo il commit. Se l'azione fallisce
  non resta nulla.
- **Privacy:** non si salva testo di messaggi; le notifiche si salvano anche per utenti sospesi (le rivedono alla riattivazione).
- **Postman:** nuova cartella `Notifications`, dopo `Friends`.

### Motivazione

- La campanella deve mostrare le notifiche anche dopo il ricarico e anche a chi ha mandato una richiesta che l'altro ha accettato: le notifiche
  solo in memoria della sessione (decisione 92) non bastano.
- «Letta/non letta» basta a un contatore sull'icona e ha un solo concetto da testare; il rifiuto silenzioso resta quello voluto contro l'insistenza.
- Una richiesta gestita resta come storico letto, mentre una annullata non ha più nulla da mostrare e sparisce.
- L'indice univoco sui like fa rispettare la regola anche con due richieste insieme; la tabella non cresce all'infinito grazie ai 30 giorni.
- Un solo service tiene le regole in un posto e le rende facili da testare.

### Alternative scartate

- **Salvare anche `NEW_MESSAGE` e il contatto degli eventi:** una notifica per messaggio inonda l'elenco e duplica il badge della chat.
- **Solo amicizie:** like e candidature resterebbero in memoria e la campanella incoerente.
- **Stato «vista» oltre a «letta»:** due colonne, un endpoint in più e più regole.
- **Notifica di rifiuto:** rompe il rifiuto silenzioso della decisione 59.
- **Migrare le richieste in attesa:** SQL in più per dati che in produzione sono quasi inesistenti.
- **Cancellare la notifica anche su accetta/rifiuto:** perde lo storico.
- **Conservazione illimitata o tetto di 100 per utente:** la prima fa crescere la tabella, il secondo richiede pulizia a ogni inserimento.
- **Filtrare in lettura senza cancellare:** la tabella cresce comunque.
- **Salvataggio con evento Spring e listener `BEFORE_COMMIT`:** più indiretto da seguire e da testare.
- **`PATCH` per segnare lette:** nessuna differenza pratica rispetto a `POST`.

## Decisione 98: notifiche persistenti nella campanella (card FE-13, progettazione, sezioni 6.15 e 7.4)

Ogni punto è stato proposto allo studente con alternative, pro, contro e raccomandazione, e approvato il 23 ottobre. **Sostituisce** in parte la
decisione 91 (la campanella mostrava le richieste in attesa da `GET /api/friendships`) e la decisione 92 (le notifiche della campanella erano solo
in memoria, al massimo 20); i toast della 92 restano.

### Scelta

- **Elenco unico a pagine:** il pannello mostra le notifiche salvate (`GET /api/notifications`), dalla più recente, **10 per pagina** (uguale su
  telefono e tablet), con «Carica altri» (`LoadMore`). Niente schede «Tutte / Non lette» né gruppi «Recenti / Precedenti». Una voce di cache per
  pagina (come amici e feed): un'invalidazione rilegge tutte le pagine aperte. Il pannello monta l'elenco solo quando è aperto e a ogni apertura
  rilegge la pagina.
- **Segno «non letta»:** accento giallo sulla riga (già presente) più un **pallino giallo** a destra; ai lettori di schermo «Non letta».
- **Numero sull'icona:** le non lette del server (`GET /api/notifications/unread-count`), da 1 a «9+»; nome accessibile «Notifiche: N non lette»
  (al singolare «1 non letta»). Scende solo segnando lette le notifiche (niente «vista», decisione 97). Si rilegge ad apertura dell'app, apertura del
  pannello, ritorno sulla scheda e riconnessione STOMP; mai a intervalli.
- **Clic su una notifica:** `POST /api/notifications/{id}/read` (solo se non è già letta) e apertura del bersaglio: `FRIEND_REQUEST` → `/amici?scheda=ricevute`,
  `FRIEND_ACCEPTED` → profilo di chi ha accettato (`targetId` è l'amicizia, che non ha una pagina), `NEW_LIKE` → feed, `COLLAB_APPLICATION` → annuncio.
  La riga diventa letta e il numero scende **a risposta arrivata**, senza richiamare il server; con un errore resta non letta. Se la notifica non è in
  nessuna pagina caricata (la apre un toast) si rilegge dal server.
- **«Segna come lette»:** `POST /api/notifications/read-all`, visibile solo con non lette; tutte le righe caricate diventano lette e il numero va a zero.
- **Richieste di amicizia:** niente più righe a parte. La notifica `FRIEND_REQUEST` è una riga dell'elenco e, **finché la richiesta è in attesa e tra le
  10 più recenti** che la campanella già legge (`GET /api/friendships?type=INCOMING&size=10`, chiesta solo con il pannello aperto), ha «Accetta» e
  «Rifiuta» (`FriendshipButton`, trovata per id dell'amicizia = `targetId`). Una richiesta già gestita, o in attesa ma fuori dalle 10, è una riga senza
  pulsanti. Accettare, rifiutare, annullare o rimuovere invalidano anche le notifiche (il backend segna letta quella della richiesta). Il numero non
  somma più le richieste in attesa: le richieste anteriori alla migrazione non sono notifiche e si trovano in `/amici` (decisione 97).
- **Notifiche live:** un toast per ogni notifica (3 in vista, 6 secondi, come in decisione 92). Una notifica con `id` (salvata) entra anche in cima alla
  prima pagina in cache, non letta, e alza il numero di uno, **senza richiamare il server** (`receiveLiveNotification`); se arriva due volte (stesso `id`)
  entra e conta una volta sola. Con la prima pagina piena toglie l'ultima riga, così resta uguale a quella del server; se sono aperte altre pagine si
  rileggono, perché le righe si sono spostate. Senza elenco o numero in cache non fa nulla: la prima lettura li porta. `NEW_MESSAGE` resta solo toast,
  non entra in campanella né nel numero (ha il badge della chat); il suo toast non chiama il server al clic. Dopo una riconnessione si rileggono anche
  notifiche e numero.
- **Toast:** il clic su un toast di una notifica salvata la segna letta sul server e chiude il toast; la X chiude il toast e lascia la notifica non letta.
- **Stato in memoria:** `notificationsSlice` tiene solo i toast (`toasts`, al massimo 3, id della notifica salvata o nuovo per un messaggio); spariscono
  `markRead`, `markAllRead`, `selectNotifications` e `selectUnreadNotificationCount`. Le notifiche salvate vivono nella cache di RTK Query
  (nuovo tag `Notification`, aggiunto anche a `FRIENDSHIP_TAGS`).
- **Testi:** `FRIEND_REQUEST` «NOME ti ha inviato una richiesta di amicizia», `FRIEND_ACCEPTED` «NOME ha accettato la tua richiesta di amicizia»; restano
  quelli di mi piace e candidatura. Vuoto «Nessuna notifica.»; errore con `ErrorAlert` e «Riprova».

### Motivazione

- Il backend salva già le notifiche (decisione 97): con un elenco unico il frontend ha una sola fonte e il numero non può contraddire le righe.
- Il numero dal server resta giusto anche con più non lette di quante ne mostri la prima pagina, dopo un ricarico e su più dispositivi.
- Aggiornare la cache alla risposta (non prima) evita di mostrare «letta» una notifica che il server non ha segnato; la notifica live entra in cache
  per non spendere due chiamate per ogni notifica sul piano gratuito di Render.
- Accetta e Rifiuta nella riga evitano un passo a chi risponde e non duplicano la stessa richiesta (riga della richiesta più notifica).

### Alternative scartate

- **Schede «Tutte / Non lette» o «Recenti / Precedenti»:** più liste e più test per un elenco che dura 30 giorni.
- **Numero contato sulle righe già caricate:** sbagliato oltre la prima pagina.
- **Clic che apre senza segnare letta:** il numero non scenderebbe mai da solo.
- **Solo notifiche, «Accetta» in `/amici`:** un passo in più e si perde quanto costruito in FE-09a.
- **Righe di richiesta e notifiche separate:** la stessa richiesta due volte e numero doppio.
- **Notifica `NEW_MESSAGE` anche in campanella, solo in memoria:** sparirebbe al ricarico e il numero sommerebbe due fonti diverse.
- **Togliere i toast:** non richiesto; si perde l'avviso immediato scelto in FE-09b.
- **Rileggere elenco e numero a ogni notifica live:** due chiamate per notifica e lampi nel pannello aperto.
- **Caricare tutte le richieste in attesa (`size=100`):** risposta più grossa a ogni apertura per un caso quasi inesistente.
- **Controllo periodico del numero:** contraddice «nessun polling» (decisione 91) e pesa sul piano gratuito.

## Decisione 99: candidatura unica per annuncio (card F7-09, progettazione, sezioni 6.7 e 6.9)

### Scelta

- **Una sola candidatura per annuncio e utente:** la seconda risponde 409 `COLLAB_ALREADY_APPLIED` con il testo «Ti sei gia' candidato a questo annuncio», senza creare messaggi né notifiche.
- **Come si riconosce:** dalla riga di `chat_unlocks` (conversazione, `COLLAB_POST`, id dell'annuncio), che la prima candidatura crea già. Nessuna migrazione e nessuna tabella nuova. Le candidature doppie già nel database restano com'erano (hanno una sola riga di sblocco): non si toccano.
- **Ordine dei controlli:** 404, `COLLAB_CLOSED`, `CANNOT_APPLY_OWN_POST`, `COLLAB_ALREADY_APPLIED`, limite `COLLAB_APPLICATIONS`. Come gli altri rifiuti, un tentativo respinto non consuma le 10 candidature al giorno.
- **Due richieste insieme:** il controllo veloce (`ChatService.hasUnlock`) non basta da solo; il rifiuto vero è l'`insert ... on conflict` dello sblocco, atomico: la seconda transazione aspetta la prima, trova la riga e viene annullata con lo stesso 409, mai un 500.
- **Meccanismo:** `ChatService.sendFirstUnlockedMessage` restituisce un `Optional` vuoto se lo sblocco c'era già; `CollabService` lancia l'errore. `sendUnlockedMessage` resta com'è per il contatto degli eventi, che può ripetersi.
- **Annuncio chiuso e riaperto:** nessuna nuova candidatura, una sola per sempre (oggi il backend non ha comunque la riapertura).

### Motivazione

La tabella `chat_unlocks` ha già la chiave unica che serve, quindi la regola costa poco e non richiede una migrazione. L'insert atomico protegge dalla corsa senza blocchi espliciti. Un metodo nuovo evita un flag booleano e lascia il contatto degli eventi invariato.

### Alternative scartate

- **Tabella `collab_applications` con vincolo UNIQUE:** migrazione, schema da aggiornare e pulizia dei doppioni, per un'informazione già presente.
- **Ricerca nel testo dei messaggi:** fragile (il titolo può ripetersi, il testo si può scrivere a mano) e non protegge dalla corsa.
- **Codice generico `CONFLICT`:** il frontend non potrebbe distinguere l'errore (FE-14).
- **Controllo dopo il limite di frequenza:** chi ripete la candidatura per un doppio click consumerebbe le 10 al giorno.
- **Parametro booleano su `sendUnlockedMessage`:** chiamate poco leggibili e un errore della collab dentro il servizio chat.
- **Dividere `sendUnlockedMessage` in passi:** refactor più grande che tocca anche il contatto degli eventi.

## Decisione 100: conversazione della candidatura nel dettaglio dell'annuncio (card FE-14, progettazione, sezione 6.7)

### Scelta

- **Campo nuovo `applicationConversationId`** nella risposta di `GET /api/collab-posts/{id}`: l'id della conversazione con l'autore se il chiamante si è già candidato, altrimenti `null`. Serve al frontend per mostrare «Candidatura inviata» e il link «Apri la chat» anche dopo un ricarico della pagina.
- **Solo nel dettaglio:** elenco, `/mine`, creazione e chiusura restituiscono sempre `null` e non fanno query in più (nessun costo per le pagine da 10). Il Javadoc del DTO lo dice, perché un `null` in elenco non significa «non candidato».
- **`null` per anonimi, autore e chi non si è candidato:** nessun dato di altri utenti; l'autore non si candida al proprio annuncio e per lui la chat non viene nemmeno interrogata.
- **Come si riconosce:** dalla stessa riga di `chat_unlocks` della decisione 99 (`ChatService.findUnlockConversationId`; `hasUnlock` ora la usa). Nessuna migrazione. Il dato resta valido anche se l'annuncio viene chiuso dopo.
- **Frontend (FE-14):** a invio riuscito, dopo un 409 `COLLAB_ALREADY_APPLIED` o se il dettaglio porta già l'id, il campo del messaggio sparisce e resta il pulsante spento «Candidatura inviata» con «Apri la chat» (quando l'id è noto). Dopo il 409 e dopo un invio riuscito il dettaglio si rilegge (tag `CollabPost` invalidato dalla mutazione), così il link compare e, tornando sulla pagina, il modulo non riappare; gli altri errori non rileggono. Testo del codice `COLLAB_ALREADY_APPLIED`: «Ti sei già candidato a questo annuncio.», mostrato sotto il pulsante e non come errore rosso. Gli altri errori (`COLLAB_CLOSED`, `CANNOT_APPLY_OWN_POST`, 429) restano com'erano.
- **Eccezione ai vincoli globali del piano del frontend**, approvata dallo studente il 23 ottobre: la card FE-14 tocca backend e collection Postman (richiesta «Dettaglio annuncio del candidato (200)», e il dettaglio anonimo controlla il `null`).

### Motivazione

Senza il campo il frontend saprebbe della candidatura già fatta solo dopo l'errore 409, e chi ricarica la pagina rivedrebbe il modulo. L'id della conversazione (e non un booleano) permette di mostrare anche «Apri la chat» dopo il ricarico, con una query sola sul dettaglio.

### Alternative scartate

- **Booleano `hasApplied`:** bottone bloccato dopo il ricarico, ma senza il link alla chat.
- **Campo in tutte le risposte:** una query in più per ogni annuncio dell'elenco (o una query a lotto da scrivere), non usata da nessuna schermata.
- **Solo «dopo l'invio o l'errore», senza backend:** dopo il ricarico si rivede il modulo.
- **Campo del messaggio visibile ma bloccato:** dopo un ricarico sarebbe una casella vuota e grigia, perché il testo inviato non è più noto.
- **Errore rosso sopra il modulo dopo il 409:** il pulsante resterebbe premibile e si potrebbe riprovare all'infinito.
- **Nessuna rilettura dopo il 409:** il link «Apri la chat» comparirebbe solo dopo un ricarico.
- **Memoria nel browser (`localStorage`):** vale solo per quel browser e il progetto lo evita per i dati di sessione.

## Decisione 101: pannello della campanella ancorato allo schermo sul telefono (card FE-15, progettazione, sezione 7.4)

### Scelta

Sotto i 460 px il pannello delle notifiche non segue più la campanella: sta fisso sotto la barra in alto con 0,75 rem (12 px) a sinistra e a destra, a ogni larghezza (a 320 px largo 296 px, a 448 px largo 424 px). Da 460 px in su resta com'era: 24 rem sotto la campanella, con 12 px di margine sinistro a 460 px. Il margine è quello misurato a 460 px; sotto i 360 px il pannello si restringe con lo stesso margine, senza regole speciali. Il CSS usa `!important` su posizione e trasformazione, perché il menu a tendina le scrive in linea.

### Motivazione

La campanella è a 64 px dal bordo destro (a destra c'è l'avatar), quindi con il pannello ancorato a lei il bordo sinistro toccava lo schermo sotto i 460 px. Ancorarlo allo schermo dà gli stessi margini a ogni larghezza e lascia al testo tutto lo spazio possibile; la sola larghezza calcolata avrebbe dato 244 px a 320 px.

### Alternative scartate

- **Solo larghezza calcolata (`100vw` meno 76 px):** una riga di CSS, ma a 320 px il pannello sarebbe largo 244 px, con 64 px vuoti a destra.
- **Margine di 1 rem o di 0,75 rem scelto a occhio:** non coincide per forza con quello che si vede a 460 px.
- **Margine ridotto sotto i 360 px:** una regola in più da mantenere e da provare, senza vantaggio chiaro.

## Decisione 102: richiesta di amicizia dal profilo (card FE-16, progettazione, sezioni 6.5 e 6.14)

Sostituisce la parte della decisione 91 che escludeva il pulsante dell'amicizia dal profilo pubblico.

### Scelta

- **Endpoint nuovo `GET /api/friendships/with/{userId}`**, solo con login: risponde `{status, friendshipId}` (la stessa forma `FriendshipSummary` della ricerca, `friendshipId` solo per `OUTGOING`, `INCOMING` e `FRIENDS`) con le regole di stato della sezione 6.14. `GET /api/users/{id}` non cambia: resta pubblico e senza dati di chi guarda. Se `userId` è il chiamante: 400 `CANNOT_FRIEND_SELF`; utente inesistente, non verificato o non attivo: 404 (come la richiesta di amicizia). Non scrive nulla.
- **Limite dedicato `FRIENDSHIP_STATE`:** 60 chiamate al minuto per utente (`app.rate-limits.friendship-state`), consumato per primo e valido anche per gli errori (decisione 64), separato da `FRIEND_REQUESTS` e da `USER_SEARCH`.
- **Pulsante sul profilo:** il componente `FriendshipButton` della ricerca, con tutti i suoi stati (Aggiungi, Richiesta inviata con Annulla, Accetta e Rifiuta, Amici con Scrivi e Rimuovi, Non disponibile). Sul profilo l'etichetta è «Aggiungi agli amici» (prop opzionale `addLabel`, per default «Aggiungi»); la ricerca non cambia. Il pulsante sta nell'intestazione del profilo (`ProfileHeader`), sotto nome e città, a capo sul telefono.
- **Profilo proprio e anonimo:** sul proprio profilo nessun pulsante e nessuna chiamata; chi non ha la sessione vede il link «Accedi per aggiungere», che porta a `/accesso` con `from` = percorso del profilo, così dopo l'accesso si torna lì (stesso meccanismo di `RequireAuth`) e senza chiamare l'endpoint.
- **Aggiornamento:** dopo ogni azione si rileggono, con i tag già usati (`FRIENDSHIP_TAGS`), la campanella, gli elenchi e la ricerca, più il tag nuovo `FriendshipState` per lo stato del profilo.
- **Eccezione ai vincoli globali del piano del frontend**, approvata dallo studente il 23 ottobre: la card FE-16 tocca il backend (endpoint, limite, test d'integrazione) e la collection Postman (cartella Friends: stato prima e dopo la richiesta, con se stessi 400, senza login 401).

### Motivazione

Il profilo non diceva nulla dell'amicizia e solo la ricerca la mostrava. Un endpoint a parte tiene il profilo pubblico uguale per tutti (nessun dato di chi guarda, nessun rischio se un giorno si mette in cache) e si può riusare altrove, per esempio vicino al nome dell'autore di un evento o di un post. Il limite dedicato e per primo ferma chi prova molti id per scoprire quali utenti esistono; 60 al minuto non si raggiungono aprendo profili a mano.

### Alternative scartate

- **Campo `friendship` dentro `GET /api/users/{id}`:** una chiamata sola, ma il profilo pubblico mescolerebbe dati pubblici e dati di chi guarda; scelta dello studente a favore dell'endpoint a parte.
- **Ricerca per nome dal frontend:** fragile (nomi simili, limite della ricerca, minimo di 2 caratteri).
- **Nessun limite, o quello della ricerca (`USER_SEARCH`):** il primo lascia scansionare gli id; il secondo conta insieme azioni diverse e un 429 sul profilo non ha senso.
- **Soglie di 30 o 120 al minuto:** 30 si raggiunge sfogliando in fretta, 120 protegge poco.
- **Limite dopo i controlli:** gli errori 404 non consumerebbero e la scansione di id non sarebbe fermata.
- **Solo i quattro stati della card, senza Annulla, Scrivi e Rimuovi:** dal profilo non si potrebbe annullare né rimuovere e il pulsante si comporterebbe diversamente dalla ricerca.
- **Etichetta «Aggiungi agli amici» anche nella ricerca:** cambia la decisione 91 e i suoi test, e la riga della ricerca è stretta sul telefono.
- **Pulsante in una striscia sotto l'intestazione:** più lontano dal nome e più spazio verticale.
- **Anonimo senza link, o link senza ritorno al profilo:** l'anonimo non sarebbe guidato, o perderebbe il profilo che stava guardando.
