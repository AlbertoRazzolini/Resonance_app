# Resonance

Resonance è una web app di community musicale locale che mette in contatto **fan**, **musicisti** e
**host** (locali e organizzatori di eventi). È il progetto capstone del bootcamp Epicode
"Master Full-Stack AI Developer" di Firenze.

Il repository contiene:

| Cartella | Contenuto |
|---|---|
| `Resonance_BE/` | Backend Spring Boot (questo documento ne descrive l'avvio). |
| `Resonance_FE/` | Frontend React + TypeScript (Vite), in sviluppo (vedi "Frontend"). |
| `docs/` | Brief, progettazione, registro delle decisioni, schema del database, mappa del riuso. |

## Backend

Il backend espone le API REST e il canale WebSocket (STOMP) di Resonance. Le sue responsabilità:

- autenticazione con due token (access token Bearer di breve durata, refresh token in cookie
  `HttpOnly`) e verifica dell'email;
- ruoli di community (fan, musicista, host) e di piattaforma (admin, superadmin), con sospensione
  degli utenti;
- eventi con geolocalizzazione: concerti ufficiali (host) e indie event (musicisti), ricerca per raggio;
- annunci di collaborazione, feed con like, chat privata e notifiche live.

Stack: Java 25, Spring Boot 4.1.1, PostgreSQL con Flyway. Il design di riferimento è in
`docs/progettazione.md`.

> Stato: il backend è completo (fasi F0-F6). Sono implementati autenticazione a due token, ruoli e
> admin, eventi con geolocalizzazione, annunci collab, feed con like, amicizie e ricerca utenti, chat e
> notifiche live, moderazione, documentazione OpenAPI e il fallback che serve il frontend dallo stesso
> servizio. Il frontend (`Resonance_FE/`) è in sviluppo: per ora ha solo la struttura di base (barra di
navigazione, router, build integrata nell'immagine Docker).

## Prerequisiti

- JDK 25
- Docker (PostgreSQL in locale)
- Node 24 LTS (solo per il frontend)

## Avvio in locale

> **Attenzione:** in dev l'app non parte senza `JWT_SECRET` nella configurazione di avvio di IntelliJ.

1. **Database.** Dalla radice del repository: `docker compose up -d`. Il container espone PostgreSQL
   sulla **porta 5433**, solo su localhost (`127.0.0.1:5433`; la 5432 è quella del PostgreSQL di Windows). Crea i database `resonance`
   (sviluppo) e `resonance_test` (test); lo script di init gira solo alla prima creazione del volume:
   per rifarlo, `docker compose down -v` cancella anche i dati.
2. **Connessione con pgAdmin.** Host `localhost`, porta `5433`, database `resonance`, utente
   `resonance`; la password di sviluppo (non sensibile) è in `docker-compose.yml`.
3. **Avvio da IntelliJ.** Nella configurazione di avvio dell'applicazione imposta le variabili
   d'ambiente `SPRING_PROFILES_ACTIVE=dev` e `JWT_SECRET=<una stringa casuale di almeno 32 caratteri>`
   (in IntelliJ si separano con `;`). Non scrivere il segreto in nessun file del repository.
4. **Avvio dal terminale** (dalla cartella `Resonance_BE`), con le stesse due variabili d'ambiente
   impostate: `./mvnw spring-boot:run` (in PowerShell `.\mvnw.cmd spring-boot:run`).
5. **Verifica.** `GET http://localhost:8080/api/health` risponde `{"status":"UP","database":"UP"}`.
   All'avvio Flyway applica le migrazioni da solo.

### Primo SUPERADMIN

All'avvio, se non esiste ancora nessun SUPERADMIN, l'applicazione ne crea uno dalle variabili
d'ambiente `SUPERADMIN_EMAIL` e `SUPERADMIN_PASSWORD`. In IntelliJ aggiungile alle variabili d'ambiente
della configurazione di avvio, accanto a `JWT_SECRET` (separate da `;`); su Render si impostano a mano
nella dashboard (`sync: false`, mai nel repository).

- La password deve avere almeno 8 caratteri e al massimo 72 byte in UTF-8, altrimenti l'avvio fallisce
  con un messaggio chiaro (che non riporta la password).
- Se manca una delle due variabili, il backend parte lo stesso e scrive un avviso nel log.
- Se esiste già un utente con quell'email, riceve il ruolo SUPERADMIN, viene marcato verificato e attivo e
  la sua password diventa quella della variabile. Altrimenti l'utente viene creato (nome "Superadmin").
- Dal secondo avvio non cambia più nulla: se esiste un SUPERADMIN, le variabili vengono ignorate. La
  password non compare mai nei log.
- In dev la password dimenticata si recupera come per qualunque utente: il codice di reset compare nel log
  del backend (email finta).

Build e test, sempre dalla cartella `Resonance_BE`: `./mvnw -q verify` (in PowerShell
`.\mvnw.cmd -q verify`). **I test di integrazione richiedono il database acceso:** prima di lanciarli
esegui `docker compose up -d` dalla radice del repository. Usano il database `resonance_test`,
che viene svuotato prima di ogni test.

**Immagine Docker** (quella che userà Render), dalla **radice** del repository, non da `Resonance_BE`:
`docker build -f Resonance_BE/Dockerfile -t resonance .` L'immagine compila anche il frontend (stage Node) e
ne copia `dist/` in `static/`: backend e frontend escono da un solo servizio.

## Frontend

Cartella `Resonance_FE/`: React 19, TypeScript `strict`, Vite, Redux Toolkit, React Router e Bootstrap
(react-bootstrap). Richiede **Node 24** e npm. Comandi, da `Resonance_FE/`:

1. `npm ci` installa le dipendenze (dal lock).
2. `npm run dev` avvia il server di sviluppo su `http://localhost:5173`. **Serve il backend in dev sulla
   8080** (vedi "Avvio in locale", con il database acceso): Vite inoltra `/api` e `/ws` alla 8080, così il
   browser vede una sola origine e il cookie di refresh funziona anche in locale.
3. `npm run lint` (ESLint), `npm run format` (Prettier) e `npm test` (Vitest con Testing Library e MSW).
4. `npm run build` compila in `dist/`; `npm run preview` lo serve su `http://localhost:4173` con lo stesso
   proxy e con l'header `Content-Security-Policy` della decisione 76. L'anteprima serve a trovare le
   violazioni (script inline, da CDN o `eval`, vietati) prima del deploy.

I percorsi dell'app, tutti in italiano, sono definiti in un solo file, `src/app/routes.ts`.

Gli stili stanno in `src/styles/`: i colori, i caratteri (Barlow Condensed dal pacchetto npm, nessun font da
CDN) e le spaziature sono custom properties `--rs-*` in `tokens.css`, collegate a Bootstrap da
`bootstrap-overrides.css` (decisione 80). Il tema è scuro.

## Variabili d'ambiente

Nessun segreto è scritto nei file del repository: i valori arrivano dall'ambiente (in locale dalla
configurazione di avvio di IntelliJ, su Render dal Blueprint o dalla dashboard).

| Variabile | Obbligatoria | Scopo |
|---|---|---|
| `SPRING_PROFILES_ACTIVE` | sì | Profilo attivo: `dev` in locale, `prod` su Render. |
| `PORT` | no | Porta del server; la imposta Render, default 8080. |
| `DATABASE_URL` | prod | URL del database fornito da Render. |
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | no | Sostituiscono i valori di sviluppo del database locale. |
| `JWT_SECRET` | sì | Segreto per firmare gli access token (almeno 32 byte, nessun valore predefinito). |
| `ACCESS_TOKEN_TTL` | no | Durata dell'access token (predefinito 15 minuti). |
| `REFRESH_TOKEN_TTL` | no | Durata del refresh token (predefinito 10 giorni). |
| `ALLOWED_ORIGIN` | no | Origini esterne ammesse per CORS e WebSocket (solo sviluppo, separate da virgola). |
| `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD` | per il bootstrap | Credenziali del primo SUPERADMIN, creato all'avvio se non esiste (vedi "Primo SUPERADMIN"). |
| `BREVO_API_KEY`, `MAIL_FROM` | prod | Invio delle email tramite Brevo; mittente confermato in Brevo. |
| `GEOCODING_CONTACT` | prod | Contatto (email) inserito nello User-Agent delle richieste a Nominatim, che lo richiede nella sua policy: `Resonance/1.0 (contatto)`. Se è vuoto, lo User-Agent resta `Resonance/1.0`. Il client fa al massimo una richiesta al secondo; nei test Nominatim è sostituito da uno stub. |

## Postman

La collection e gli environment stanno in `postman/`:

- `resonance.postman_collection.json` (formato v2.1): cartelle Health, Auth, Users, Admin, Events,
  Collab, Feed, Friends, Notifications e Chat. Ogni cartella ha le richieste di successo e gli errori più significativi degli endpoint REST: Health, Auth (registrazione, verifica, password dimenticata e reset, login, refresh, logout), Users (profilo e ruoli), Admin (elenco utenti, sospensione, nomina e revoca ADMIN, moderazione), Events (concerti ufficiali e indie event), Collab, Feed, Friends (richiesta, rifiuto silenzioso, annulla, accetta, elenchi, rimozione), Notifications (elenco, conteggio delle non lette, segna letta, segna tutte lette) e Chat (conversazioni, storico a cursore, lettura). L'autorizzazione Bearer `{{accessToken}}` è impostata a
  livello di collection.
- `resonance-local.postman_environment.json` (`baseUrl` = `http://localhost:8080`) e
  `resonance-render.postman_environment.json` (`baseUrl` = `https://resonance-6o89.onrender.com`).

Come usarli: in Postman, **Import** e scegli i tre file; poi seleziona l'environment `local` in alto a
destra, avvia il backend con il profilo `dev` (vedi "Avvio in locale") e lancia le richieste della
cartella Health. Per le richieste di Auth crea nell'environment le variabili `userEmail` e `userPassword`
(utente già verificato nel database); per il reset della password servono anche `resetCode` (il codice
scritto nel log del backend dopo "Forgot password") e `newPassword`: lo script del login salva `accessToken` e le altre richieste lo usano
come Bearer; il refresh e il logout usano il cookie jar di Postman e inviano a mano `X-Requested-With`.
Per la cartella Admin servono il login come SUPERADMIN (account creato dal bootstrap), la richiesta Me di Users (salva `userId`) e le variabili `fanAccessToken` e `adminAccessToken`, da copiare da un login come FAN e come ADMIN; l'elenco salva `targetUserId`, usato dalle richieste seguenti. La cartella Friends usa `accessToken` e `fanAccessToken` come le due parti (due utenti diversi) più `userId` di Users; si esegue in ordine e finisce con l'amicizia rimossa, così si può rieseguire. La cartella Notifications si esegue dopo Friends: usa `accessToken` e `fanAccessToken`, `userId` di Users e `friendUserId` di Friends, e finisce annullando la richiesta, così si può rieseguire. La cartella Chat usa `accessToken`, `fanAccessToken` e `adminAccessToken` (un terzo utente, non membro e non amico del secondo): rende amici i primi due, apre la conversazione e finisce rimuovendo l'amicizia, così si può rieseguire. Nei file versionati non c'è nessun segreto: token e credenziali stanno solo nelle variabili locali di Postman. La parte STOMP (chat e notifiche) non è nella collection.

## Deploy

Il backend è online su Render: **https://resonance-6o89.onrender.com** (health check:
`/api/health`). Il Blueprint `render.yaml` crea il database `resonance-db` (PostgreSQL 17) e un solo
servizio web `resonance` (Docker, piano gratuito, Frankfurt); il deploy parte dai push su `main`.

Il servizio serve API e frontend dalla stessa origine. I file statici stanno in `classpath:/static/`
(`SpaResourceConfig`): una rotta del frontend senza estensione (es. `/eventi/123`) risponde con
`index.html`, i file in `/assets/` hanno la cache lunga (un anno), `index.html` no. Un percorso `/api/...`
inesistente risponde sempre 404 in JSON, mai con `index.html`. Il frontend lo compila lo stage Node del
Dockerfile e finisce in quella cartella; senza `dist/` (per esempio nei test di Maven) le rotte del frontend
rispondono 404 JSON.

Documentazione OpenAPI: `/swagger-ui.html` (interfaccia) e `/v3/api-docs` (JSON), pubbliche in sola lettura.

**Spin-down.** Il piano gratuito sospende il servizio dopo circa 15 minuti senza traffico: la prima
richiesta dopo la pausa attende il risveglio (circa un minuto; il primo avvio a freddo è durato quasi
tre minuti). Prima di una prova o di una demo conviene aprire `/api/health` qualche minuto prima.

**Segreti.** Si impostano a mano nel pannello Render (Environment del servizio `resonance`), mai nel
repository: `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, `BREVO_API_KEY`, `MAIL_FROM`,
`GEOCODING_CONTACT`.

**Verificato su Render** (con `curl` e con il Collection Runner di Postman, non da un browser): registrazione con invio reale del codice
via Brevo, verifica, login, refresh e logout; il cookie `resonance_refresh` arriva con `Secure`,
`HttpOnly` e `SameSite=Lax` (decisione 47); login e refresh con `Origin` della stessa origine
rispondono 200, mentre un `Origin` di un altro sito dà 403 "Invalid CORS request". Il proxy di
Render risulta quindi interno per Tomcat e non serve `server.tomcat.remoteip.internal-proxies`. Non
ancora provato su Render: il refresh da un browser reale e il WebSocket sulla stessa origine (vedi
"Verifica del rilascio finale").

### Verifica del rilascio finale

Dopo il merge `develop → main` (lo esegue lo studente) e il deploy automatico di Render:

1. **Log di avvio** nella dashboard di Render: Flyway applica le migrazioni, il bootstrap del SUPERADMIN non
   segnala errori, nessuna eccezione.
2. **Health check:** `GET https://resonance-6o89.onrender.com/api/health` risponde `{"status":"UP","database":"UP"}`.
3. **Postman:** environment `render`, cartelle principali (Health, Auth, Users, Admin, Events, Feed, Friends).
4. **Fallback:** `GET /api/inesistente` risponde 404 JSON (`code` `NOT_FOUND`); `GET /eventi/123` risponde 404 JSON
   finché non c'è il frontend e `index.html` quando c'è.
5. **Cookie di refresh in un browser reale.** Apri `https://resonance-6o89.onrender.com/api/health` e, dalla
   console degli strumenti per sviluppatori, incolla (con le credenziali di un utente di prova, mai salvate
   in un file):

   ```js
   const login = await fetch('/api/auth/login', {
     method: 'POST', credentials: 'include',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ email: '<email>', password: '<password>' })
   });
   const { accessToken } = await login.json();
   console.log('login', login.status);                       // atteso 200
   const refresh = await fetch('/api/auth/refresh', {
     method: 'POST', credentials: 'include',
     headers: { 'X-Requested-With': 'XMLHttpRequest' }
   });
   console.log('refresh', refresh.status);                   // atteso 200
   ```

   Il cookie `resonance_refresh` è `HttpOnly`: non si legge dal JavaScript, si vede in Strumenti per sviluppatori,
   Archiviazione (o Application), Cookie, con `Secure`, `HttpOnly`, `SameSite=Lax` e `Path=/api/auth/refresh`.
   Il refresh risponde 200 solo se il browser l'ha salvato e rimandato. Se disponibile, ripeti su Safari.
6. **WebSocket sulla stessa origine.** La pagina `tools/stomp-test/` non si può usare su Render (in produzione non è
   ammessa nessuna origine esterna). Nella stessa console, dopo il login del punto 5:

   ```js
   await new Promise((ok) => { const s = document.createElement('script');
     s.src = 'https://cdn.jsdelivr.net/npm/@stomp/stompjs@7.0.0/bundles/stomp.umd.min.js';
     s.onload = ok; document.documentElement.appendChild(s); });
   const client = new StompJs.Client({
     brokerURL: 'wss://' + location.host + '/ws',
     connectHeaders: { Authorization: 'Bearer ' + accessToken },
     reconnectDelay: 0,
     onConnect: () => { console.log('WebSocket connesso');
       client.subscribe('/user/queue/messages', (f) => console.log('messaggio', f.body));
       client.subscribe('/user/queue/notifications', (f) => console.log('notifica', f.body)); },
     onStompError: (f) => console.log('errore STOMP', f.headers.message),
     onWebSocketClose: () => console.log('WebSocket chiuso')
   });
   client.activate();
   ```

   Atteso: "WebSocket connesso". Inviando un messaggio da un altro utente amico (Postman) compare "messaggio".

## Demo

### Account della demo

Nessuna credenziale sta nel repository: gli account si preparano a mano su Render, con email reali (il
codice di verifica arriva da Brevo), prima della demo.

1. **SUPERADMIN:** le variabili `SUPERADMIN_EMAIL` e `SUPERADMIN_PASSWORD` nella dashboard di Render
   (vedi "Primo SUPERADMIN"); il servizio lo crea al primo avvio.
2. **Due utenti con il flusso normale:** per ciascuno `POST /api/auth/register`, poi `POST /api/auth/verify`
   con il codice ricevuto per email, poi `POST /api/auth/login`. Uno sarà promosso ADMIN durante la demo, l'altro
   sospeso.
3. **Resi amici** (decisione 59), perché la chat si apre solo fra amici: il primo utente invia
   `POST /api/friendships` con `{"userId": "<id del secondo>"}` (l'id si legge da `GET /api/users/me`
   o dalla ricerca `GET /api/users/search?q=`); il secondo accetta con `POST /api/friendships/{id}/accept`
   (l'id è nell'elenco `GET /api/friendships?type=INCOMING`). Verifica con `GET /api/friendships?type=FRIENDS`.

### Checklist della demo

Prima: apri `/api/health` qualche minuto prima per svegliare il servizio, fai login con i tre account e
verifica la connessione WebSocket.

- Promozione di un utente ad ADMIN da parte del SUPERADMIN.
- Sospensione di un utente con motivo e durata: login rifiutato con i dettagli, sessione WebSocket chiusa.
- Riattivazione dell'utente.
- Nascondere e ripristinare un contenuto (moderazione).
- Eventi vicini sulla mappa.
- Feed con like.
- Ricerca di un utente, richiesta di amicizia accettata e chat in tempo reale con notifica.
- Candidatura a un annuncio che sblocca la chat fra non amici.
