# Resonance — Brief per Claude Code (backend)

Agisci come un senior backend engineer specializzato in Java, Spring Boot, Spring Security, PostgreSQL, JWT, WebSocket e progettazione di API, e come un esperto di prompt engineering e pianificazione dello sviluppo software.

Devi aiutarmi a progettare e sviluppare il backend del mio progetto capstone Resonance, utilizzando Claude Code dentro IntelliJ IDEA e la skill "brainstorming" di Superpowers.

IMPORTANTE: questa richiesta avvia una fase di BRAINSTORMING E PIANIFICAZIONE, non un'implementazione immediata.

Non scrivere codice, non modificare file di produzione, non creare migrazioni e non iniziare a sviluppare funzionalità finché non avremo completato il brainstorming, approvato il documento di design e concordato il passaggio alla fase di implementazione.

Le decisioni di progetto sono già state prese (sezione 9). Se durante il brainstorming emergono punti indispensabili non coperti da questo brief, presentameli in un'unica lista, ciascuno con alternative, pro e contro e una raccomandazione motivata; poi fermati e attendi la mia risposta. Non scegliere autonomamente al posto mio quando la decisione mi compete.

Le decisioni esplicitamente indicate come VINCOLANTI in questo brief sono già state prese: non rimetterle in discussione, non trasformarle in domande e non sostituirle con preferenze architetturali tue. Se individui un'incompatibilità tecnica reale, segnalala esplicitamente e spiegane le conseguenze, senza modificare unilateralmente i vincoli.

Non inventare requisiti funzionali, comportamenti, tabelle o funzionalità non richiesti. Quando un aspetto necessario non è definito e non è coperto dai vincoli o dalle decisioni della sezione 9, segnalalo come punto da chiarire, senza presentare un'ipotesi come una decisione già approvata.

Le decisioni già prese e quelle ancora aperte devono rimanere chiaramente separate durante tutto il lavoro.

## 1. CONTESTO DEL PROGETTO

Il progetto si chiama Resonance: una web app di community musicale locale che mette in contatto fan, musicisti e host (locali e organizzatori di eventi).

È il progetto capstone del bootcamp Epicode "Master Full-Stack AI Developer" di Firenze.

Lo sviluppo è backend-first: il backend deve essere distribuito presto su Render e il frontend deve poterlo consumare direttamente. Non utilizzare MockAPI come soluzione intermedia.

Il progetto è un unico repository, Resonance_app, con questa struttura:

- Resonance_BE/ → backend Spring Boot (pom.xml, src/, Dockerfile, .dockerignore, mvnw). È l'oggetto di questo incarico. Lo scheletro del progetto è già stato creato da me con Spring Initializr in IntelliJ: non ricrearlo, verificalo e completalo.
- Resonance_FE/ → frontend, sviluppato più avanti. Non va creato né toccato ora.
- Radice del repository: docs/, postman/, README.md, CLAUDE.md, render.yaml, docker-compose.yml, .gitignore (che copre sia Resonance_BE sia Resonance_FE).

Claude Code viene avviato dalla radice del repository. IntelliJ è aperto sulla radice e importa il progetto Maven da Resonance_BE.

Questo incarico riguarda ESCLUSIVAMENTE il backend.

Il frontend viene descritto più avanti unicamente come contesto di riferimento, affinché tu possa progettare API, DTO, autenticazione, paginazione, gestione degli errori e contratti WebSocket compatibili con il suo funzionamento. Non devi sviluppare, modificare o implementare il codice del frontend.

Il mio ambiente di lavoro è:

- Backend: IntelliJ IDEA.
- Frontend: VS Code.

Sono uno studente: spiegami le scelte tecniche non banali in modo comprensibile, senza nascondere le motivazioni architetturali. Quando una decisione spetta a me, fermati e chiedimi di scegliere.

## 1-BIS. VINCOLO DI TEMPO — VINCOLANTE

Scadenza di consegna: 25 ottobre. In questo tempo vanno completati backend, frontend, deploy e demo.

Budget del backend: dal 13 al 19 ottobre (F0–F6). Dal 20 ottobre si passa al frontend.

- Brainstorming e design devono chiudersi in giornata: niente domande su punti già decisi nel brief.
- Card dimensionate per circa 2–4 ore di lavoro, sotto-task per circa 30–60 minuti: né micro-passi, né blocchi enormi.
- Riusa NoseY il più possibile dove il brief lo consente: è la principale fonte di risparmio di tempo.
- Se una fase rischia di sforare il giorno previsto, avvisami subito e proponi un taglio dalla lista seguente, in quest'ordine:
  1. report di sicurezza solo con analisi statica;
  2. Swagger;
  3. notifiche live (la chat resta);
  4. bacheca collab.
- Non si tagliano mai: autenticazione a due token, ruoli e admin, eventi con geolocalizzazione, feed con like, chat, demo di promozione e sospensione, documentazione essenziale (docs/decisioni.md, docs/schema-db.md, README.md).
- docs/report-sicurezza.md va prodotto in versione breve e focalizzata.

## 2. STACK BACKEND — VINCOLANTE

Lo stack tecnologico è già deciso e deve essere rispettato.

- Java e Spring Boot, utilizzando le stesse versioni del progetto NoseY descritto nella sezione dedicata al riuso, salvo incompatibilità tecniche effettive e documentate.
- Spring Web.
- Spring Data JPA.
- Spring Security.
- Spring Validation.
- PostgreSQL come database.
- Flyway per tutte le migrazioni del database, versionate con nomi quali V1**, V2** e così via.
- Non usare mai spring.jpa.hibernate.ddl-auto=update.
- Autenticazione JWT con schema a due token, secondo tutti i vincoli della sezione AUTENTICAZIONE.
- WebSocket con STOMP per chat privata e notifiche in-app in tempo reale.
- Spring Mail e Thymeleaf per le email.
- Brevo tramite HTTP in produzione.
- Docker per PostgreSQL in locale.
- Dockerfile per il deploy del backend su Render, poiché Render non offre un runtime Java nativo per questo progetto.
- Deploy su Render.
- In futuro potrebbe esserci una migrazione verso una VPS o il passaggio a un piano a pagamento: non implementare ora queste evoluzioni, ma evita decisioni che le rendano inutilmente difficili.
- Test con JUnit 5.
- Collection Postman versionata nel repository per documentare e verificare gli endpoint REST, secondo le regole del METODO DI LAVORO.

Convenzioni:

- Codice, nomi delle classi, pacchetti, tabelle e colonne in inglese.
- Commenti e documentazione possono essere in italiano.
- Il progetto NoseY contiene nomi italiani: il codice riutilizzato deve essere adattato alle convenzioni di Resonance, non copiato indiscriminatamente mantenendo naming e struttura originari.

Durante il brainstorming verifica la compatibilità delle versioni effettive di NoseY con i requisiti elencati. Non aggiornare o sostituire lo stack per iniziativa personale.

## 3. RUOLI E AUTORIZZAZIONI — VINCOLANTI

### 3.1. Modello dei ruoli

La tabella user_roles deve utilizzare una chiave primaria composta da (user_id, role).

Il campo role utilizza un enum PostgreSQL chiamato user_role con i valori:

- FAN
- MUSICIAN
- HOST
- ADMIN
- SUPERADMIN

Deve esistere una riga per ogni ruolo attivo assegnato a un utente. Lo stesso utente può quindi avere contemporaneamente più ruoli.

### 3.2. Ruoli di community: FAN, MUSICIAN e HOST

Tutti gli utenti entrano nella piattaforma come FAN. Il ruolo FAN viene assegnato automaticamente durante la registrazione e non può mai essere rimosso.

MUSICIAN e HOST sono ruoli indipendenti:

- Un utente può essere FAN + MUSICIAN.
- Un utente può essere FAN + HOST senza essere MUSICIAN.
- Un utente può essere contemporaneamente FAN + MUSICIAN + HOST.
- Non esiste una gerarchia tra FAN, MUSICIAN e HOST.
- MUSICIAN e HOST hanno ciascuno un proprio endpoint di attivazione self-service. Esempi di endpoint previsti: POST /api/users/me/roles/musician e il corrispondente endpoint per HOST.
- La presenza di uno di questi ruoli non deve implicare automaticamente l'assegnazione dell'altro.

### 3.3. Ruoli di piattaforma: ADMIN e SUPERADMIN

La gerarchia esiste esclusivamente tra i ruoli di piattaforma:
SUPERADMIN > ADMIN.

Implementare questa gerarchia tramite RoleHierarchy di Spring Security, seguendo il modello di NoseY.

ADMIN e SUPERADMIN NON ereditano i ruoli MUSICIAN o HOST. La moderazione della piattaforma e la pubblicazione di contenuti musicali restano autorizzazioni distinte. Non attribuire automaticamente agli amministratori i permessi di pubblicazione riservati ai ruoli di community.

ADMIN e SUPERADMIN non sono mai assegnabili tramite self-service.

Solo un SUPERADMIN può:

- Nominare ADMIN un utente esistente.
- Revocare il ruolo ADMIN a un utente esistente.

Il primo SUPERADMIN deve essere creato automaticamente all'avvio dell'applicazione, leggendo email e password da variabili d'ambiente. Il bootstrap deve creare il ruolo solo se non esiste già un SUPERADMIN. Non inserire mai le credenziali in una migrazione Flyway, nei file versionati o nel repository.

Non deve essere possibile revocare o sospendere l'ultimo SUPERADMIN.

### 3.4. Permessi di moderazione per l'MVP

ADMIN può:

- Nascondere o eliminare official_concerts.
- Nascondere o eliminare indie_events.
- Nascondere o eliminare feed_posts.
- Nascondere o eliminare collab_posts.
- Sospendere utenti.
- Riattivare utenti precedentemente sospesi.
- Ripristinare contenuti nascosti.

I contenuti moderati vengono nascosti tramite i campi hidden_at e hidden_by (decisione 6 della sezione 9): le query pubbliche li escludono e l'ADMIN può ripristinarli.

SUPERADMIN dispone inoltre dei poteri di nomina e revoca degli ADMIN.

Gli endpoint di moderazione devono trovarsi sotto /api/admin/\*\* ed essere protetti con hasRole("ADMIN"). La gestione del ruolo ADMIN deve essere protetta con hasRole("SUPERADMIN").

Spring Security deve caricare tutti i ruoli dell'utente come GrantedAuthority e usare hasRole(...) per i controlli di autorizzazione.

### 3.5. Ruoli e stato sempre aggiornati

I ruoli e lo stato dell'utente (ACTIVE/SUSPENDED) NON devono essere letti dai claim del JWT.

Il JWT identifica l'utente, ma non è la fonte autoritativa per ruoli e stato.

Il JwtFilter deve caricare ruoli e stato dal database a ogni richiesta REST autenticata. Il JwtChannelInterceptor deve effettuare il controllo aggiornato durante il CONNECT STOMP.

In questo modo, promozioni, revoche dei ruoli e sospensioni devono diventare efficaci immediatamente, senza attendere la scadenza dell'access token.

Un utente con stato SUSPENDED:

- Non può eseguire il login.
- Non può effettuare il refresh.
- Deve vedere revocati i suoi refresh token nel momento della sospensione.
- Deve avere chiuse le sessioni WebSocket attive.

Progetta il flusso di sospensione in modo che l'invalidazione delle credenziali e la chiusura delle connessioni non dipendano esclusivamente dalla scadenza dei token.

## 4. AUTENTICAZIONE — VINCOLANTE

### 4.1. Identificativi

Tutte le tabelle devono utilizzare UUID come chiavi primarie.

Usare GenerationType.UUID, seguendo NoseY, con tipo uuid in PostgreSQL. Le chiavi esterne (FK) devono quindi utilizzare uuid.

### 4.2. Access token

L'access token è un JWT di breve durata, indicativamente 15 minuti.

Viene restituito nel body delle risposte di login e refresh.

Il frontend lo conserva esclusivamente in memoria, nello store Redux. Non deve essere salvato in localStorage.

Il token viene trasmesso:

- Nelle richieste REST tramite header Authorization: Bearer.
- Nell'header del frame CONNECT STOMP, riutilizzando il JwtChannelInterceptor di NoseY.

### 4.3. Refresh token e scadenza scorrevole

Il refresh token ha una validità di 10 giorni con scadenza scorrevole.

A ogni refresh:

- Il sistema emette un nuovo refresh token.
- Il nuovo token dispone di 10 giorni pieni di validità.
- Il vecchio refresh token viene revocato.

Un utente che utilizza regolarmente l'app resta autenticato; un utente che non la utilizza per più di 10 giorni deve effettuare nuovamente il login.

### 4.4. Cookie del refresh token

Il refresh token viaggia esclusivamente in un cookie con queste caratteristiche:

- HttpOnly.
- Path=/api/auth/refresh.
- Max-Age di 10 giorni.
- Secure=true in produzione.
- Secure=false nel profilo dev, perché in locale si utilizza HTTP.

SameSite=Lax, perché frontend e backend stanno su sottodomini dello stesso dominio personalizzato (decisione 1 della sezione 9).

Nel database, nella tabella refresh_tokens, si salva esclusivamente l'hash del refresh token, mai il valore originale.

### 4.5. Rotazione, revoca e rilevazione del riuso

Ogni refresh comporta la rotazione del refresh token: il token precedente viene revocato.

Devono essere revocati i refresh token e cancellato il relativo cookie nei seguenti casi:

- Logout.
- Reset della password.
- Sospensione dell'utente.

Il riutilizzo di un refresh token già revocato è un possibile segnale di furto del token. In questo caso devono essere invalidati tutti i refresh token di quell'utente.

Il design deve specificare come gestire in modo coerente rotazione, revoca, scadenza, riuso di token revocati, concorrenza tra richieste di refresh e cancellazione del cookie, senza indebolire i vincoli stabiliti.

### 4.6. Protezione CSRF e CORS

L'endpoint di refresh deve essere protetto da CSRF mediante:

- CORS ristretto all'origine del frontend.
- Supporto alle credenziali con allowCredentials.
- Un header custom obbligatorio, per esempio X-Requested-With.

La soluzione non deve trattare il cookie come se fosse automaticamente protetto solo perché HttpOnly.

Lo stesso token non deve mai viaggiare sia in un cookie sia come Bearer: access token e refresh token hanno ruoli distinti e canali di trasmissione distinti.

### 4.7. Login consentito solo agli utenti idonei

Il login è consentito esclusivamente agli utenti che:

- Hanno verificato la propria email.
- Hanno stato ACTIVE.

Usare il flusso di verifica email di NoseY come riferimento per la progettazione.

### 4.8. Vincolo relativo ai domini e ai browser

ATTENZIONE: due servizi Render su sottodomini diversi di onrender.com sono siti diversi per il browser, in base alla Public Suffix List.

Di conseguenza, il cookie di refresh può diventare un cookie di terze parti ed essere bloccato da Safari/iOS, compromettendo la persistenza della sessione.

L'uso di Docker non cambia questo comportamento: conta l'indirizzo pubblico effettivamente visto dal browser, non la tecnologia con cui gira il backend.

La soluzione è già decisa (decisione 1 della sezione 9): dominio personalizzato con sottodomini app. (frontend) e api. (backend) dello stesso dominio, su due servizi Render distinti.

Per il primo deploy dopo F2 (solo backend, verificato con Postman) l'indirizzo onrender.com è sufficiente. Il dominio personalizzato va configurato prima che il frontend consumi il backend in produzione. Due servizi su onrender.com senza dominio personalizzato NON sono accettabili come configurazione finale.

## 5. SCHEMA DATABASE — REQUISITI VINCOLANTI

Tutti gli identificativi e tutte le chiavi esterne sono UUID.

Lo schema seguente costituisce il modello funzionale previsto per l'MVP. Durante il design puoi definire dettagli tecnici necessari alla sua implementazione, ma non eliminare campi o funzionalità richieste. Eventuali campi aggiuntivi devono avere una motivazione tecnica, essere esplicitati e, se non già implicati dai vincoli, essere sottoposti alla mia approvazione.

### 5.1. Tabella users

Campi:

- id
- email, univoca
- password_hash
- display_name
- avatar_url
- email_verified
- status, enum ACTIVE|SUSPENDED
- bio
- city
- latitude
- longitude
- created_at

### 5.2. Tabella user_roles

Campi:

- user_id
- role
- granted_at

Chiave primaria composta: (user_id, role).

Il campo role utilizza l'enum PostgreSQL user_role con i valori definiti nella sezione RUOLI.

### 5.3. Tabella refresh_tokens

Campi:

- id
- user_id
- token_hash
- expires_at
- revoked
- created_at

Non memorizzare mai il valore originale del token.

### 5.4. Tabella official_concerts

Eventi ufficiali pubblicati da utenti HOST.

Campi:

- id
- host_id
- title
- description
- venue_name
- latitude
- longitude
- event_date
- genre_tags, tipo PostgreSQL text[]
- cover_image_url
- external_ticket_url
- created_at

La pubblicazione utilizza POST /api/official-concerts, protetto con hasRole("HOST").

### 5.5. Tabella indie_events

Eventi pubblicati da utenti MUSICIAN.

Campi:

- id
- musician_id
- title
- description
- venue_name
- latitude
- longitude
- event_date
- genre_tags
- is_free
- cover_image_url
- status, con valori draft|published
- created_at

La pubblicazione utilizza POST /api/indie-events, protetto con hasRole("MUSICIAN").

official_concerts e indie_events devono restare due tabelle distinte, con due endpoint distinti e permessi distinti. Non unificarli in un'unica entità.

Un utente con ruoli MUSICIAN e HOST può pubblicare entrambe le tipologie di evento.

### 5.6. Tabella collab_posts

Annunci di collaborazione pubblicati esclusivamente da MUSICIAN.

Campi:

- id
- musician_id
- title
- description
- role_needed
- genre_tags
- location
- is_open
- created_at

### 5.7. Tabella feed_posts

Post del feed.

Campi:

- id
- author_id
- body
- image_url
- latitude
- longitude
- likes_count, denormalizzato
- created_at

### 5.8. Tabella post_likes

Campi:

- user_id
- post_id
- created_at

Chiave primaria composta: (user_id, post_id).

### 5.9. Tabella chat_conversations

Campi:

- id
- user_a_id
- user_b_id
- created_at
- last_message_at

### 5.10. Tabella chat_messages

Campi:

- id
- conversation_id
- sender_id
- body
- read_at
- sent_at

### 5.11. Moderazione dei contenuti

Le tabelle official_concerts, indie_events, feed_posts e collab_posts hanno in più i campi:

- hidden_at, timestamptz, nullable.
- hidden_by, uuid, nullable, FK verso users.

È la decisione 6 della sezione 9: questi campi sono un'aggiunta approvata allo schema. Tutte le query pubbliche escludono le righe con hidden_at valorizzato; l'ADMIN può ripristinarle.

### 5.12. Funzionalità Post-V1: non implementare ora

Il database e l'architettura devono lasciare spazio alle seguenti evoluzioni, senza implementarle nell'MVP:

- tickets, con QR e Stripe.
- track_uploads.
- collab_matches, con ai_score per il matching tramite Claude.
- reviews.
- follows.
- notifications, per lo storico persistente delle notifiche.
- FK opzionale indie_events.official_concert_id per collegare un indie event a un concerto ufficiale.

Questi requisiti futuri non autorizzano a implementare ora le relative funzionalità. Considerali esclusivamente nel design delle dipendenze e dell'evolvibilità dello schema, evitando sovra-progettazione non necessaria.

### 5.13. Funzionalità Post-V2: non implementare ora

Sono previste, in una fase successiva:

- Notifiche push per browser e dispositivi mobili.
- Integrazione Spotify.
- Acquisto dei biglietti dei concerti ufficiali.
- Piano premium per HOST.
- Personalizzazione dei biglietti con AI.
- Autenticazione a due fattori (2FA).
- Funzionalità GDPR e anonimizzazione.

I pagamenti previsti utilizzeranno Stripe.

È inoltre possibile un futuro login social tramite Firebase Auth, limitatamente all'autenticazione. PostgreSQL rimane il database applicativo.

Non sviluppare queste funzionalità ora e non confondere il loro stato futuro con le decisioni dell'MVP.

## 6. GEOLOCALIZZAZIONE — VINCOLI

### 6.1. Geocodifica degli eventi

Quando viene pubblicato un evento, il relativo indirizzo deve essere geocodificato tramite Nominatim, utilizzando OpenStreetMap.

Vincoli:

- Servizio gratuito e senza API key.
- Rispettare il limite massimo di una richiesta al secondo.
- Inviare uno User-Agent identificativo.
- Gestire esplicitamente indirizzi non trovati.
- Gestire gli errori di rete.

La geocodifica è sincrona alla pubblicazione (decisione 3 della sezione 9), con un timeout breve: se l'indirizzo non viene trovato o il servizio non risponde, la pubblicazione fallisce con un errore chiaro e leggibile dal frontend.

### 6.2. Ricerca degli eventi vicini

La ricerca degli eventi nelle vicinanze deve utilizzare la formula di Haversine.

L'endpoint di ricerca deve accettare:

- lat
- lng
- raggio in chilometri

La ricerca deve essere paginata.

Il design deve definire come applicare i filtri geografici ai contenuti pertinenti senza eliminare le coordinate previste nello schema.

Riutilizza l'implementazione Haversine di NoseY, adattandola alle convenzioni inglesi di Resonance.

## 7. REAL-TIME: CHAT E NOTIFICHE — VINCOLANTE PER L'MVP

### 7.1. Chat privata 1:1 con STOMP

La chat privata è implementata tramite WebSocket e STOMP.

Vincoli:

- Invio dei messaggi tramite @MessageMapping.
- Consegna dei messaggi tramite /user/queue/messages.
- Errori WebSocket/STOMP tramite /user/queue/errors.
- Storico dei messaggi disponibile tramite REST, con paginazione a cursore.
- Autenticazione WebSocket attraverso access token Bearer nell'header del frame CONNECT.
- Riuso del modello di autenticazione CONNECT di NoseY.

Nell'MVP chiunque può scrivere a chiunque: la chat non dipende da un sistema di amicizie. È possibile valutare limiti anti-spam, senza introdurre arbitrariamente relazioni di amicizia o autorizzazioni non previste.

Nel controller STOMP, rispettare l'ordine dei controlli previsto dal progetto NoseY: verifica del token, rate limit, validazione del body. Non inviare una risposta diretta dal controller; riutilizzare il relativo pattern di gestione degli errori, adattandolo alle esigenze di Resonance.

### 7.2. Notifiche live

Le notifiche in-app devono essere inviate in tempo reale tramite /user/queue/notifications.

Gli eventi che generano una notifica nell'MVP sono:

- Nuovo like.
- Nuovo messaggio.
- Candidatura a una collaborazione.

Nell'MVP le notifiche NON vengono salvate nel database. Se l'utente è offline, non riceve la notifica.

Lo storico persistente delle notifiche è previsto in Post-V1, attraverso la futura tabella notifications.

La notifica deve essere inviata solo DOPO il commit della transazione. Riutilizzare il pattern di NoseY basato su NotificaLiveEvent, NotificaLiveListener e @TransactionalEventListener(AFTER_COMMIT), con consegna tramite convertAndSendToUser.

### 7.3. Autenticazione e aggiornamento dei permessi

L'access token Bearer viene inviato nell'header del frame CONNECT STOMP.

Il JwtChannelInterceptor deve caricare dal database i ruoli e lo stato aggiornati dell'utente durante il CONNECT. I ruoli e lo stato non devono essere considerati attendibili se provengono dai claim del JWT.

La sospensione di un utente comporta anche la chiusura delle sue sessioni WebSocket attive.

### 7.4. Limiti del piano gratuito Render

Il servizio Render gratuito entra in pausa dopo un periodo senza traffico. Quando ciò accade, le connessioni WebSocket vengono interrotte.

Il client frontend deve poter gestire la riconnessione automatica.

Per la demo, il servizio deve essere risvegliato prima dell'utilizzo.

Considera questo vincolo nel piano di deploy e nella preparazione della demo, senza promettere una disponibilità continua che il piano gratuito non garantisce.

## 8. RIUSO DAL PROGETTO NOSEY — DA ESAMINARE PRIMA DEL DESIGN

### 8.1. Contesto e accesso al codice

NoseY è il backend Spring Boot del progetto di team della build week, dedicato a una piattaforma eventi.

Il riuso del codice è stato autorizzato dal docente e concordato con il team.

Il codice sorgente di NoseY è in una cartella separata, esterna al repository di Resonance, al seguente percorso:

C:\Users\VGit\OneDrive\Desktop\Appunti e coding\UPLOADxGIT\Back-end\BW5\NoseY

(Il percorso contiene spazi: usalo tra virgolette nei comandi. Se non è accessibile, chiedimelo prima di procedere.)

Devi leggere il codice NoseY da questo percorso prima di progettare il backend di Resonance. Se necessario, usa /add-dir per rendere accessibile la cartella a Claude Code.

Non copiare NoseY in blocco nel repository di Resonance.

Porta soltanto le classi e i pattern concordati in questo brief, adattandoli ai pacchetti e al naming inglese di Resonance. NoseY è scritto in italiano e contiene nomi come GestoreErrori e Utente.

Durante la fase iniziale:

1. Esamina la struttura e le versioni effettive di NoseY.
2. Identifica le implementazioni corrispondenti ai componenti descritti di seguito.
3. Distingui esplicitamente ciò che va riutilizzato quasi com'è, ciò che va adattato e ciò che non deve essere portato.
4. Riassumimi che cosa hai trovato e che cosa hai capito del riuso previsto, indicando eventuali incompatibilità concrete.
5. Non modificare NoseY e non copiarne ancora file nel progetto Resonance.
6. Chiarisci gli eventuali problemi di accesso al percorso sorgente prima di formulare conclusioni su classi che non hai potuto esaminare.

### 8.2. DA RIUTILIZZARE QUASI COSÌ COM'È

#### A. Flusso di autenticazione

Riusare il flusso di:

- Registrazione.
- Codice di verifica dell'email composto da 6 cifre.
- Validità del codice di 15 minuti.
- Massimo 5 tentativi.
- Rate limit sull'invio del codice.
- Login.
- Logout.
- Password dimenticata e reset della password.
- Confronto del codice a tempo costante.
- Validazione della password con limite massimo di 72 byte, dovuto al limite BCrypt.

Adattare l'emissione e la gestione dei token al modello a due token di Resonance. Il riuso del flusso di autenticazione non significa mantenere lo schema JWT a token singolo di NoseY.

#### B. JwtFilter

Riusare il comportamento per cui, in caso di token mancante o non valido, il filtro prosegue senza autenticare la richiesta.

La risposta 401 deve essere prodotta dall'AuthenticationEntryPoint e non direttamente dal filtro.

Adattare il filtro perché carichi dal database ruoli e stato aggiornati a ogni richiesta autenticata, secondo i vincoli di Resonance.

#### C. WebSocketConfig

Riusare la configurazione con:

- Endpoint /ws senza SockJS.
- Simple broker su /queue.
- Prefissi /app e /user.
- Autenticazione del CONNECT STOMP tramite JwtChannelInterceptor.
- Origini CORS lette dalla configurazione.

#### D. SecurityConfig

Riusare:

- Modalità stateless.
- Assenza di httpBasic e formLogin.
- Elenco esplicito degli endpoint pubblici, senza wildcard.
- Permesso per /ws/\*\*, perché l'autenticazione avviene al CONNECT STOMP.
- RoleHierarchy.

Adattare l'albero dei ruoli al modello Resonance e rispettare la gerarchia limitata a SUPERADMIN > ADMIN.

#### E. Pattern delle notifiche post-commit

Riusare il pattern:

- NotificaLiveEvent.
- NotificaLiveListener.
- @TransactionalEventListener(AFTER_COMMIT).
- convertAndSendToUser.

L'obiettivo è notificare via WebSocket solo dopo il commit della transazione.

#### F. ChatWebSocketController

Riusare il pattern del controller STOMP, rispettando precisamente questo ordine:

1. Controllo del token.
2. Rate limit.
3. Validazione del body.

Non inviare risposte dirette dal controller: utilizzare la gestione degli errori prevista dal pattern NoseY, adattandola alle esigenze di Resonance.

#### G. Gestione centralizzata degli errori

Riusare e adattare:

- GestoreErrori.
- GestoreErroriStomp.
- GestoreErroriWebSocket.
- ApplicazioneException.
- CodiceErrore.
- ErroreResponse.

Tradurre il naming in inglese e definire risposte e codici d'errore stabili, leggibili dal frontend.

#### H. Paginazione

Riusare PaginaResponse<T>.

Non serializzare direttamente il Page di Spring nelle risposte API.

#### I. Geolocalizzazione

Riusare la classe utility Haversine.

#### J. Connessione al database su Render

Riusare DatabaseUrl per convertire DATABASE_URL di Render in un URL JDBC con sslmode=require.

Non registrare nei log la password del database.

#### K. Validazione delle immagini — NON nell'MVP

Nell'MVP le immagini sono solo URL (decisione 2 della sezione 9), quindi non esiste upload. Il controllo dei primi byte di NoseY (JPEG, PNG, WEBP) resta un riferimento per Post-V1, quando verrà introdotto lo storage. Nell'MVP valida solo il formato degli URL (http/https).

#### L. Servizi trasversali e configurazione

Riusare e adattare:

- LimitiService, per la gestione dei rate limit.
- ClockConfig, per rendere testabile il tempo.
- AsyncConfig.
- CorsConfig.

#### M. Email basate su eventi

Riusare il sistema basato su eventi EmailEventListener e template Thymeleaf, con implementazioni intercambiabili:

- Log in locale.
- Brevo in produzione tramite HTTP.

#### N. UUID

Riusare la generazione delle chiavi UUID tramite Hibernate, coerentemente con GenerationType.UUID e il tipo uuid di PostgreSQL.

#### O. Docker e deploy

Riusare quasi così com'è il Dockerfile di NoseY (be/Dockerfile): build multi-stage (JDK per compilare, solo JRE nell'immagine finale), cache delle dipendenze Maven, porta da PORT con 8080 come riserva, e l'opzione -XX:MaxRAMPercentage=75, necessaria per i 512 MB del piano gratuito di Render. Riusare anche .dockerignore e l'impostazione server.port: ${PORT:8080} di application.yml.

Il render.yaml di NoseY ha la stessa struttura di Resonance (un unico repository con una cartella backend e una frontend) e va ADATTATO (vedi 10.7): rootDir Resonance_BE per il backend, buildFilter su Resonance_BE/\*\* e render.yaml. Il servizio statico del frontend (rootDir Resonance_FE, build Vite, regola di rewrite verso index.html) va aggiunto al Blueprint solo quando inizia il frontend, per non far fallire i deploy con una cartella vuota. Variabili d'ambiente: rimuovere GEMINI_API_KEY; sostituire JWT_DURATA con le durate di access e refresh token; aggiungere SUPERADMIN_EMAIL e SUPERADMIN_PASSWORD come segreti (sync: false); ALLOWED_ORIGIN punta all'origine app. del dominio personalizzato. Mantenere e adattare i commenti esplicativi di NoseY su CORS e WebSocket, JWT_SECRET generato da Render, profilo prod e Brevo via HTTP (Render gratuito blocca l'SMTP).

NoseY non ha un docker-compose: usava un PostgreSQL installato localmente. Per Resonance va creato un docker-compose.yml minimo per PostgreSQL in locale, con credenziali di sviluppo non sensibili e volume persistente.

Sul PC di sviluppo è già installato un PostgreSQL locale (servizio Windows) in ascolto sulla porta 5432. Il container Docker deve quindi esporre PostgreSQL sulla porta 5433 (mappatura "5433:5432") e la configurazione del profilo dev deve usare la porta 5433. Indica la porta anche nel README, nelle istruzioni di avvio locale e di connessione con pgAdmin.

### 8.3. DA ADATTARE

#### A. Gestione dei token

NoseY usa un singolo JWT Bearer con blacklist lato server, tramite la tabella TOKEN_JWT.

Resonance deve invece utilizzare:

- Access token Bearer a breve durata.
- Refresh token in cookie HttpOnly.
- Rotazione dei refresh token.
- Hash dei refresh token nel database.
- Revoca e rilevazione del riuso secondo la sezione AUTENTICAZIONE.

Non mantenere il modello a token singolo di NoseY. La blacklist TOKEN_JWT NON va portata (decisione 4 della sezione 9).

#### B. Ruoli e gestione degli utenti

NoseY utilizza una gerarchia SUPERADMIN → ADMIN → USER.

Resonance deve adottare:

- La gerarchia SUPERADMIN → ADMIN per la piattaforma.
- I ruoli di community FAN, MUSICIAN e HOST.
- Ruoli di community additivi e senza gerarchia.
- Una sola tabella di giunzione user_roles con chiave composta (user_id, role).

Sono riferimenti utili le classi:

- AdminUtenteService.
- CambiaRuoloRequest.
- CambiaStatoUtenteRequest.
- StatoUtente.

Adatta il modello di assegnazione dei ruoli, gli endpoint e i controlli di sicurezza senza trascinare nel progetto la gerarchia USER di NoseY.

#### C. Notifiche

NoseY salva le notifiche in tabelle distinte per categoria.

Nell'MVP di Resonance le notifiche sono esclusivamente live e non vengono persistite. Il modello persistente di NoseY potrà eventualmente servire come riferimento in Post-V1, ma non va portato ora come implementazione funzionante.

#### D. Eventi

NoseY utilizza un'unica entità Evento con artisti e POI.

Resonance prevede invece due entità:

- official_concerts.
- indie_events.

Non unificare queste entità in nome del riuso.

#### E. Chat

In NoseY la chat è legata alle amicizie.

In Resonance, nell'MVP, chiunque può scrivere a chiunque. Valutare eventuali limiti anti-spam, senza introdurre un vincolo di amicizia.

#### F. Ticket e Partecipante

Ticket e Partecipante di NoseY sono soltanto riferimenti per una possibile implementazione tickets in Post-V1.

Non portarli nell'MVP di Resonance.

#### G. Naming

Tradurre tutto il codice riutilizzato in inglese, adattando nomi di classi, pacchetti, tabelle, colonne, DTO ed eventuali messaggi tecnici alla struttura di Resonance.

### 8.4. DA NON PORTARE

Non importare in Resonance:

- L'integrazione Gemini AI: l'agente AI è fuori dall'MVP.
- Il sistema di amicizie, che sarà eventualmente sostituito dai follow in Post-V1.
- Le funzionalità di anonimizzazione/GDPR, previste in Post-V2.
- Le funzioni amministrative di NoseY che eccedono la moderazione minima definita nella sezione RUOLI, per esempio gestione degli artisti, invio manuale delle notifiche e anonimizzazione.

Non aggiungere altre parti di NoseY solo perché disponibili. Il riuso deve essere selettivo, motivato e compatibile con tutti i vincoli di Resonance.

## 9. DECISIONI GIÀ PRESE PER LA SCADENZA — VINCOLANTI

Per rispettare la scadenza, le decisioni che erano aperte sono state chiuse. Non riaprirle: confermale nel design e registrale in docs/decisioni.md con il formato Scelta, Motivazione, Alternative scartate.

#### DECISIONE 1 — DOMINIO E DEPLOY

Dominio personalizzato con sottodomini app. (frontend) e api. (backend) dello stesso dominio, due servizi Render distinti. Cookie di refresh di prima parte con SameSite=Lax. Per il primo deploy del solo backend l'indirizzo onrender.com è sufficiente (vedi 4.8).
Alternative scartate: un solo servizio con un'unica immagine Docker per API e build React (frontend e backend verrebbero sempre distribuiti insieme e il Dockerfile dovrebbe costruire anche React); due servizi su onrender.com senza dominio (cookie di terze parti bloccato da Safari/iOS).

#### DECISIONE 2 — IMMAGINI

Solo URL nell'MVP (avatar_url, cover_image_url, image_url). Nessun upload. Lo storage delle immagini è rinviato a Post-V1.
Cloudinary è escluso: non va usato né proposto, nemmeno per le versioni future.
Alternativa scartata per l'MVP: bytea in PostgreSQL come NoseY, per tempo di integrazione.

#### DECISIONE 3 — GEOCODING NOMINATIM

Sincrono alla pubblicazione, con timeout breve ed errore chiaro se l'indirizzo non viene trovato o il servizio non risponde.
Alternativa scartata: geocodifica asincrona, più complessa da gestire per l'MVP.

#### DECISIONE 4 — BLACKLIST DEGLI ACCESS TOKEN

Nessuna blacklist. Bastano la revoca dei refresh token e la lettura di ruoli e stato dal database a ogni richiesta REST e al CONNECT STOMP; l'access token dura circa 15 minuti.
Alternativa scartata: tabella di blacklist come TOKEN_JWT di NoseY.

#### DECISIONE 5 — DOCUMENTAZIONE API

springdoc-openapi con Swagger UI in F6, in aggiunta alla collection Postman, che resta obbligatoria. Swagger è il taglio n. 2 della sezione 1-BIS in caso di ritardo.

#### DECISIONE 6 — CONTENUTI MODERATI

Campi hidden_at e hidden_by sulle tabelle moderabili (vedi 5.11). Tutte le query pubbliche escludono i contenuti nascosti; l'ADMIN può ripristinarli.
Alternative scartate: soft delete generico (meno tracciabile su chi ha moderato) ed eliminazione effettiva (non ripristinabile).

Se durante il design emergono altre scelte davvero indispensabili e non coperte da questo brief, non inserirle silenziosamente tra i vincoli: raccoglile in un'unica lista breve, ciascuna con la tua raccomandazione, e attendi la mia risposta.

## 10. DOCUMENTAZIONE — VINCOLANTE, SUL MODELLO DELLA CARTELLA docs/ DI NOSEY

La documentazione è parte integrante dello sviluppo, non un'attività da svolgere soltanto alla fine.

Deve esistere una cartella docs/ nel repository di Resonance. La documentazione contenuta al suo interno deve essere scritta in italiano, coerente con il codice effettivamente implementato e aggiornata durante tutto il lavoro.

Prendi come riferimento il modello della cartella docs/ di NoseY, che devi esaminare durante la fase iniziale. Adattalo a Resonance senza copiarne indiscriminatamente contenuti, decisioni o struttura tecnica.

I documenti obbligatori sono i seguenti.

### 10.1. docs/progettazione.md

Questo documento contiene il documento di design del backend approvato dopo il brainstorming.

Deve:

- Essere scritto in italiano.
- Essere organizzato in sezioni numerate.
- Riflettere le decisioni approvate e l'architettura concordata.
- Contenere lo schema DB previsto, l'architettura a pacchetti, i contratti REST e STOMP, i flussi di autenticazione, la gestione dei ruoli, la sicurezza, i test, le scelte infrastrutturali e la configurazione di deploy.
- Distinguere chiaramente i requisiti MVP dalle funzionalità Post-V1 e Post-V2.
- Rimanere coerente con lo schema, gli endpoint e il codice effettivi.

Il documento deve essere prodotto e sottoposto alla mia approvazione prima che inizi l'implementazione.

Dopo la sua approvazione, docs/progettazione.md diventa il riferimento principale per lo sviluppo.

Durante l'implementazione deve essere aggiornato quando cambiano dettagli progettuali approvati o quando vengono approvate nuove decisioni che incidono sul design.

Non modificare arbitrariamente le decisioni architetturali già approvate. Se si rende necessaria una modifica, esplicita il motivo e coinvolgimi nella decisione secondo il metodo di lavoro stabilito.

I commenti nel codice relativi a scelte tecniche non ovvie devono citare la sezione numerata di docs/progettazione.md cui fanno riferimento.

Esempio del formato da utilizzare:
"progettazione, sezione 3"

Adotta il principio di NoseY: un commento deve permettere di risalire alla motivazione e alla regola architetturale documentata, senza duplicare interi paragrafi della documentazione nel codice.

### 10.2. docs/decisioni.md

Questo documento contiene il registro delle decisioni tecniche del progetto.

Deve:

- Essere scritto in italiano.
- Contenere una voce distinta per ogni decisione tecnica significativa.
- Utilizzare sempre tre parti fisse per ogni voce:
  1. Scelta.
  2. Motivazione.
  3. Alternative scartate.

Le tre parti sono obbligatorie per tutte le voci. Non omettere la motivazione o le alternative scartate perché la decisione sembrava ovvia.

Il documento deve essere popolato SUBITO con le decisioni già stabilite in questo brief, senza attendere il completamento delle fasi.

Tra le decisioni da documentare fin dall'inizio devono esserci almeno:

- Uso di UUID per le chiavi primarie e le chiavi esterne.
- Separazione tra access token Bearer e refresh token in cookie HttpOnly.
- Rotazione e revoca dei refresh token.
- Ruoli di community additivi e senza gerarchia, con gerarchia riservata a SUPERADMIN > ADMIN.
- Lettura di ruoli e stato dal database, anziché dai claim del JWT.
- Notifiche esclusivamente live e non persistenti nell'MVP.
- Flyway per le migrazioni versionate e divieto di ddl-auto=update.
- Uso di una tabella user_roles con chiave composta.
- Separazione fra official_concerts e indie_events.
- Riuso selettivo di NoseY.
- Ciclo di sviluppo con commit eseguiti manualmente dallo studente.
- Divieto di eseguire autonomamente git commit, git push o altre operazioni Git autonome vietate.
- Documentazione aggiornata durante lo sviluppo, anziché soltanto a fine progetto.

Aggiungi inoltre una voce per ogni decisione chiusa durante il brainstorming, riportando la scelta effettiva effettuata da me.

Ogni nuova decisione tecnica presa durante lo sviluppo deve essere registrata in docs/decisioni.md NELLO STESSO SOTTO-TASK in cui viene presa.

Non rimandare queste aggiunte alla fine della fase o del progetto.

Se una modifica richiede una mia decisione, non scegliere al mio posto solo per poter completare il documento. Fermati, presenta la questione secondo il metodo di lavoro e registra la decisione soltanto dopo che è stata presa.

Quando una scelta deriva direttamente da un vincolo obbligatorio, documenta la scelta effettiva e le alternative scartate pertinenti, chiarendo perché non sono state adottate. Non inventare una discussione o una decisione dell'utente che non è mai avvenuta.

### 10.3. docs/schema-db.md

Questo documento contiene la descrizione dello schema del database.

Deve:

- Essere scritto in italiano.
- Descrivere le tabelle, i campi, i tipi, le chiavi primarie, le chiavi esterne e i vincoli rilevanti.
- Includere un diagramma ER scritto in Mermaid.
- Rimanere coerente con le migrazioni Flyway applicate e con il modello dati effettivo.
- Distinguere, quando necessario, le funzionalità previste per MVP, Post-V1 e Post-V2.

Il diagramma ER deve essere mantenuto nel formato Mermaid, affinché possa essere letto e aggiornato come parte della documentazione versionata.

docs/schema-db.md deve essere aggiornato A OGNI MIGRAZIONE FLYWAY CHE MODIFICA LO SCHEMA.

L'aggiornamento del documento non deve essere rinviato alla fine della fase o del progetto.

Quando una card modifica lo schema del database, la sua checklist deve includere l'aggiornamento di docs/schema-db.md nello stesso ciclo di lavoro relativo alla modifica.

Il diagramma e la descrizione devono rappresentare lo schema risultante dalla migrazione, non soltanto la proposta progettuale iniziale.

### 10.4. docs/report-sicurezza.md — FASE F6

Durante F6 deve essere prodotto docs/report-sicurezza.md, in versione breve e focalizzata (vincolo di tempo, sezione 1-BIS). Per la verifica dinamica, se disponibile, utilizza il plugin Strix.

Il report deve documentare una verifica di sicurezza che comprenda obbligatoriamente:

- SQL injection.
- XSS.
- CSRF.
- Attacchi all'autenticazione.

Per gli attacchi all'autenticazione devono essere verificati almeno:

- Brute force.
- Furto e riuso del refresh token.
- Escalation di ruolo.

Il lavoro deve comprendere entrambe le seguenti modalità di verifica:

1. Analisi statica del codice.
2. Verifica dinamica su un'istanza dell'applicazione in esecuzione.

Se viene applicato il taglio n. 1 della sezione 1-BIS, la verifica dinamica viene omessa e il report lo dichiara esplicitamente.

Il documento deve essere scritto in italiano e descrivere, con chiarezza:

- Le aree e i flussi verificati.
- Le verifiche e i test eseguiti.
- I risultati effettivamente ottenuti.
- Le vulnerabilità o criticità eventualmente trovate.
- Le correzioni applicate.
- Le criticità eventualmente rimaste aperte.

Non dichiarare eseguita una verifica che non è stata realmente svolta. Non inventare risultati positivi o test mai eseguiti.

La verifica deve considerare i rischi specifici di Resonance, comprese l'autenticazione a due token, la rotazione e la revoca dei refresh token, l'assegnazione dei ruoli e la separazione fra privilegi di community e privilegi di piattaforma.

La produzione e la verifica del report appartengono a F6. Non anticipare questa attività come sostitutiva dei controlli di sicurezza e dei test richiesti durante le fasi precedenti.

### 10.5. README.md nella radice del repository

Deve esistere un README.md nella radice del repository di Resonance.

Deve essere scritto in italiano e contenere almeno:

- Una descrizione di ciò che è Resonance.
- Una descrizione del backend e delle sue responsabilità.
- Le istruzioni per avviare il progetto in locale utilizzando Docker e il profilo dev.
- L'elenco delle variabili d'ambiente richieste, senza inserire valori segreti.
- Le istruzioni per importare la collection Postman.
- Il link al deploy.

Il README deve essere aggiornato durante lo sviluppo, quando cambiano le istruzioni di avvio, le variabili d'ambiente, la struttura operativa o il deploy.

Non aspettare F6 per documentare le istruzioni locali. Il README deve essere utile già quando F0 viene completata.

Se il link pubblico al deploy non è ancora disponibile, documenta lo stato effettivo senza inventare un URL. Aggiorna il link quando il deploy è realmente disponibile.

Le variabili d'ambiente devono essere nominate e spiegate, ma nessun valore segreto deve essere scritto nel README o in altri file versionati.

### 10.6. package-info.java in ogni pacchetto

Ogni pacchetto Java del backend deve avere il proprio file package-info.java.

Ogni package-info.java deve contenere una riga che descrive la responsabilità del pacchetto.

La descrizione deve essere coerente con l'organizzazione per domini e responsabilità definita in docs/progettazione.md.

Quando viene creato un nuovo pacchetto, il relativo package-info.java deve essere creato nello stesso sotto-task.

Quando la responsabilità di un pacchetto cambia in modo significativo, aggiorna la descrizione nello stesso sotto-task.

Non rimandare la creazione di questi file a un'operazione di documentazione finale.

### 10.7. render.yaml — Blueprint Render

Deve essere previsto un render.yaml nella radice del repository, utilizzato come Blueprint di Render.

Prendi come riferimento il render.yaml di NoseY, che devi esaminare durante la fase iniziale, se presente e accessibile.

Adattalo alla struttura e alle esigenze di Resonance, rispettando la soluzione approvata per dominio e deploy (decisione 1 della sezione 9).

In particolare:

- La configurazione deve prevedere il database e due servizi distinti (backend e frontend), con i domini personalizzati api. e app.
- Deve riflettere l'utilizzo del Dockerfile per il backend.
- Il servizio backend deve essere collegato al branch main (branch: main), con deploy automatico solo da main (vedi 11.4-BIS).
- Deve essere coerente con la configurazione del database, le variabili d'ambiente e i profili previsti.
- Deve evitare di inserire credenziali o altri segreti nel repository.
- Deve essere aggiornato quando cambiano le decisioni infrastrutturali approvate.

Non copiare alla cieca il Blueprint NoseY e non configurare un'architettura differente da quella approvata.

La predisposizione e la verifica di render.yaml devono comparire nella pianificazione e nella fase appropriata di configurazione e deploy.

### 10.8. Documentazione durante ogni sotto-task

La documentazione deve essere aggiornata insieme al lavoro che descrive.

Per ogni sotto-task:

- Se viene presa una nuova decisione tecnica, aggiornare docs/decisioni.md nello stesso sotto-task.
- Se viene modificato lo schema tramite Flyway, aggiornare docs/schema-db.md nello stesso sotto-task.
- Se cambia in modo approvato il design, aggiornare docs/progettazione.md nel sotto-task pertinente.
- Se vengono creati nuovi package, creare i relativi package-info.java nello stesso sotto-task.
- Se il sotto-task modifica istruzioni operative, variabili d'ambiente o informazioni di avvio, aggiornare README.md.
- Se il sotto-task tocca configurazione o documentazione relativa al deploy, aggiornare i file interessati, incluso render.yaml quando pertinente.

Non aggiungere un generico sotto-task finale chiamato "scrivere tutta la documentazione" come sostituto di questi aggiornamenti incrementali.

La documentazione aggiornata è un criterio di completamento del sotto-task quando quel sotto-task introduce o modifica informazioni che devono essere documentate.

### 10.9. Coerenza tra documentazione, codice e piano

Mantieni allineati:

- docs/progettazione.md.
- docs/decisioni.md.
- docs/schema-db.md.
- docs/report-sicurezza.md, quando verrà prodotto in F6.
- README.md.
- package-info.java.
- render.yaml.
- Codice sorgente.
- Migrazioni Flyway.
- Collection Postman.
- Piano prodotto da Superpowers.
- Card e checklist Trello.

Se emerge una divergenza, non correggerla nascondendo una decisione o modificando silenziosamente un vincolo: individua il problema, spiega le conseguenze e coinvolgimi quando è richiesta un'approvazione.

La documentazione non deve descrivere funzionalità soltanto pianificate come se fossero già implementate.

## 11. METODO DI LAVORO — VINCOLANTE

Il processo di lavoro è un requisito del progetto tanto quanto lo stack tecnologico. Deve essere rispettato anche se una skill di Superpowers suggerisce un comportamento differente.

### 11.1. Pianificazione e Trello

La pianificazione deve produrre ticket su Trello, organizzati per FASI.

Ogni ticket è una card che contiene una checklist di sotto-task rappresentati da checkbox. Ogni fase può essere composta da più card, ciascuna di circa 2–4 ore di lavoro (vedi 11.3).

Le card devono avere etichette:

- BE per backend.
- FE per frontend.

Le card BE vengono sviluppate ora.

Le card FE devono essere create già durante la pianificazione, così da avere una roadmap completa, ma restano in attesa e non devono essere sviluppate in questa attività.

Struttura Trello già predisposta da me:

- Board: Sviluppo_Resonance.
- Liste: "Fase 0", "Fase 1", "Fase 2", "Fase 3", "Fase 4", "Fase 5", "Fase 6", "FE in attesa", "In corso", "Fatto". Individua le liste per nome, non per posizione.
- Ogni card BE nasce nella lista della sua fase; tutte le card FE nascono in "FE in attesa".
- Quando inizi una card, spostala in "In corso"; dopo la mia conferma del commit, spostala in "Fatto". Una fase è conclusa quando la sua lista è vuota e le sue card sono in "Fatto".
- Etichette: BE e FE.
  Non creare altre board, liste o etichette. Prima di creare le card, verifica tramite MCP di avere accesso alla board Sviluppo_Resonance e alle sue liste; se il server MCP punta a un'altra board, fermati e avvisami.

Nome delle card: codice di fase e numero progressivo, poi un titolo breve. Esempi: "F1-01 · Registrazione e verifica email", "F1-02 · Login, refresh e logout", "FE-03 · Pagina eventi vicini". Nella descrizione della card riporta il riferimento alla sezione di docs/progettazione.md e il criterio di completamento.

Superpowers e il server MCP di Trello sono già installati e configurati. Utilizza le integrazioni disponibili, senza sostituirle con procedure manuali non necessarie.

Il file di piano prodotto da Superpowers è la fonte di verità.

Trello ne rappresenta lo specchio visivo: lo utilizzo per seguire passo passo l'avanzamento del lavoro.

Non permettere che card o checklist divergano dal piano approvato.

### 11.2. La documentazione nelle card Trello

Le card che riguardano una decisione tecnica o lo schema del database devono includere esplicitamente un sotto-task di aggiornamento della documentazione.

In particolare:

- Le card che comportano una decisione tecnica devono includere l'aggiornamento di docs/decisioni.md.
- Le card che introducono o modificano lo schema devono includere l'aggiornamento di docs/schema-db.md.
- Le card che comportano cambiamenti progettuali approvati devono includere l'aggiornamento di docs/progettazione.md, quando pertinente.
- Le card che creano pacchetti devono prevedere i relativi package-info.java.
- Le card che modificano l'avvio locale o le variabili d'ambiente devono includere l'aggiornamento del README.md.
- Le card che modificano la configurazione di deploy devono includere l'aggiornamento dei file documentali e di configurazione pertinenti, incluso render.yaml quando necessario.

Questi sotto-task non sostituiscono l'aggiornamento nello stesso sotto-task: rendono esplicita la responsabilità documentale nella checklist della card.

Non limitarti ad aggiungere una singola card documentale alla fine del progetto.

### 11.3. Ciclo di lavoro per card

Il ciclo si applica a OGNI card, senza eccezioni. Il commit è uno per card, non per sotto-task.

#### FASE 1 — INIZIO

1. Individua la card corrente.
2. Spostala in "In corso".
3. Lavora ai sotto-task della card uno alla volta, nell'ordine della checklist.

#### FASE 2 — DURANTE LA CARD

- Al termine di ogni sotto-task esegui le verifiche pertinenti (build, test) e spunta subito la sua checkbox su Trello, senza attendere la mia conferma: uso Trello per seguire l'avanzamento in tempo reale.
- Se il sotto-task ha creato o modificato un endpoint REST, aggiorna la collection Postman: per ogni endpoint nuovo o modificato servono una richiesta di successo e almeno un caso di errore significativo (401, 403 oppure 400 di validazione, secondo il comportamento effettivo).
- Aggiorna la documentazione pertinente nello stesso sotto-task, secondo la sezione 10.
- Non dichiarare superati test o verifiche che non hai realmente eseguito.
- Fermati e chiedimi solo se: serve una decisione che spetta a me; un errore non si risolve in tempi ragionevoli; per proseguire dovresti uscire dal piano approvato o dalla card corrente.

#### FASE 3 — FINE CARD

- Esegui build e test completi della card.
- Mostrami un riepilogo breve e comprensibile: sotto-task completati, file modificati raggruppati per sotto-task (compresi i file documentali), verifiche eseguite e relativo esito.
- Proponimi un messaggio di commit in stile Conventional Commits che descriva la card: titolo sintetico (es. "feat(auth): add refresh token rotation") ed elenco puntato dei sotto-task nel corpo del messaggio.
- Il messaggio di commit NON deve contenere trailer "Co-Authored-By", righe "Generated with Claude Code" o qualsiasi altro riferimento a Claude o a strumenti di intelligenza artificiale (vedi 11.4).

#### FASE 4 — ARRESTO OBBLIGATORIO

- FERMATI. Non eseguire il commit: lo eseguo io manualmente.
- Non iniziare la card successiva e non anticipare modifiche successive.
- Quando confermo il commit, sposta la card in "Fatto" e attendi il mio via per la card successiva.

### 11.4. Divieto di operazioni Git autonome

Claude NON deve mai eseguire autonomamente:

- git commit.
- git push.
- Altre operazioni Git autonome equivalenti, comprese eventuali pubblicazioni o modifiche remote.

Questo divieto vale anche quando una skill di Superpowers o un'altra procedura automatizzata suggerisce o prevede l'esecuzione autonoma di tali operazioni.

Puoi analizzare lo stato del repository e utilizzare comandi diagnostici necessari allo sviluppo, ma non devi effettuare commit, push o altre operazioni Git autonome vietate.

Attribuzione: Claude non deve mai comparire come autore o co-autore nel repository. Nessun trailer "Co-Authored-By", nessuna riga "Generated with Claude Code" e nessun riferimento a Claude o all'AI nei messaggi di commit proposti, nei file versionati (codice, commenti, documentazione, README) o in eventuali descrizioni di pull request. Questa regola prevale su qualsiasi comportamento predefinito di Claude Code o delle skill di Superpowers.

### 11.4-BIS. Branch develop e main

Il repository ha due branch:

- develop: sviluppo. Tutto il lavoro quotidiano e tutti i commit delle card avvengono su develop.
- main: produzione. È il branch collegato al deploy automatico di Render: ogni push su main aggiorna il servizio online.

Regole:

- Prima di iniziare una card, verifica (con comandi diagnostici, senza modificare nulla) di essere su develop. Se non lo sei, fermati e avvisami.
- Il merge da develop a main lo eseguo io manualmente, a fine fase, quando la fase è stabile.
- Al termine di una fase che deve andare online (dopo F2 per il primo deploy, poi dopo F3, F4, F5 e il deploy finale dopo F6), ricordami esplicitamente che è il momento del merge develop → main, indicando cosa verificare su Render dopo il deploy (log, health check, endpoint principali con l'environment render di Postman).
- Non creare altri branch (feature branch, pull request) senza la mia richiesta.

### 11.5. Dimensione di card e sotto-task

Ogni card corrisponde a circa 2–4 ore di lavoro e produce un commit leggibile. I sotto-task sono passi di circa 30–60 minuti, verificabili singolarmente.

Se una card del piano risulta più grande, dividila in più card PRIMA di crearle su Trello.

### 11.6. Chiusura delle card

Una card si considera conclusa solo quando:

- Tutte le sue checkbox sono state spuntate.
- Le verifiche pertinenti sono state eseguite.
- Le attività di documentazione e Postman previste sono state completate.
- Ho confermato di aver eseguito il commit della card: solo allora la card viene spostata in "Fatto".

Al termine di una card, non aprire o iniziare la card successiva senza la mia conferma esplicita.

### 11.7. Collection Postman obbligatoria

La collection Postman deve essere versionata nel repository, per esempio in:

/postman/resonance.postman_collection.json

Utilizzare il formato Postman Collection v2.1.

Organizzare le richieste in cartelle per dominio:

- Auth.
- Users.
- Admin.
- Events.
- Collab.
- Feed.
- Chat.

Prevedere due environment:

- local.
- render.

Utilizzare una variabile baseUrl per distinguere gli ambienti.

Non salvare segreti nei file versionati, nella collection o negli environment inclusi nel repository.

La richiesta di login deve salvare automaticamente l'access token in una variabile d'ambiente tramite uno script di test Postman. Le altre richieste devono usare tale variabile come Bearer token.

Il refresh token deve essere gestito tramite il cookie jar di Postman.

Ogni nuovo endpoint REST e ogni endpoint REST modificato devono essere documentati con una richiesta di successo e almeno un errore significativo, come indicato sopra.

### 11.8. Verifica della parte WebSocket

Gli endpoint STOMP NON devono essere inseriti nella collection Postman come se fossero normali endpoint REST.

Devono essere verificati mediante:

- Test di integrazione Spring.
- Se utile, una pagina HTML minima di prova con un client STOMP.

L'eventuale pagina di prova è esclusivamente uno strumento di test esterno al codice di produzione.

### 11.9. Fasi BE suggerite

Le seguenti fasi rappresentano la roadmap iniziale. Il brainstorming può riordinarle quando esiste una motivazione tecnica concreta, ma deve preservarne tutti i requisiti e sottopormi un piano chiaro da approvare prima di generare le card.

#### F0 — Setup (14 ottobre)

- Verifica e completamento del progetto Spring Boot già creato da me in Resonance_BE (non ricrearlo): versioni di Java e Spring Boot allineate a NoseY, dipendenze, struttura dei pacchetti, configurazione. Aggiungi tu al pom.xml tutte le dipendenze e i plugin necessari, prendendo come riferimento il pom.xml di NoseY (con le stesse versioni) ed escludendo ciò che il brief non porta (es. integrazione AI). Segnalami solo se devi cambiare la versione di Java o di Spring Boot che ho scelto.
- Docker PostgreSQL per lo sviluppo locale.
- Flyway V1.
- Profili dev e prod.
- DatabaseUrl.
- Health check.
- Dockerfile.
- Avvio della documentazione di progetto.
- Creazione di README.md, dei documenti iniziali richiesti e dei package-info.java man mano che vengono creati i pacchetti.
- Predisposizione di render.yaml secondo l'architettura approvata e verifica della configurazione pertinente.

#### F1 — Autenticazione e ruoli (14 ottobre)

- Registrazione e autenticazione.
- Verifica email.
- Refresh token.
- Rotazione e revoca.
- Ruoli.
- Bootstrap del primo SUPERADMIN.
- Aggiornamento di docs/decisioni.md e degli altri documenti pertinenti ai cambiamenti della fase.

#### F2 — Utenti e amministrazione (15 ottobre)

- Profilo utente.
- Attivazione dei ruoli MUSICIAN e HOST.
- Nomina degli ADMIN.
- Sospensione e riattivazione degli utenti.
- Primo deploy su Render (solo backend: l'indirizzo onrender.com è sufficiente, vedi 4.8).
- Aggiornamento della documentazione relativa alle nuove decisioni e ai cambiamenti operativi.

#### F3 — Eventi e geolocalizzazione (16 ottobre)

- Concerti ufficiali.
- Indie events.
- Integrazione Nominatim.
- Ricerca Haversine.
- Aggiornamento di docs/schema-db.md a ogni migrazione che modifica lo schema e di docs/decisioni.md per le eventuali nuove decisioni.

#### F4 — Collaborazioni e feed (17 ottobre)

- Collab.
- Feed.
- Like.
- Paginazione.
- Moderazione dei contenuti.
- Aggiornamento della documentazione pertinente.

#### F5 — Funzionalità real-time (18 ottobre)

- Chat.
- Notifiche live via WebSocket.
- Aggiornamento della documentazione pertinente.

#### F6 — Hardening e rilascio (19 ottobre)

- Hardening.
- Test.
- Documentazione API con springdoc-openapi / Swagger UI.
- Report di sicurezza in versione breve.
- Configurazione del dominio personalizzato api. su Render e verifica del cookie di refresh in produzione.
- Aggiornamento finale della documentazione necessaria al rilascio.
- Deploy finale.

Dopo il backend:

- 20–23 ottobre: frontend (card FE).
- 24 ottobre: integrazione, deploy finale, prova della demo.
- 25 ottobre: consegna.

L'ordine definitivo può essere adattato in fase di pianificazione, preservando il primo deploy su Render dopo F2 e la consegna finale. Le date sono il budget del vincolo di tempo (sezione 1-BIS): se una fase rischia di sforare, applica la regola dei tagli.

### 11.10. Condizioni di chiusura di ogni fase

Ogni fase si chiude soltanto quando:

- La build è verde.
- I test pertinenti alla fase sono superati.
- Le migrazioni Flyway previste sono state applicate e verificate.
- Gli endpoint interessati sono stati provati.
- La collection Postman è aggiornata per gli endpoint REST coinvolti.
- La documentazione richiesta per la fase e per i sotto-task è stata aggiornata.
- I documenti descrivono correttamente lo stato effettivo del progetto.
- Se la fase prevede un deploy, mi hai ricordato il merge develop → main e cosa verificare su Render (vedi 11.4-BIS).

Non eseguire refactor fuori dalla fase in corso.

Non anticipare attività delle fasi successive per iniziativa personale.

La documentazione obbligatoria in F6, come docs/report-sicurezza.md, non elimina il dovere di mantenere aggiornati gli altri documenti fin da F0.

### 11.11. Deploy e demo

Il deploy di Render deve utilizzare il Dockerfile.

La pianificazione deve considerare lo spin-down del piano gratuito, in particolare per WebSocket e demo.

Per la demo finale devono esistere tre account:

- SUPERADMIN, creato tramite le variabili d'ambiente.
- Un utente esistente da promuovere ad ADMIN durante la demo.
- Un utente da sospendere durante la demo.

Le operazioni di promozione e sospensione devono essere dimostrabili mediante i flussi autorizzati, senza introdurre credenziali o account privilegiati predefiniti nelle migrazioni o nel repository.

### 11.12. Spiegazioni e approvazioni

Poiché sono uno studente:

- Spiegami le scelte tecniche non banali.
- Motiva le decisioni architetturali.
- Segnala rischi, limiti e compromessi.
- Non dare per scontato che io conosca tutti i dettagli interni di Spring o della sicurezza web.
- Fermati quando una decisione spetta a me.
- Non trasformare le mie approvazioni in semplici notifiche successive a decisioni già implementate.

## 12. CONTESTO FRONTEND — SOLO RIFERIMENTO, NON SVILUPPARE

Il frontend sarà sviluppato dopo il backend (dal 20 ottobre), nella cartella Resonance_FE dello stesso repository, con il seguente stack:

- React.
- TypeScript.
- Approccio conservativo, senza React Compiler.
- Vite.
- Redux Toolkit.
- RTK Query da valutare.
- React Router.
- Bootstrap.
- CSS custom properties.
- Nessun Sass e nessun Tailwind.
- DOMPurify.

Autenticazione e client:

- L'access token viene conservato in memoria nello store Redux.
- Quando l'access token scade, il client tenta un refresh automatico e silenzioso mediante /api/auth/refresh, usando credentials: 'include'.
- Il client utilizza STOMP per chat e notifiche.
- La riconnessione WebSocket deve essere automatica.
- L'area di moderazione è visibile soltanto ad ADMIN e SUPERADMIN, fermo restando che la protezione effettiva degli endpoint è sempre responsabilità del backend.

Strumenti e UI:

- Prototipazione dell'interfaccia con Google Stitch: stitch.withgoogle.com.
- Skill "impeccable" per la rifinitura del design.
- ReactBits per i componenti animati.
- Interfaccia responsive su tre breakpoint: mobile, tablet e desktop.

Questi strumenti e requisiti servono esclusivamente a comprendere il consumatore delle API. Non devi implementare codice frontend, creare o modificare la cartella Resonance_FE o spostare componenti UI nel backend.

### 12.1. Implicazioni per la progettazione delle API

Le API devono essere progettate pensando a questo consumatore.

In particolare:

- DTO stabili e contratti chiari.
- Errori con codici leggibili e prevedibili.
- Paginazione uniforme.
- CORS configurabile con credenziali.
- Cookie di refresh compatibile con la soluzione di dominio approvata.
- Access token utilizzabile sia nelle chiamate REST sia nel CONNECT STOMP.
- Contratti coerenti per messaggi di chat, errori STOMP e notifiche.
- Ruoli di community separati dai privilegi di amministrazione.
- Nessuna dipendenza del frontend dalla serializzazione diretta delle classi interne di Spring, in particolare dal Page di Spring.

Il documento di design deve tenere conto di tutti questi aspetti, senza sviluppare il frontend.

## 13. OUTPUT ATTESO E SEQUENZA OBBLIGATORIA

Il risultato deve essere un processo guidato di progettazione, non un'unica risposta che decide tutto al posto mio.

### SEQUENZA 1 — ESAMINARE NOSEY

Prima di progettare:

- Leggi il codice NoseY dal percorso indicato.
- Identifica le classi e i pattern riutilizzabili.
- Verifica versioni e configurazioni rilevanti, confrontando il pom.xml di NoseY con quello già presente in Resonance_BE e segnalando eventuali differenze.
- Esamina, se disponibili, la cartella docs/ e il render.yaml di NoseY, per capire come adattarne struttura e convenzioni.
- Classifica il riuso nelle tre categorie vincolanti: da riutilizzare quasi così com'è, da adattare, da non portare.
- Confermami che cosa hai capito del riuso previsto.
- Evidenzia incompatibilità reali, punti non trovati e informazioni che non hai potuto verificare.
- Non iniziare a copiare file o scrivere codice.

### SEQUENZA 2 — CONFERMA DELLE DECISIONI E PUNTI DA CHIARIRE

Utilizza la skill "brainstorming" di Superpowers.

Le decisioni della sezione 9 sono già prese: confermami in poche righe di averle recepite, senza riaprirle.

Se emergono punti indispensabili non coperti dal brief, raccoglili in un'unica lista breve, ciascuno con alternative e raccomandazione, così da chiuderli in un solo giro. Fermati e attendi la mia risposta prima del documento di design.

Non chiedermi nuovamente informazioni che ti ho già fornito.

Non riaprire decisioni già stabilite dai vincoli.

Se emergono ulteriori scelte indispensabili per completare il design, presentale separatamente come questioni da chiarire, spiegando perché non possono essere dedotte dal brief. Non introdurre requisiti nuovi e non risolvere autonomamente questioni che richiedono la mia approvazione.

### SEQUENZA 3 — DOCUMENTO DI DESIGN DEL BACKEND

Dopo la conferma delle decisioni e degli eventuali punti chiariti, produci un documento di design completo e coerente.

Il documento approvato deve essere salvato in docs/progettazione.md, in italiano e con sezioni numerate, dopo che avrò approvato il contenuto. Salvalo in docs/progettazione.md invece che nel percorso predefinito della skill di brainstorming, e non eseguire il commit che la skill prevede: lo faccio io.

Il documento deve includere almeno le seguenti sezioni.

#### A. Decisioni e vincoli

- Riepilogo delle decisioni già stabilite.
- Eventuali punti chiariti durante il brainstorming e risposte concordate.
- Eventuali questioni che richiedono ancora un chiarimento o un'approvazione.
- Nessuna decisione non approvata deve essere presentata come definitiva.

#### B. Architettura applicativa

- Architettura complessiva del backend.
- Struttura dei package, organizzata per dominio e responsabilità.
- Collocazione di entity, repository, service, controller, DTO, validazione, sicurezza, gestione degli errori ed eventuali componenti trasversali.
- Responsabilità descritta in una riga nel package-info.java di ogni pacchetto.
- Organizzazione delle configurazioni dev e prod.
- Strategia di riuso e adattamento delle classi NoseY.
- Motivazione delle scelte principali, mantenendo una complessità proporzionata all'MVP.

#### C. Schema database definitivo per l'MVP

- Elenco completo delle tabelle, dei campi, dei tipi, degli identificativi e dei vincoli.
- Chiavi primarie UUID e chiavi esterne UUID.
- Chiave composta di user_roles.
- Enum PostgreSQL previsti.
- Relazioni tra entità.
- Indici e vincoli di unicità necessari.
- Strategia per likes_count denormalizzato.
- Campi hidden_at e hidden_by per la moderazione e loro uso nelle query (decisione 6).
- Elenco delle migrazioni Flyway previsto, dalla V1 in avanti, con il contenuto e lo scopo di ciascuna migrazione.
- Ordine e dipendenze delle migrazioni.
- Separazione tra implementazione MVP e predisposizioni per Post-V1/Post-V2.
- Indicazione di come docs/schema-db.md e il diagramma ER Mermaid verranno mantenuti allineati alle migrazioni applicate.

Il piano deve evitare modifiche distruttive alle migrazioni già applicate. Le credenziali non devono mai essere incluse nelle migrazioni.

#### D. Contratti REST

- Elenco ragionato di tutti gli endpoint REST previsti per le funzionalità dell'MVP.
- Metodo HTTP, percorso, scopo, ruolo o condizione di accesso.
- DTO di richiesta e risposta.
- Validazioni rilevanti.
- Codici HTTP e codici d'errore significativi.
- Paginazione uniforme.
- Regole di ordinamento e filtri dove necessari e giustificati dai requisiti.
- CORS e comportamento con credentials.
- Contratti compatibili con il frontend indicato nella sezione 12.

Includi i flussi per autenticazione, verifica email, refresh, logout, password dimenticata/reset, profilo utente, attivazione dei ruoli, moderazione, eventi, geolocalizzazione, collaborazioni, feed, like e storico della chat, oltre agli endpoint amministrativi previsti.

Distingui le funzionalità che devono esistere nell'MVP da quelle rinviate alle versioni successive.

#### E. Contratti WebSocket/STOMP

- Endpoint di connessione.
- Configurazione di broker e prefissi.
- Destinazioni di invio e ricezione.
- Mapping per la chat.
- Destinazione /user/queue/messages.
- Destinazione /user/queue/errors.
- Destinazione /user/queue/notifications.
- Struttura dei messaggi e degli errori.
- Autenticazione del CONNECT.
- Controlli di autorizzazione e rate limit.
- Invio delle notifiche dopo il commit.
- Comportamento previsto per utenti sospesi e sessioni da chiudere.
- Strategia di riconnessione attesa dal frontend e limiti operativi del piano gratuito Render.
- Test di integrazione e modalità di verifica, senza inserire STOMP nella collection Postman REST.

#### F. Flussi completi di autenticazione

Descrivi in modo operativo i flussi di:

- Registrazione.
- Verifica email con codice a 6 cifre.
- Login.
- Emissione dell'access token e del refresh token.
- Refresh con rotazione.
- Logout.
- Password dimenticata e reset.
- Refresh token scaduto o revocato.
- Rilevamento del riuso di un refresh token revocato.
- Revoca di tutti i refresh token dell'utente nei casi previsti.
- Sospensione e tentativi di login/refresh di utenti sospesi.
- Gestione del cookie, CORS e protezione CSRF.
- Bootstrap del primo SUPERADMIN.

Distingui le responsabilità del backend da quelle del frontend e non introdurre salvataggi persistenti dell'access token nel browser.

#### G. Sicurezza e autorizzazioni

- Spring Security stateless.
- JwtFilter e comportamento dell'AuthenticationEntryPoint.
- JwtChannelInterceptor.
- Lettura dei ruoli e dello stato dal database.
- RoleHierarchy limitata a SUPERADMIN > ADMIN.
- Permessi di community e di piattaforma.
- Endpoint pubblici espliciti.
- Protezione degli endpoint di moderazione.
- Regole per sospensione e riattivazione.
- Gestione della chiusura delle sessioni WebSocket.
- Cookie HttpOnly e protezione CSRF.
- CORS e credenziali.
- Validazione input.
- Rate limit e validazione delle immagini.
- Protezione dei segreti e dei dati sensibili nei log.
- Assenza di blacklist degli access token (decisione 4) e relative motivazioni.

#### H. Test

- Strategia di unit test con JUnit 5.
- Test di integrazione Spring.
- Test dei repository e delle migrazioni pertinenti.
- Test dei casi validi e dei casi di errore.
- Test per ruoli multipli e autorizzazioni.
- Test per utenti sospesi.
- Test della rotazione e del riuso dei refresh token.
- Test dei codici di verifica email, inclusi scadenza, tentativi massimi e rate limit.
- Test del comportamento dei filtri JWT.
- Test delle connessioni STOMP e dei messaggi live.
- Test della consegna delle notifiche solo dopo il commit.
- Test della paginazione a cursore della chat.
- Test Haversine e integrazione Nominatim, usando strategie testabili senza dipendere inutilmente dal servizio esterno.
- Collection Postman per i casi REST.
- Eventuale pagina HTML di prova STOMP fuori dal codice di produzione.

I test devono riflettere i requisiti reali e non essere usati per giustificare semplificazioni arbitrarie.

I dettagli dei test e delle verifiche devono essere proporzionati a ciascun sotto-task, senza rinviare tutti i controlli alla fine del progetto.

#### I. Email

- Flusso a eventi.
- Template Thymeleaf.
- Log in locale.
- Invio tramite Brevo via HTTP in produzione.
- Gestione della verifica email e del recupero password.
- Configurazione per ambiente e protezione dei segreti.

#### J. Geolocalizzazione

- Geocodifica sincrona con timeout (decisione 3).
- Rispetto del limite di una richiesta al secondo.
- User-Agent identificativo.
- Gestione di indirizzi non trovati ed errori di rete.
- Ricerca Haversine parametrizzata con lat, lng e raggio in km.
- Paginazione dei risultati.

#### K. Deploy e configurazione

- Docker Compose o configurazione equivalente per PostgreSQL locale, secondo l'impostazione approvata.
- Profili dev e prod.
- Flyway.
- Health check.
- Dockerfile.
- Conversione DATABASE_URL di Render tramite DatabaseUrl, con sslmode=require.
- Divieto di loggare password.
- Variabili d'ambiente necessarie.
- Bootstrap del SUPERADMIN.
- Configurazione CORS e cookie per i domini app. e api. (decisione 1), e uso dell'indirizzo onrender.com per il primo deploy.
- Strategia per il primo deploy dopo F2.
- Deploy finale.
- Gestione dello spin-down Render e preparazione del servizio per la demo.
- Eventuali implicazioni per una futura migrazione su VPS o per un piano a pagamento.
- Strategia per render.yaml, Blueprint Render da adattare al progetto NoseY e alla soluzione approvata.

#### L. Documentazione del progetto

Descrivi la struttura documentale richiesta e il processo per mantenerla aggiornata.

Includi obbligatoriamente:

- docs/progettazione.md, in italiano, con sezioni numerate e riferimenti dai commenti del codice alle sezioni pertinenti.
- docs/decisioni.md, con Scelta, Motivazione e Alternative scartate per ogni decisione.
- docs/schema-db.md, con schema e diagramma ER Mermaid, aggiornato a ogni migrazione che modifica lo schema.
- docs/report-sicurezza.md in F6, con analisi statica e verifica dinamica di SQL injection, XSS, CSRF, brute force, furto/riuso del refresh token ed escalation di ruolo.
- README.md nella radice, con descrizione, avvio locale tramite Docker e profilo dev, variabili d'ambiente senza segreti, importazione Postman e link al deploy.
- package-info.java in ogni package, con una riga sulla relativa responsabilità.
- render.yaml, Blueprint Render basato sul riferimento NoseY e adattato alla soluzione approvata.
- Aggiornamento documentale nello stesso sotto-task quando la modifica lo richiede.
- Inclusione di sotto-task documentali nelle card Trello che riguardano decisioni o schema database.

#### M. Roadmap e ticket

- Roadmap per fasi.
- Dipendenze tra fasi.
- Distinzione BE/FE.
- Sotto-task piccoli e verificabili.
- Criteri di completamento per ogni fase.
- Requisiti della demo finale.
- Collection Postman e deliverable documentali collegati a ogni fase.
- Aggiornamenti di docs/decisioni.md, docs/schema-db.md e degli altri documenti pertinenti durante lo sviluppo.
- Verifica che le card relative a decisioni e schema contengano i relativi sotto-task documentali.

#### N. Funzionalità future

- Elenco separato di Post-V1 e Post-V2.
- Dipendenze architetturali da non rendere impossibili.
- Conferma esplicita che tali funzionalità non sono implementate nell'MVP.

Non serve produrre codice di esempio nel documento. Servono decisioni, contratti, architettura, schemi e piano di lavoro concreti.

### SEQUENZA 4 — APPROVAZIONE DEL DOCUMENTO

Presentami il documento di design per la revisione.

Non creare ancora le card Trello e non iniziare a scrivere codice finché non avrò approvato esplicitamente il design.

Prima dell'approvazione, docs/progettazione.md è una proposta in revisione, non un documento definitivo.

Dopo l'approvazione, salva e mantieni in docs/progettazione.md il design approvato e usalo come riferimento per le fasi successive.

Se richiedo modifiche, aggiorna il documento mantenendo traccia delle decisioni già approvate ed evita di riaprire questioni già chiuse, a meno che non sia emerso un conflitto tecnico reale che debba essere esplicitamente discusso.

Popola docs/decisioni.md con le decisioni già stabilite nel brief e con quelle chiuse durante il brainstorming, rispettando sempre il formato Scelta, Motivazione, Alternative scartate.

Non attendere F6 per iniziare la documentazione.

Insieme alla documentazione iniziale:

- Salva questo brief integralmente in docs/brief.md, come riferimento per le sessioni future.
- Salva in docs/riuso-nosey.md una mappa sintetica del riuso: per ogni classe o pattern di NoseY, dove e con quale nome finisce in Resonance. Nelle fasi successive consulta questa mappa e leggi da NoseY solo i file necessari alla card corrente, senza rileggere l'intero progetto.
- Crea CLAUDE.md nella radice del repository con le regole permanenti di lavoro, in forma sintetica: il vincolo di tempo della sezione 1-BIS, il ciclo per card della 11.3, il divieto di operazioni Git e la regola di attribuzione della 11.4, la strategia dei branch della 11.4-BIS, le regole di aggiornamento documentale della 10.8, le regole Postman della 11.7 e 11.8, e le regole finali della sezione 14. Indica in CLAUDE.md di consultare docs/brief.md, docs/progettazione.md, docs/riuso-nosey.md e il piano di Superpowers all'inizio di ogni sessione.
- In CLAUDE.md specifica inoltre: se è attivo uno stile di risposta sintetico, le spiegazioni delle scelte tecniche e le richieste di decisione restano complete e comprensibili.
- Usa output di build e test sintetici (es. Maven in modalità quiet), mostrando i dettagli solo in caso di errore.
  Questi file faranno parte del mio primo commit manuale.

### SEQUENZA 5 — CREAZIONE DELLE CARD TRELLO

Soltanto dopo la mia approvazione esplicita del documento di design:

- Utilizza il server MCP di Trello già configurato.
- Crea le card per le fasi approvate.
- Inserisci in ogni card la checklist di sotto-task.
- Applica le etichette BE e FE.
- Crea anche le card FE per la roadmap, lasciandole in attesa e senza svilupparle.
- Organizza la roadmap in modo coerente con il file di piano prodotto da Superpowers, che rimane la fonte di verità.
- Verifica che le card riflettano il piano approvato e che ogni card corrisponda a circa 2–4 ore di lavoro e a un commit leggibile.
- Inserisci sotto-task espliciti per gli aggiornamenti documentali richiesti dalle singole card.
- Per le card che toccano una decisione tecnica o lo schema DB, includi il corrispondente sotto-task di aggiornamento della documentazione.
- Prevedi la creazione e l'aggiornamento incrementale dei documenti obbligatori nelle fasi appropriate.
- Colloca docs/report-sicurezza.md nella pianificazione di F6.

Non iniziare il coding durante la sola creazione delle card.

### SEQUENZA 6 — AUTORIZZAZIONE ALL'IMPLEMENTAZIONE

Dopo la creazione delle card, fermati e chiedimi esplicitamente l'autorizzazione a iniziare l'implementazione.

Quando mi chiedi l'autorizzazione, ricordami di preparare la sessione di implementazione PRIMA di darti il via:

1. eseguire /clear per chiudere la sessione di progettazione;
2. cambiare modello con /model, passando a quello scelto per l'implementazione;
3. attivare la skill caveman;
4. rieseguire /add-dir sul percorso di NoseY;
5. avviare la nuova sessione chiedendoti di leggere CLAUDE.md, docs/brief.md, docs/progettazione.md e docs/riuso-nosey.md e di partire dalla prima card della lista "Fase 0".

Anche con design approvato e card già presenti su Trello, non devi scrivere codice senza il mio via esplicito.

Quando autorizzo l'implementazione:

- Parti esclusivamente da F0.
- Lavora una card alla volta, rispettando integralmente il ciclo della sezione 11.3.
- Verifica il lavoro prima di presentarlo.
- Aggiorna Postman per ogni endpoint REST creato o modificato.
- Aggiorna la documentazione nello stesso sotto-task quando richiesto.
- Aggiorna docs/decisioni.md nel medesimo sotto-task in cui viene presa una nuova decisione tecnica.
- Aggiorna docs/schema-db.md a ogni migrazione Flyway che modifica lo schema.
- Crea package-info.java quando viene creato un package.
- Mostrami i file modificati e il motivo, compresi i file documentali.
- Proponi un messaggio Conventional Commits.
- A fine card fermati senza eseguire il commit.
- Attendi la mia conferma del commit prima di spostare la card in "Fatto" e passare alla successiva.

Non saltare fasi e non lavorare in anticipo su funzionalità successive.

## 14. REGOLE FINALI DI COMPORTAMENTO

Durante tutto il lavoro:

1. Rispetta ogni vincolo tecnico e funzionale esplicitamente indicato in questo brief.
2. Non eliminare, riassumere o indebolire i requisiti per semplificare l'implementazione.
3. Non trasformare decisioni già prese in domande aperte.
4. Non trasformare in scelte automatiche i punti da chiarire che emergono: presentali con alternative, pro, contro e raccomandazione, poi attendi la mia risposta.
5. Non inventare requisiti. Segnala gli aspetti realmente mancanti e chiariscili quando necessario.
6. Non scrivere codice durante il brainstorming e la progettazione.
7. Leggi NoseY prima di finalizzare la proposta architetturale e riferisci che cosa hai effettivamente verificato.
8. Non copiare in blocco NoseY e non importare le funzionalità esplicitamente escluse.
9. Non sviluppare il frontend.
10. Non implementare funzionalità Post-V1 o Post-V2 nell'MVP.
11. Non eseguire commit, push o altre operazioni Git autonome vietate.
12. Spunta i sotto-task su Trello appena completati e verificati; sposta la card in "Fatto" solo dopo la mia conferma del commit.
13. Non aprire la card successiva senza la mia conferma al termine della card corrente.
14. Non iniziare una fase senza avere concluso la fase precedente secondo i criteri concordati.
15. Mantieni il design, la roadmap, le card Trello, il database, gli endpoint e la collection Postman coerenti tra loro.
16. Spiegami le scelte non banali in modo chiaro, tenendo conto che sono uno studente.
17. Se individui un rischio o un'incompatibilità reale, dichiaralo in modo trasparente; non correggere unilateralmente il brief.
18. Considera il documento di design approvato e il piano di Superpowers come riferimenti operativi per le fasi successive.
19. Mantieni la documentazione in italiano e aggiornala durante lo sviluppo, non soltanto alla fine.
20. Rispetta il formato fisso Scelta, Motivazione, Alternative scartate per ogni voce di docs/decisioni.md.
21. Mantieni docs/schema-db.md e il suo diagramma ER Mermaid allineati a ogni migrazione Flyway che cambia lo schema.
22. Associa ai commenti sulle scelte tecniche non ovvie il riferimento alla sezione numerata di docs/progettazione.md, come nel modello NoseY.
23. Crea package-info.java in ogni pacchetto, con una riga sulla responsabilità del pacchetto.
24. Mantieni README.md e render.yaml coerenti con la configurazione realmente approvata e implementata.
25. In F6 esegui e documenta le verifiche statiche e dinamiche previste in docs/report-sicurezza.md, senza dichiarare verifiche mai effettuate.
26. Fai in modo che le card Trello relative a decisioni e schema includano esplicitamente il sotto-task di aggiornamento documentale.
27. Non considerare completato un sotto-task se manca l'aggiornamento documentale richiesto.
28. Non considerare la documentazione finale un sostituto degli aggiornamenti incrementali.
29. Se una decisione è ancora aperta, non documentare una soluzione ipotizzata come se fosse già stata approvata.
30. Se il documento approvato richiede una modifica, esplicita la necessità e coinvolgimi prima di cambiare unilateralmente una decisione già presa.
31. Rispetta il vincolo di tempo della sezione 1-BIS: segnala subito i ritardi e proponi i tagli nell'ordine stabilito.
32. Lavora sempre sul branch develop; main è la produzione collegata a Render e il merge develop → main lo eseguo io a fine fase.
33. Non comparire mai come autore o co-autore: niente Co-Authored-By, niente "Generated with Claude Code", nessun riferimento a Claude o all'AI nei commit proposti e nei file del repository.

Il tuo primo passo è quindi esaminare NoseY dal percorso indicato, se accessibile, e restituirmi una conferma ragionata di ciò che hai capito del riuso, senza modificare file o scrivere codice. Esamina anche, se disponibili, la sua cartella docs/ e il suo render.yaml per comprendere il modello documentale e infrastrutturale.

Successivamente confermeremo le decisioni della sezione 9 e chiariremo in un solo giro gli eventuali punti mancanti, per chiudere il design in giornata.

Ricorda: il risultato che cerco è un backend solido e coerente con i requisiti, realizzabile passo dopo passo da uno studente, testabile, documentato, distribuibile presto su Render e integrabile correttamente con il frontend che svilupperò dal 20 ottobre.
