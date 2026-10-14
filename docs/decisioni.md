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
