# Verifica del rilascio e demo

Procedure di prova di Resonance, spostate qui dal README: collection Postman, verifica su Render dopo il merge
`develop → main` e preparazione della demo.

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

## Stato della verifica su Render

**Verificato su Render** (con `curl` e con il Collection Runner di Postman, non da un browser): registrazione con invio reale del codice
via Brevo, verifica, login, refresh e logout; il cookie `resonance_refresh` arriva con `Secure`,
`HttpOnly` e `SameSite=Lax` (decisione 47); login e refresh con `Origin` della stessa origine
rispondono 200, mentre un `Origin` di un altro sito dà 403 "Invalid CORS request". Il proxy di
Render risulta quindi interno per Tomcat e non serve `server.tomcat.remoteip.internal-proxies`. Non
ancora provato su Render: il refresh da un browser reale e il WebSocket sulla stessa origine (vedi
"Verifica del rilascio finale").

**Segreti.** Si impostano a mano nel pannello Render (Environment del servizio `resonance`), mai nel
repository: `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, `BREVO_API_KEY`, `MAIL_FROM`,
`GEOCODING_CONTACT`.

**Spin-down.** Il piano gratuito sospende il servizio dopo circa 15 minuti senza traffico: la prima
richiesta dopo la pausa attende il risveglio (circa un minuto; il primo avvio a freddo è durato quasi
tre minuti). Prima di una prova o di una demo conviene aprire `/api/health` qualche minuto prima.

## Verifica del rilascio finale

Dopo il merge `develop → main` (lo esegue lo studente) e il deploy automatico di Render:

1. **Log di avvio** nella dashboard di Render: Flyway applica le migrazioni, il bootstrap del SUPERADMIN non
   segnala errori, nessuna eccezione.
2. **Health check:** `GET https://resonance-6o89.onrender.com/api/health` risponde `{"status":"UP","database":"UP"}`.
3. **Postman:** environment `render`, cartelle principali (Health, Auth, Users, Admin, Events, Feed, Friends).
4. **Fallback:** `GET /api/inesistente` risponde 404 JSON (`code` `NOT_FOUND`); `GET /eventi/123` risponde con
   `index.html` (l'app React).
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
2. **Due utenti dall'interfaccia:** per ciascuno, `/registrazione`, poi il codice ricevuto per email in
   `/verifica`, poi `/accesso`. Uno sarà promosso ADMIN durante la demo, l'altro sospeso.
3. **Resi amici** (decisione 59), perché la chat si apre solo fra amici: il primo utente cerca il secondo in
   `/amici/cerca` e invia la richiesta; il secondo la trova nella campanella o in `/amici` (scheda «Ricevute») e
   accetta. In «Amici» il secondo compare ora fra gli amici.
4. **Contenuti di prova:** almeno un concerto o indie event (con il livello di raggio adatto, perché compaia fra
   gli eventi vicini), un post nel feed e un annuncio collab, pubblicati dall'interfaccia con gli utenti di prova.

### Checklist della demo

Prima: apri `/api/health` qualche minuto prima per svegliare il servizio, fai login con i tre account e
verifica la connessione WebSocket (la chat si aggiorna da sola). Con la console del browser aperta (F12) non
devono comparire righe rosse con `Content Security Policy`.

- Promozione di un utente ad ADMIN da parte del SUPERADMIN.
- Sospensione di un utente con motivo e durata: login rifiutato con i dettagli, sessione WebSocket chiusa.
- Riattivazione dell'utente.
- Nascondere e ripristinare un contenuto (moderazione).
- Eventi vicini sulla mappa.
- Feed con like.
- Ricerca di un utente, richiesta di amicizia accettata e chat in tempo reale con notifica.
- Candidatura a un annuncio che sblocca la chat fra non amici.
