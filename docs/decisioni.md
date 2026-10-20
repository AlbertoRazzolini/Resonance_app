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
  ora locale (formato breve, es. 30 ott 2026) oppure "A tempo indeterminato", "Motivo: …" e "Per un ricorso scrivi a …" con il contatto.
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
