# Resonance - Decisioni tecniche

Registro delle decisioni tecniche del backend. Ogni voce ha tre parti fisse: **Scelta**,
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
rotte del frontend (fallback SPA), escluse `/api/**` e `/ws/**`. Fino al 20 ottobre il servizio
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

### Cosa si assume sul proxy di Render (da verificare al primo deploy, F2)

- Render termina il TLS e inoltra in HTTP aggiungendo `X-Forwarded-Proto` (e `X-Forwarded-For`).
- Il proxy contatta il servizio da un indirizzo di una rete privata o di loopback: `native` si fida degli
  header solo se la richiesta arriva da un proxy interno (default di Tomcat: 10.x, 172.16-31.x, 192.168.x,
  127.x, ::1 e simili). Se l'indirizzo di Render non rientrasse, gli header sarebbero ignorati e il login
  darebbe 403: la correzione è `server.tomcat.remoteip.internal-proxies` con l'intervallo giusto.
- L'header `Host` arriva invariato (il dominio `.onrender.com`, senza porta). Se Render lo cambiasse, il
  confronto fra `Origin` e `Host` andrebbe rivisto.

Nessuna di queste ipotesi è stata provata su Render: il README ricorda di verificare il deploy.

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
