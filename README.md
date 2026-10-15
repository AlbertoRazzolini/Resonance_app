# Resonance

Resonance è una web app di community musicale locale che mette in contatto **fan**, **musicisti** e
**host** (locali e organizzatori di eventi). È il progetto capstone del bootcamp Epicode
"Master Full-Stack AI Developer" di Firenze.

Il repository contiene:

| Cartella | Contenuto |
|---|---|
| `Resonance_BE/` | Backend Spring Boot (questo documento ne descrive l'avvio). |
| `Resonance_FE/` | Frontend React: non ancora presente, si sviluppa dal 20 ottobre. |
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

> Stato: setup iniziale (fase F0). Sono pronti progetto, profili, PostgreSQL locale, la migrazione V1
> (utenti e ruoli), l'health check `GET /api/health`, la gestione comune degli errori, il Dockerfile
> e il Blueprint di Render (`render.yaml`, non ancora applicato); le altre API arrivano con le card
> successive.

## Prerequisiti

- JDK 25
- Docker (PostgreSQL in locale)

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
`docker build -f Resonance_BE/Dockerfile -t resonance .`

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
| `GEOCODING_CONTACT` | sì | Contatto inserito nello User-Agent delle richieste a Nominatim. |

## Postman

La collection e gli environment stanno in `postman/`:

- `resonance.postman_collection.json` (formato v2.1): cartelle Health, Auth, Users, Admin, Events,
  Collab, Feed e Chat. Per ora contengono richieste Health e Auth (registrazione, verifica, password dimenticata e reset, login, refresh, logout); le altre si
  riempiono con le card che creano gli endpoint. L'autorizzazione Bearer `{{accessToken}}` è impostata a
  livello di collection.
- `resonance-local.postman_environment.json` (`baseUrl` = `http://localhost:8080`) e
  `resonance-render.postman_environment.json` (`baseUrl` vuoto finché non c'è il deploy).

Come usarli: in Postman, **Import** e scegli i tre file; poi seleziona l'environment `local` in alto a
destra, avvia il backend con il profilo `dev` (vedi "Avvio in locale") e lancia le richieste della
cartella Health. Per le richieste di Auth crea nell'environment le variabili `userEmail` e `userPassword`
(utente già verificato nel database); per il reset della password servono anche `resetCode` (il codice
scritto nel log del backend dopo "Forgot password") e `newPassword`: lo script del login salva `accessToken` e le altre richieste lo usano
come Bearer; il refresh e il logout usano il cookie jar di Postman e inviano a mano `X-Requested-With`.
Nei file versionati non c'è nessun segreto: token e credenziali stanno solo nelle variabili locali di Postman. La parte STOMP (chat e notifiche) non è nella collection.

## Deploy

Non ancora disponibile. Il Blueprint di Render (database e un solo servizio web) è pronto in
`render.yaml` ma non è stato applicato; il link verrà aggiunto dopo il primo deploy.

**Da verificare su Render al primo deploy.** Il profilo `prod` imposta `server.forward-headers-strategy:
native` perché il TLS termina nel proxy di Render. È provato solo con un server locale e una richiesta
simulata (`ForwardedHeadersRealServerTest`), non su Render: dopo il deploy controllare che il login e il
refresh dal browser rispondano 200 e non 403 "Invalid CORS request", e il cookie `resonance_refresh` sia
`Secure` (decisione 47). Se il proxy di Render non risulta "interno" per Tomcat, serve
`server.tomcat.remoteip.internal-proxies`.
