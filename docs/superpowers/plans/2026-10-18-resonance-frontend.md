# Resonance Frontend — Piano di implementazione

> **Per chi esegue:** usare `superpowers:executing-plans`, **una card alla volta**, seguendo il ciclo
> di `CLAUDE.md` (card in "In corso", sotto-task in ordine, checkbox Trello spuntata a fine
> sotto-task, stop a fine card). **Nessun commit**: a fine card si propone il messaggio, il commit
> lo esegue lo studente. I sotto-task usano la sintassi `- [ ]`. Logica critica in TDD (prima il
> test che fallisce, poi il codice); schermate con test mirati e prova manuale a fine card.

**Obiettivo:** frontend React di Resonance (accesso a due token con refresh silenzioso, profilo e
ruoli, eventi vicini su mappa, pubblicazione, feed con like, collab, amicizie, chat e notifiche
STOMP, area di moderazione), servito dallo stesso servizio Render del backend (decisione 1).

**Architettura:** SPA in `Resonance_FE/` con Vite; store Redux Toolkit con RTK Query per i dati del
server e due slice scritti a mano (sessione e notifiche); una sola connessione STOMP per l'app;
build copiata in `static/` di Spring nello stage Node del Dockerfile. Riuso selettivo della logica
del frontend di NoseY (mai gli stili Tailwind), mappato in `docs/riuso-nosey.md`.

**Stack:** React 19, TypeScript `strict`, Vite (senza React Compiler), Redux Toolkit + RTK Query,
React Router, Bootstrap 5.3 + react-bootstrap, CSS custom properties, `@stomp/stompjs`, MapLibre GL
+ react-map-gl + OpenFreeMap, Vitest + React Testing Library + MSW, ESLint + Prettier, Node 24 LTS.
Nessun Sass, nessun Tailwind, nessun DOMPurify (decisione 79).

**Spec:** `docs/progettazione.md` (le sezioni citate come "§N" sono di quel documento), decisioni
1, 59, 74, 76, 77, 78 e 79. Il piano è la fonte di verità; Trello (board `Sviluppo_Resonance`) è lo
specchio. Prima card: **F7-04** (backend), da chiudere prima di FE-01.

## Vincoli globali

- Codice (componenti, hook, file, tipi) in inglese; testi dell'interfaccia in italiano; commenti e
  documentazione in italiano. Una riga di JSDoc su ogni componente, hook e funzione non banale; scelte
  non ovvie con "progettazione, sezione N"; una riga per file di test (decisione 42 estesa al frontend).
- Decisione 76: niente script inline, script da CDN o `eval`; tutto passa dal bundle di Vite (font
  compresi, da npm). La CSP vale in `vite preview` da FE-01 e in `SecurityConfig` da FE-11.
- Access token solo nello store Redux, mai `localStorage` o `sessionStorage` (§4.13). Refresh con
  `credentials: 'include'` e `X-Requested-With`, uno alla volta, nuovo tentativo su 409
  `REFRESH_CONFLICT`, rinnovo anticipato 60 s prima di `accessTokenExpiresAt`.
- Il frontend decide sempre su `ErrorResponse.code`, mai su `message` (§6.1).
- Ruoli e stato letti da `MeResponse` solo per mostrare o nascondere; la protezione vera è nel backend.
- Testo scritto dagli utenti solo tramite `UserText`; `dangerouslySetInnerHTML` vietato da ESLint in
  tutto il progetto (decisione 79).
- Percorsi in italiano, mai inizianti con `api` o `ws` (fallback SPA, decisione 74), definiti solo in
  `app/routes.ts`.
- Cartelle e nomi secondo le "Regole della struttura" (sezione "Struttura dei file"): aree di `features/`
  sempre con `api/`, `components/`, `pages/`; test accanto al file; nessun file barile.
- Mobile-first; a fine card controllo a 375, 768 e 1280 px (telefono, tablet, desktop).
- Riuso di NoseY: si copia e si adatta in Resonance (nomi in inglese, stili con Bootstrap e custom
  properties); NoseY non si modifica mai.
- Nessuna modifica al backend salvo F7-04, F7-08 (nome utente unico, 22 ottobre), F7-06 (notifiche persistenti, 22 ottobre), F7-07 (correzioni dalla prova di sicurezza con
  Strix, 22 ottobre) e la CSP di FE-11; collection Postman aggiornata solo in F7-04, F7-08, F7-06 e, se cambia un endpoint, F7-07.
- Verifiche a fine card, da `Resonance_FE`: `npm run lint`, `npm test`, `npm run build`. In FE-01 e
  FE-11 anche `docker build -f Resonance_BE/Dockerfile -t resonance .` dalla radice e, da
  `Resonance_BE`, `./mvnw -q verify`. Prerequisito della prova manuale: `docker compose up -d` e
  backend in dev sulla 8080.
- Merge `develop → main` a fine di F7-04 e di ogni fase del frontend (A, B, C, D), eseguito dallo
  studente, con verifica su Render.
- Nessuna funzionalità Post-V1/Post-V2. Mai `git commit`, `git push` o altre operazioni Git che
  modificano il repository; nessuna attribuzione a strumenti automatici nei messaggi e nei file.

## Review Focus

Casi che il design implica ma che nessuna schermata mostrerebbe da sola; ogni riga ha il suo test
nella card indicata.

1. **Login con password sbagliata** (401 `INVALID_CREDENTIALS`) → nessun refresh: il refresh parte solo
   su 401 `UNAUTHENTICATED` di un endpoint protetto (FE-02).
2. **Tre chiamate parallele con token scaduto** → un solo `POST /api/auth/refresh`, poi le tre richieste
   ripetute con il token nuovo (FE-02).
3. **Ricarica della pagina** → sessione ripresa con il refresh, senza mostrare per un istante
   l'interfaccia anonima (FE-02).
4. **Password di 30 emoji** (sotto 72 caratteri, oltre 72 byte) → bloccata nel client come nel backend
   (FE-03).
5. **Data dell'evento senza fuso orario** → il form invia sempre l'istante con offset, mai
   `"2026-10-20T21:00"` (FE-06).
6. **Contenuto nascosto aperto da un link** → pagina "non trovato", non un errore generico (FE-05).
7. **Messaggio inviato dopo 15 minuti di inattività** → rinnovo anticipato e riconnessione: nessun
   `TOKEN_INVALID` sul SEND (FE-09b).
8. **Messaggio ricevuto due volte dopo una riconnessione** → nessun duplicato (dedupe per `id`, FE-09b).
9. **URL `javascript:` o HTML in un testo** → resta testo inerte (FE-07).

---

## Struttura dei file

```
Resonance_app/
├── Resonance_BE/Dockerfile                          (FE-01: stage Node; FE-11: invariato)
├── Resonance_BE/src/main/java/.../config/SecurityConfig.java   (F7-04: /mine; FE-11: CSP)
├── docs/riuso-nosey.md                              (FE-01: sezione Frontend)
└── Resonance_FE/
    ├── index.html · package.json · package-lock.json · vite.config.ts · tsconfig*.json
    ├── eslint.config.js · .prettierrc
    └── src/
        ├── main.tsx · config.ts            (contatto per i ricorsi, centro predefinito)
        ├── app/
        │   ├── App.tsx · store.ts · SessionBootstrap.tsx
        │   ├── router.tsx                  (tutte le rotte, pagine caricate in modo differito)
        │   └── routes.ts                   (costanti dei percorsi: ROUTES.events, ROUTES.chat(id)…)
        ├── styles/       tokens.css (custom properties --rs-*) · bootstrap-overrides.css (--bs-*) · index.css
        ├── lib/
        │   ├── api/      apiSlice.ts · baseQuery.ts · tags.ts
        │   ├── stomp/    client.ts · destinations.ts · useStompStatus.ts
        │   ├── errors/   errorMessages.ts · getErrorMessage.ts
        │   ├── format/   dates.ts · distance.ts
        │   └── urls.ts                     (solo http/https, dominio per la conferma d'uscita)
        ├── hooks/        redux.ts · useBrowserPosition.ts · useDebouncedValue.ts · useMediaQuery.ts
        ├── types/        common.ts (ErrorResponse, PageResponse, AuthorSummary) · users.ts · events.ts
        │                 feed.ts · collab.ts · friends.ts · chat.ts · admin.ts
        ├── components/
        │   ├── ui/       ErrorAlert · ConfirmDialog · LoadMore · ExternalLink · UserText · EmptyState
        │   ├── layout/   AppShell · NavBar · UserMenu · MessagesBadge · NotificationBell
        │   ├── guards/   RequireAuth · RequireRole
        │   ├── map/      index.ts (caricamento differito) · Map.tsx · markers.tsx · map.css
        │   └── motion/   componenti ReactBits (FE-12)
        ├── features/     una cartella per area, sempre con la stessa forma:
        │   ├── auth/
        │   │   ├── api/          authApi.ts
        │   │   ├── components/   OtpField · PasswordField · ResendCode · SuspendedNotice
        │   │   ├── pages/        LoginPage · RegisterPage · VerifyPage · ForgotPasswordPage · ResetPasswordPage
        │   │   ├── authSlice.ts
        │   │   └── validation.ts
        │   ├── users/            api/ · components/ · pages/ · areaTabs.ts · profilePatch.ts
        │   ├── events/           api/ · components/ · pages/ · hooks/ · eventForm.ts
        │   ├── feed/ · collab/ · friends/ · chat/ · notifications/ · admin/   (stessa forma)
        └── test/
            ├── setup.ts · server.ts        (MSW per Vitest)
            ├── handlers/   auth.ts · users.ts · events.ts · feed.ts · collab.ts · friends.ts · chat.ts · admin.ts
            └── fixtures/   users.ts · events.ts · feed.ts · chat.ts …
```

Regole della struttura (decisione 78):

- Ogni area di `features/` ha `api/` (endpoint RTK Query), `components/`, `pages/` e, se servono,
  `hooks/` e file di logica pura (`validation.ts`, `*Slice.ts`). Una cartella nasce solo quando ha un file.
- Ciò che serve a più aree sta fuori da `features/`: `components/`, `hooks/`, `lib/`, `types/`.
- I test stanno accanto al file che provano (`LoginPage.test.tsx` accanto a `LoginPage.tsx`); in `test/`
  restano solo setup, server MSW, handler e dati finti.
- Nessun file "barile" (`index.ts` che riesporta): import diretti con l'alias `@/`. Unica eccezione
  `components/map/index.ts`, che serve al caricamento differito della mappa.
- Nomi dei file: componenti e pagine in PascalCase (`LoginPage.tsx`), il resto in camelCase
  (`baseQuery.ts`); i percorsi dell'app solo da `app/routes.ts`, mai scritti a mano nei componenti.

---

## Interfacce condivise (riferimento per tutte le card)

| Tipo | Firma | Card che lo crea |
|---|---|---|
| `api` | `createApi({ reducerPath: 'api', baseQuery: baseQueryWithReauth, tagTypes })`; ogni area usa `api.injectEndpoints` | FE-02 |
| `tagTypes` | `Me, PublicUser, Concert, IndieEvent, FeedPost, CollabPost, Friendship, FriendRequests, UserSearch, Chat, Messages, AdminUser, HiddenContent, Notification` (l'ultimo da FE-13) | FE-02 |
| `baseQueryWithReauth` | `fetchBaseQuery` con Bearer dallo store; su 401 `UNAUTHENTICATED`: refresh condiviso (una sola promessa), poi un nuovo tentativo; su 409 un secondo tentativo del refresh | FE-02 |
| `authSlice` | stato `{status: 'unknown' \| 'authenticated' \| 'anonymous', accessToken, accessTokenExpiresAt, user: MeResponse \| null, suspension: SuspensionDetails \| null}`; azioni `sessionStarted(LoginResponse)`, `tokenRefreshed(LoginResponse)`, `userUpdated(MeResponse)`, `sessionEnded(reason?)`; selettori `selectCurrentUser`, `selectHasRole(role)` | FE-02 |
| `onTokenRefreshed` | `(listener: () => void) => () => void` (registrazione e annullamento); lo usa il client STOMP per riconnettersi | FE-02 |
| `getErrorMessage` / `getFieldErrors` | `(error: unknown) => string`; `(error: unknown) => Record<string, string>` (solo `VALIDATION_ERROR` e `ADDRESS_NOT_FOUND`); `<ErrorAlert error>` | FE-02 |
| `RequireAuth` / `RequireRole` | `<RequireAuth>{children}</RequireAuth>`; `<RequireRole roles={Role[]}>` (solo interfaccia) | FE-02 |
| `SuspendedNotice` | `<SuspendedNotice details={{suspensionReason, suspendedUntil}} />` con il contatto di `config.ts` | FE-03 |
| `useBrowserPosition` | `() => {status: 'idle' \| 'pending' \| 'granted' \| 'denied' \| 'unavailable', position: {latitude, longitude} \| null, request(): Promise<{latitude, longitude} \| null>}` | FE-04 |
| `AreaTabs` | registro delle schede sotto il profilo (`AREA_TABS` in `features/users/areaTabs.tsx`): ogni card sostituisce `element` della sua (`{key, title, roles?, element}`) | FE-04 |
| `useSearchCenter` / raggio | `() => {center, source: 'browser' \| 'profile' \| 'default'}`; `RADIUS_LEVELS = [5, 15, 25, 50, 100]`, `DEFAULT_RADIUS_KM = 15` | FE-05 |
| `Map` | `<Map center zoom markers onMarkerClick label />`, caricata in modo differito | FE-05 |
| `ExternalLink` | `<ExternalLink href>`: solo `http`/`https`, modale di conferma con il dominio, apertura con `noopener noreferrer` | FE-05 |
| `LoadMore` | `<LoadMore hasMore loading onClick />` per gli elenchi a pagine | FE-05 |
| `ConfirmDialog` | `<ConfirmDialog show title body confirmLabel onConfirm onCancel withReason? />` | FE-06 |
| `UserText` | `<UserText text />`: testo con l'escape di React, a capo con CSS, URL `http`/`https` come `ExternalLink` | FE-07 |
| `stomp` | `startStomp(store)`, `stopStomp()`, `subscribe<T>(queue, callback) => unsubscribe`, `send(destination, body): boolean`, `onStompReconnected(listener)`, `useStompStatus()` (decisione 92: lo store è un parametro) | FE-09b |
| `notificationsSlice` | toast delle notifiche live `{id, type, createdAt, actor, targetId, preview}`; azioni `received`, `toastDismissed`; solo in memoria, al massimo 3 (da FE-13: la lettura e l'elenco sono nella cache di `notificationsApi`) | FE-09b, FE-13 |
| `notificationsApi` | `getNotifications(page)` (10 per pagina), `getUnreadCount()`, `markNotificationRead(id)`, `markAllNotificationsRead()`, `receiveLiveNotification(dispatch, getState, live)` | FE-13 |

---

## Calendario e stime

Stime comprensive di test, responsive, documentazione e verifiche. Lo studente lavora 10–13 h al giorno.

| Giorno | Card | Stima | Ore | Rischio |
|---|---|---|---|---|
| 18 ott | brainstorming e bozza del piano | — | — | — |
| 19 ott | approvazione del piano · F7-04 · FE-01 · FE-02 | 1 h · 3 h · 4 h · 4 h | 12 h | **alto**: FE-02 può slittare al mattino del 20 |
| 20 ott | FE-03 · FE-04 · FE-05 | 5 h · 4 h · 4 h | 13 h | **alto**: mappa sotto CSP provata per la prima volta in FE-05 |
| 21 ott | FE-06 · FE-07 · FE-08 | 3,5 h · 4,5 h · 3 h | 11 h | medio |
| 22 ott | FE-09a · FE-09b | 3,5 h · 6 h | 9,5 h | **alto**: FE-09b è la card più grande e delicata |
| 23 ott | FE-10 · FE-12 · FE-11 | 4 h · 3 h · 4 h | 11 h | **alto**: nessun margine nel giorno |
| 24 ott | demo | — | — | **margine esplicito**: la mattina (circa 2 h) solo per emergenze e risveglio del servizio |

Totale circa 56,5 h (piano 1 h, F7-04 3 h, frontend 52,5 h). **Margine:** F7-04 non è stata fatta il 18 e
le sue 3 h hanno consumato il margine del 23 (scelta dello studente del 19 ottobre: calendario scorso,
nessun taglio in partenza). Resta la mattina del 24; la riserva vera è l'ordine dei tagli, circa 7,5 h in
tutto, da applicare **appena** un giorno sfora, senza aspettare il 23.

**Aggiunta del 20 ottobre:** FE-03b (navigazione e footer, 6 h) si somma al totale, che sale a circa 62,5 h; la tabella non è
ricalcolata. Lo studente stima di finire il frontend entro tre giorni e ha scelto di non tagliare per ora: l'ordine dei tagli sotto
resta la riserva e si applica se un giorno sfora.

**Aggiunta del 22 ottobre:** F7-08 (nome utente unico, circa 2,5 h), F7-06 e FE-13 (notifiche persistenti, circa 7 h in tutto) e F7-07 (prova
di sicurezza con Strix, circa 3 h, dipende dalle segnalazioni), stime provvisorie, si inseriscono, in questo ordine, prima di FE-12 e FE-11 e
si sommano al totale; la tabella non è ricalcolata e il rischio del 23 ottobre resta **alto**. Scelta dello studente: nessun
taglio e, se serve, lavoro anche di sera e di notte. L'ordine dei tagli sotto resta la riserva.

**Aggiunta del 23 ottobre:** sette card di rifinitura (F7-09, FE-14, FE-15, FE-16, FE-17, FE-18, FE-19, circa 11,5 h in tutto, stime
provvisorie), da fare nell'ordine indicato prima di FE-12 e FE-11; si sommano al totale e la tabella non è ricalcolata. Lo studente le
vuole fare tutte il 23 ottobre. L'ordine dei tagli sotto resta la riserva.

### Ordine dei tagli (se una card o un giorno sfora, avvisare subito)

1. **ReactBits** in FE-12 (−1 h).
2. **Notifiche live** nell'interfaccia: toast e voci di sessione della campanella (−1 h); restano chat in
   tempo reale, badge dei messaggi e conteggio delle richieste di amicizia.
3. **Contatto dell'organizzatore** dalla pagina dell'evento (−0,5 h).
4. **Bacheca collab** FE-08 (−3 h).
5. **Revisione con impeccable** in FE-12 (−2 h).

Con un taglio il backend resta intatto: manca solo l'interfaccia.

### Mai tagliati

Login e refresh silenzioso, registrazione e verifica, password dimenticata e reset, profilo e ruoli con
area personale, eventi vicini con mappa, pubblicazione degli eventi, feed con like e `UserText`, ricerca
utenti, amicizie e chat, area admin (promozione, sospensione con chiusura della sessione WebSocket,
riattivazione, hide/restore), deploy integrato con CSP, responsive sui tre breakpoint, test mirati.

### Dipendenze fra card

F7-04 → FE-01 → FE-02 → FE-03 → FE-03b (fase A; FE-03b è nata il 20 ottobre dalla decisione 83). FE-04 crea l'area personale che FE-06, FE-07 e FE-08 completano;
FE-05 crea `Map`, `ExternalLink` e `LoadMore`; FE-06 crea `ConfirmDialog`; FE-07 crea `UserText`, che
da lì si applica a ogni testo. FE-09a precede FE-09b (la chat nuova si apre solo fra amici); il pulsante
"Scrivi" (FE-09a) e "Apri la chat" della candidatura (FE-08) funzionano dopo FE-09b. FE-10 usa i dettagli
dei contenuti di FE-05–FE-08. F7-08 (nome utente unico) prima di F7-06, perché la sua migrazione precede quella delle notifiche. F7-06 → FE-13 (notifiche persistenti: il frontend usa gli endpoint del backend; FE-13 riprende la campanella di
FE-09a e FE-09b). F7-07 dopo FE-13 (la prova di sicurezza copre anche le notifiche nuove). F7-09 → FE-14 (la candidatura unica: il bottone usa la regola del backend); FE-16 dopo FE-09a (amicizie); FE-17 dopo FE-16 (la voce «Amici» e il bottone sul profilo
completano insieme l'accesso alle amicizie); FE-15, FE-18 e FE-19 non dipendono da altre card di questo gruppo. FE-12 dopo tutte le schermate, FE-11 per
ultima (le sue prove su Render includono le notifiche).

## Rischi e incompatibilità dichiarati

**Tempo.** Nessun margine nei giorni di lavoro: resta la mattina del 24 e i tagli (circa 7,5 h). Con 10 h
al giorno almeno i primi due tagli sono probabili. Giorni critici 20, 22 e 23. Il codice di NoseY è
scritto con Tailwind: ridisegnarlo può costare più del previsto (FE-05, FE-09b).

**Tecnici, da verificare presto.**
- MapLibre sotto CSP: il worker caricato come file (soluzione di NoseY) dovrebbe essere compatibile con
  `script-src 'self'`; si prova in FE-05 con la CSP di `vite preview`. Se non passa, ci si ferma e si
  decide con lo studente.
- Swagger UI sotto CSP: da provare in FE-11 (decisione 76).
- Cookie di refresh sulla stessa origine: si verifica davvero solo su Render, per questo il primo merge
  è a fine fase A (20 ottobre).
- Più schede aperte: due refresh simultanei → 409 e nuovo tentativo; il cookie è condiviso fra le schede.
  Rischio basso.
- Geocodifica: fino a circa 15 s nel caso peggiore (decisione 76): il form mostra un'attesa esplicita.
- Render gratuito: circa un minuto di risveglio, frontend compreso; database gratuito con scadenza
  (§12.7).

**Scostamenti da brief e design, decisi dallo studente il 18 ottobre.**
- Decisione 79: DOMPurify esce dallo stack del brief; §8.6 corretta.
- Decisione 77: elenchi `/mine` di concerti, collab e feed nell'MVP, con la card F7-04 fuori dal piano
  del backend approvato il 13 ottobre.
- FE-09 divisa in FE-09a e FE-09b, card nuova FE-12: §14 e Trello aggiornati.
- Frontend dal 18 (il brief diceva dal 20): già registrato in §14.
- Richieste di amicizia senza notifica live (decisione 59, Post-V1): **superato** da F7-06 e FE-13 (decisioni 97 e 98): le richieste sono
  notifiche salvate, con live; il numero della campanella si rilegge ad apertura, ritorno sulla scheda e riconnessione, senza polling.

**Demo.** Su Render i codici arrivano via Brevo, con quota giornaliera: poche registrazioni di prova.
La mappa si apre a 15 km: in demo si sceglie il livello di raggio adatto agli eventi di prova.

---

# F7-04 — Backend: elenchi dei contenuti dell'utente (19 ottobre, prima di FE-01)

Card del backend, descritta qui e riportata anche nel piano del backend (fase F7). Ciclo del backend:
TDD, `./mvnw -q verify`, Postman.

### Card F7-04 · Elenchi dei contenuti dell'utente — stima 3 h

**Riferimenti:** decisione 77 (nuova), decisione 57 (`indie-events/mine`, modello da seguire); §6.6–6.8,
§8.4.
**Sicurezza: sì**
**File:** `event/OfficialConcertController`, `OfficialConcertService`, `OfficialConcertRepository`;
`collab/CollabController`, `CollabService`, `CollabPostRepository`; `feed/FeedController`, `FeedService`,
`FeedPostRepository`; `config/SecurityConfig`; test `OfficialConcertIntegrationTest`,
`CollabIntegrationTest`, `FeedIntegrationTest`; Postman Events, Collab, Feed; `docs/progettazione.md`,
`docs/decisioni.md` (77), piano del backend.

Regole comuni (decisione 77): autenticato senza ruolo richiesto; contenuti del chiamante non nascosti
(né dal proprietario né da un admin), con passati e chiusi compresi; ordine `created_at desc, id desc`;
`PageParams`; stessi DTO di risposta degli endpoint esistenti, autore già caricato nella query. In
`SecurityConfig` ogni `/mine` precede `/{id}`, che altrimenti lo renderebbe pubblico.

- [ ] **1. Concerti (50 min).** `GET /api/official-concerts/mine`. Test: solo i concerti del chiamante;
  passati compresi (`advance` oltre `event_date`); nascosti dal proprietario e da un admin esclusi; 401
  senza token; `size=1000` → 400 `VALIDATION_ERROR`; ordine dal più recente.
- [ ] **2. Annunci collab (40 min).** `GET /api/collab-posts/mine`. Test: chiusi compresi, nascosti
  esclusi, solo i propri, 401 senza token.
- [ ] **3. Post del feed (45 min).** `GET /api/feed-posts/mine`, `likedByMe` calcolato per il chiamante,
  `distanceKm` nullo. Test: solo i propri, nascosti esclusi, `likedByMe` vero dopo un like, 401 senza
  token.
- [ ] **4. Documentazione, Postman e chiusura (45 min).** Righe nelle tabelle di §6.6, §6.7 e §6.8;
  decisione 77 completata con l'esito; piano del backend (card F7-04 spuntata, struttura invariata).
  Postman: per ognuno 200 e 401. `./mvnw -q verify`; collection in locale con lo script a segmenti.

**Criterio:** `./mvnw -q verify` verde; Postman con i tre elenchi; fase F7 chiusa: promemoria merge
`develop → main` e controlli su Render (log, `/api/health`, i tre `/mine` con l'environment `render`).
**Commit proposto:** `feat(content): aggiunge gli elenchi dei contenuti dell'utente`

---

# Fase A — Fondamenta (19 – 20 ottobre)

### Card FE-01 · Setup, build integrata, token e riuso — stima 4 h

**Riferimenti:** decisioni 1, 74, 76, 78; §4.3 (proxy in sviluppo), §6.12, §12.5; brief §12 (strumenti
e UI). Riuso NoseY: `fe/vite.config.ts` (proxy), `tsconfig*.json`, struttura di `src/`,
`hooks/redux.ts`, `hooks/useMediaQuery.ts`.
**File:** `Resonance_FE/` (`package.json`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`,
`.prettierrc`, `index.html`, `src/main.tsx`, `src/config.ts`, `src/app/App.tsx`, `router.tsx`,
`routes.ts`, `src/styles/*`, `src/hooks/redux.ts`, `useMediaQuery.ts`, `src/components/layout/AppShell`,
`NavBar`, `src/test/setup.ts`, `server.ts`); `Resonance_BE/Dockerfile`; `.dockerignore` (controllo);
`README.md`; `docs/riuso-nosey.md`.

- [ ] **1. Progetto e strumenti (60 min).** Progetto Vite React + TypeScript `strict`, alias `@/`.
  Dipendenze: `@reduxjs/toolkit`, `react-redux`, `react-router`, `bootstrap`, `react-bootstrap`,
  `@stomp/stompjs`; sviluppo: `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`,
  `@testing-library/jest-dom`, `msw`, ESLint (con il divieto di `dangerouslySetInnerHTML`), Prettier.
  Script `dev`, `build`, `preview`, `lint`, `format`, `test`. Versioni stabili correnti fissate dal lock.
  Test di prova: l'app si monta.
- [ ] **2. Proxy, CSP in anteprima e struttura (50 min).** Proxy `/api` e `/ws` (`ws: true`) verso
  `localhost:8080`, anche per `vite preview`; header `Content-Security-Policy` della decisione 76 in
  `preview.headers`. `AppShell` con `NavBar` di react-bootstrap (menu a scomparsa sotto `md`), router
  con pagine segnaposto, `routes.ts` e pagina "non trovato"; cartelle create solo quando hanno un file
  (regole della struttura). Prova: `/api/health` dal browser tramite il proxy;
  `npm run build && npm run preview` senza violazioni CSP nella console.
- [ ] **3. Token di design (40 min).** Con la skill impeccable e le schermate Stitch dello studente (solo
  riferimento visivo): `tokens.css` con le custom properties `--rs-*` (palette, tipografia, spaziature,
  raggi, ombre) collegate alle variabili `--bs-*` di Bootstrap; font da npm. Nessun Sass.
- [ ] **4. Build integrata (50 min).** Stage Node nel Dockerfile (`node:24-alpine`, `npm ci`,
  `npm run build`); lo stage JDK copia `Resonance_FE/dist/` in `src/main/resources/static/` prima del
  `package`; commenti del Dockerfile aggiornati. Controllo di `.dockerignore` (`**/node_modules`,
  `**/dist`) e del `buildFilter` di `render.yaml`. Verifiche: `docker build` dalla radice; `./mvnw -q
  verify` (il test del fallback SPA resta verde).
- [ ] **5. Riuso e documentazione (40 min).** `docs/riuso-nosey.md`, sezione "Frontend": file di NoseY →
  file di Resonance, cosa si adatta (logica, nomi in inglese) e cosa non si porta (stili Tailwind, MSW nel
  browser, ticket, AI, ragnatela). README: sezione "Frontend" (Node 24, `npm ci`, `npm run dev` con il
  backend in dev, script, anteprima con CSP).

**Test:** montaggio dell'app; setup di MSW condiviso dalle card successive.
**Criterio:** lint, test e build verdi; proxy funzionante; anteprima senza violazioni CSP; `docker build`
e `./mvnw -q verify` verdi.
**Commit proposto:** `feat(fe-setup): crea il progetto frontend con build integrata nell'immagine`

### Card FE-02 · Client API e refresh silenzioso — stima 4 h

**Riferimenti:** §4.1, §4.3, §4.8, §4.13, §6.1, §6.2, §8.5; decisioni 8, 10, 11, 12, 47. Riuso NoseY:
`store/apiSlice.ts` (schema con `injectEndpoints`), `lib/codiciErrore.ts`, `lib/errori.ts`,
`components/layout/Protezioni.tsx`. NoseY non aveva refresh token: la parte di refresh è nuova.
**File:** `src/types/common.ts`, `users.ts`; `src/lib/api/apiSlice.ts`, `baseQuery.ts`, `tags.ts`;
`src/lib/errors/errorMessages.ts`, `getErrorMessage.ts`; `src/features/auth/authSlice.ts`,
`api/authApi.ts`; `src/app/SessionBootstrap.tsx`; `src/components/guards/RequireAuth.tsx`,
`RequireRole.tsx`; `src/components/ui/ErrorAlert.tsx`; `src/test/handlers/auth.ts`, `fixtures/users.ts`;
test accanto ai file (`baseQuery.test.ts`, `getErrorMessage.test.ts`, `RequireRole.test.tsx`,
`SessionBootstrap.test.tsx`).

- [ ] **1. Tipi e sessione (40 min).** Tipi `ErrorResponse`, `PageResponse<T>`, `LoginResponse`,
  `MeResponse`, `Role`, `AuthorSummary` dal codice dei DTO del backend. `authSlice` come nelle interfacce
  condivise; store con il reducer e il middleware di `api`.
- [ ] **2. baseQuery con refresh (80 min).** Bearer dallo store; su 401 `UNAUTHENTICATED` un solo refresh
  condiviso (una promessa per tutte le richieste in attesa), poi un nuovo tentativo; refresh =
  `POST /api/auth/refresh` con `credentials: 'include'` e `X-Requested-With`; su 409 `REFRESH_CONFLICT`
  breve attesa e un secondo tentativo; su 401 `REFRESH_TOKEN_*` o 403 `ACCOUNT_SUSPENDED` →
  `sessionEnded` (con i dettagli della sospensione). Gli endpoint di auth non attivano mai il refresh.
  Rinnovo anticipato 60 s prima di `accessTokenExpiresAt`; `onTokenRefreshed` per lo STOMP (FE-09b).
- [ ] **3. Avvio e protezioni (45 min).** `SessionBootstrap`: all'apertura un refresh; finché non
  risponde, schermata di caricamento; poi `authenticated` o `anonymous`. `RequireAuth` (rimanda a
  `/accesso` ricordando la pagina richiesta), `RequireRole`. Logout = `DELETE /api/auth/refresh`,
  `sessionEnded` e reset della cache di `api`.
- [ ] **4. Errori (25 min).** `getErrorMessage` con i testi italiani per ogni `code` di §6.2 (fallback sul
  `message` del backend), `getFieldErrors` per `fields`, `ErrorAlert`.
- [ ] **5. Test (50 min, MSW).** 401 → un refresh → richiesta ripetuta con il token nuovo; tre 401 paralleli
  → un solo refresh (Review Focus 2); 409 → secondo tentativo riuscito; refresh `REFRESH_TOKEN_REUSED` →
  sessione chiusa; login 401 `INVALID_CREDENTIALS` → nessun refresh (Review Focus 1); refresh con
  `X-Requested-With` e cookie; rinnovo anticipato con timer finti; avvio con refresh riuscito senza stato
  anonimo intermedio (Review Focus 3); `RequireRole` nasconde una rotta admin a un FAN.

**Criterio:** test verdi; prova manuale con il backend locale: all'avvio senza cookie l'app diventa
anonima senza errori in console (la sessione ripresa dopo il ricaricamento si prova in FE-03, con il
login vero).
**Commit proposto:** `feat(fe-auth): aggiunge il client API con refresh silenzioso`

### Card FE-03 · Registrazione, verifica, login e password — stima 5 h

**Riferimenti:** §4.4–4.7, §4.9, §4.10, §6.4, §1.4 (contatto per i ricorsi); decisioni 27, 48, 50, 51.
Riuso NoseY: `features/accesso/CampoCodiceOtp`, `ReinvioCodice`, `validaRegistrazione`,
`components/ui/CampoPassword`.
**File:** `src/features/auth/pages/` (`LoginPage`, `RegisterPage`, `VerifyPage`, `ForgotPasswordPage`,
`ResetPasswordPage`), `components/` (`OtpField`, `ResendCode`, `PasswordField`, `SuspendedNotice`),
`validation.ts`, `api/authApi.ts` (endpoint nuovi); `src/config.ts` (contatto per i ricorsi); test accanto
ai file (`validation.test.ts`, `SuspendedNotice.test.tsx`, `LoginPage.test.tsx`, `OtpField.test.tsx`).

- [ ] **1. Login e logout (60 min).** `/accesso`: errori `INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED`
  (collegamento alla verifica), `TOO_MANY_REQUESTS`, `ACCOUNT_SUSPENDED` → `SuspendedNotice` con motivo,
  scadenza in ora locale o "a tempo indeterminato" e contatto; ritorno alla pagina richiesta; logout nel
  menu utente.
- [ ] **2. Registrazione (60 min).** `/registrazione`: validazioni come il backend (email, password 8–72
  caratteri e al massimo 72 byte con `TextEncoder`, niente emoji, `displayName` 3–30: decisione 84); 201 → `/verifica` con l'email;
  `EMAIL_ALREADY_REGISTERED` e gli altri codici con il loro testo.
- [ ] **3. Verifica e reinvio (60 min).** `/verifica`: codice a 6 cifre (solo cifre, incolla), password;
  errori `CODE_INVALID`, `CODE_EXPIRED`, `WRONG_PASSWORD`, `ALREADY_VERIFIED`, `ACCOUNT_SUSPENDED`;
  reinvio con attesa visibile fra due richieste; successo → `sessionStarted`.
- [ ] **4. Password dimenticata e reset (50 min).** `/password-dimenticata`: risposta sempre neutra
  (decisione 51); `/password/reset`: `{email, code, newPassword}` → 204 → `sessionEnded` e invito ad
  accedere; `CODE_INVALID` per ogni codice non valido.
- [ ] **5. Test e responsive (70 min).** 30 emoji rifiutate dal client (Review Focus 4); `SuspendedNotice`
  con motivo, scadenza e contatto; `EMAIL_NOT_VERIFIED` mostra il collegamento alla verifica; il campo del
  codice accetta solo cifre; messaggio neutro dopo la richiesta di reset. Controllo a 375, 768 e 1280 px.

**Criterio:** flusso completo in locale con `LogEmailService` (codice dal log): registrazione, verifica,
login, ricaricamento con sessione ripresa, logout, reset. Fase A chiusa: promemoria merge
`develop → main`; su Render login, cookie salvato, sessione ripresa dopo il ricaricamento, fallback SPA
su un percorso profondo.
**Commit proposto:** `feat(fe-auth): aggiunge registrazione, verifica, login e reset della password`
**Nota del 20 ottobre:** la card è stata fatta in tre commit (login e logout; correzioni backend F7-05 per nome e password,
decisione 84; registrazione, verifica e reset). Il promemoria del merge `develop → main` della fase A passa a FE-03b.

### Card FE-03b · Navigazione e footer — stima 6 h

**Nata da:** decisione 83 (scelte dello studente del 19 ottobre, dopo aver aperto il prototipo Stitch "Resonance v2"). Il piano
originale prevedeva la barra in alto con il menu a scomparsa di FE-01; il prototipo ha invece le tab in basso su telefono e la
colonna a sinistra su desktop, e lo studente ha scelto di seguirlo.
**Riferimenti:** decisioni 78, 80 e 83; prototipo Stitch (progetto `697298539032039664`: schermate "Eventi & Concerti" per il
telefono ed "Eventi vicini" per desktop e tablet); progettazione §5.3 e §6.12 (barra e menu utente: da rileggere all'inizio della
card). Riuso NoseY: nessuno (la navigazione di NoseY usa Tailwind).
**File (da confermare con lo studente all'inizio della card):** `src/components/layout/` (`AppShell`, `NavBar` → barra in alto,
tab in basso, colonna a sinistra, `Footer`), `UserMenu` (già esistente), `src/app/routes.ts` (percorso dell'informativa privacy),
pagina dell'informativa privacy, `index.css`; test accanto ai file.

**Esito (20 ottobre, decisione 85):** scelte dello studente oltre alle regole sopra. Cinque tab per tutti verso `/eventi`,
`/collab`, `/feed`, `/chat`, `/profilo` con pagine segnaposto "Questa sezione arriva presto." (con i nomi delle pagine vere);
`/` rimanda a `/eventi`; Messaggi e Profilo già dietro `RequireAuth`. Colonna in due forme (stretta a tablet, larga da 1200 px
con il logo). Campanella visibile e disattivata; titolo della pagina da `handle.title`; nessuna icona filtri (la porta FE-05).
Icone di Animate UI. Footer: **le tab restano ferme** e il footer esce da dietro di esse; **due informative vere**
(`/informativa-privacy` e `/informativa-cookie`, testi approvati dallo studente); copyright e termini restano link vuoti fino a
FE-12; il footer c'è anche nelle pagine di accesso. Contatto `PRIVACY_CONTACT` segnaposto in `config.ts`.

Regole già decise (decisione 83): su telefono barra in alto (logo, campanella, cerchio giallo del profilo) e barra di tab in basso
(Eventi, Collab, Feed, Messaggi, Profilo); da 768 px colonna di navigazione a sinistra con in alto campanella e profilo; niente
hamburger. Il footer compare a fondo pagina come pop-up dal basso, su telefono e su desktop; sul telefono si aggiunge alle tab
(tutto sale, le tab restano visibili sopra il footer). Non copre né le tab, né la paginazione, né altre funzioni: il contenuto
riserva in fondo uno spazio pari a tab e footer insieme. Contenuto del footer: informativa privacy (pagina vera e cliccabile) e,
come link vuoti segnaposto, copyright e termini di servizio. Colori solo da `--rs-*`.

Punti da chiedere allo studente all'inizio della card: quali tab e voci vede l'utente anonimo; dove portano le tab di pagine che
nascono nelle card dopo (Collab, Feed, Messaggi); icone (nessuna libreria installata: SVG nei componenti o una libreria);
testo dell'informativa privacy; aspetto e movimento del footer; dove va la campanella finché non esistono le notifiche.

- [ ] **1. Barra in alto e tab in basso su telefono (90 min).** Logo, campanella, cerchio del profilo con `UserMenu`; cinque tab
  con la voce attiva in giallo; l'`AppShell` sceglie la forma dalla larghezza (`useMediaQuery` o CSS).
- [ ] **2. Colonna a sinistra su tablet e desktop (60 min).** Stesse voci, barra in alto con campanella e profilo.
- [ ] **3. Footer e informativa privacy (90 min).** Pagina `/informativa-privacy` con il testo scritto con lo studente; footer a
  comparsa a fondo pagina con il collegamento alla privacy e i due segnaposto.
- [ ] **4. Spazio riservato in fondo alle pagine (45 min).** Margine inferiore pari a tab e footer insieme; prova con un elenco
  lungo e una paginazione (`LoadMore`) in fondo: non deve essere coperta.
- [ ] **5. Test e responsive (75 min).** Voci e percorsi delle tab; il footer compare solo a fondo pagina e non copre l'ultimo
  elemento; nessun hamburger; controllo a 375, 768 e 1280 px.

**Criterio:** navigazione come nel prototipo ai tre breakpoint, footer a comparsa che non copre mai tab o contenuti, informativa
privacy raggiungibile; `npm run lint`, `npm test` e `npm run build` verdi. Fase A chiusa: promemoria merge `develop → main`; su
Render login, cookie salvato, sessione ripresa dopo il ricaricamento, fallback SPA su un percorso profondo.
**Commit proposto:** `feat(fe-nav): aggiunge la navigazione a tab e colonna e il footer con l'informativa privacy`

---

# Fase B — Contenuti (20 – 21 ottobre)

### Card FE-04 · Profilo, ruoli e area personale — stima 4 h

**Riferimenti:** §5.3, §6.5; decisioni 30, 31, 49, 53, 77, 86. Riuso NoseY: `features/profilo/FormDatiPersonali`,
`validaProfilo`, `features/eventi/usePosizioneUtente`, `components/ui/Avatar`.
**File:** `src/features/users/api/usersApi.ts`, `pages/` (`ProfilePage`, `EditProfilePage`, `PublicProfilePage`),
`components/` (`ProfileHeader`, `ProfileForm`, `LocationSettings`, `RoleActivation`, `AreaTabs`), `areaTabs.tsx`,
`profilePatch.ts`; `src/types/users.ts`; `src/hooks/useBrowserPosition.ts`; `src/components/ui/Avatar.tsx`;
`src/features/events/pages/` (`NewConcertPage` e `NewIndieEventPage`, segnaposto); `src/test/handlers/users.ts`; test
accanto ai file.

**Esito (20 ottobre, decisione 86):** scelte dello studente oltre alle regole sopra. **Profilo e area personale in una sola
pagina come nel prototipo Stitch:** `/profilo` (scheda e schede dei contenuti) e `/profilo/modifica` (dati, posizione e
ruoli); la rotta `/area-personale` e `PersonalAreaPage` non esistono. Ruoli con un clic e senza conferma; voci «Pubblica
concerto» e «Pubblica indie event» nel menu utente con pagine segnaposto (`/concerti/nuovo`, `/indie/nuovo`); coordinate
arrotondate a 2 decimali e mai mostrate; «Salva» grigio e spento senza modifiche (grigio scuro per tutti i pulsanti primari
spenti); dopo il salvataggio si torna a `/profilo` con l'avviso; foto con ritorno all'iniziale. **Aggiunta:** avviso «Devi
eseguire l'accesso per vedere questi contenuti.» nella pagina di accesso per chi arriva da una pagina protetta. Profilo
pubblico aperto agli anonimi; la regola «solo gli autori di contenuti pubblicati» è Post-V1. Controllo a 375, 430, 768, 1024 e
1280 px.

- [ ] **1. Profilo e modifica (75 min).** `/profilo`: il `PATCH` invia solo i campi cambiati; stringa vuota
  per svuotare `bio`, `city`, `avatarUrl`; `displayName` non svuotabile; avatar solo `http`/`https`;
  `userUpdated` con la `MeResponse`.
- [ ] **2. Posizione (40 min).** `useBrowserPosition`; "Condividi la mia posizione" → `PATCH` con latitudine
  e longitudine insieme; "Smetti di condividere" → `DELETE /api/users/me/location`; messaggi per permesso
  negato o posizione non disponibile.
- [ ] **3. Ruoli (30 min).** Attivazione di MUSICIAN e HOST (idempotente) con la spiegazione di cosa
  sblocca ciascuno; voci "Pubblica" del menu secondo i ruoli.
- [ ] **4. Profilo pubblico e schede (50 min).** `/utenti/:id` (`PublicUserResponse`, 404 → "non
  trovato"); `AreaTabs` sotto il profilo (schede vuote che FE-06, FE-07 e FE-08 completano, mostrate
  secondo i ruoli).
- [ ] **5. Test e responsive (45 min).** Costruzione del `PATCH` (solo campi cambiati, vuoto = `""`,
  coordinate sempre insieme); pulsanti dei ruoli nascosti quando il ruolo c'è già. Tre larghezze.

**Commit proposto:** `feat(fe-users): aggiunge profilo, ruoli e area personale`

### Card FE-05 · Eventi vicini e mappa — stima 4 h

**Riferimenti:** §6.6, §10.2; decisioni 30, 32, 56, 57; decisione 8 di NoseY (mappa). Riuso NoseY:
`components/mappa/` (`Mappa`, `tipi`, `index` con caricamento differito, `IconaMarker`),
`features/eventi/ListaEventiMappa`, `components/eventi/CardEvento` (logica).
**File:** `src/components/map/` (`index.ts`, `Map.tsx`, `markers.tsx`, `map.css`);
`src/features/events/api/eventsApi.ts`, `pages/` (`NearbyEventsPage`, `ConcertDetailPage`,
`IndieEventDetailPage`), `components/` (`EventCard`, `RadiusSelector`), `hooks/useSearchCenter.ts`;
`src/types/events.ts`; `src/lib/urls.ts`, `src/lib/format/dates.ts`, `distance.ts`;
`src/components/ui/ExternalLink.tsx`, `LoadMore.tsx`, `EmptyState.tsx`; `src/test/handlers/events.ts`,
`fixtures/events.ts`; test accanto ai file (`useSearchCenter.test.ts`, `RadiusSelector.test.tsx`,
`ExternalLink.test.tsx`, `ConcertDetailPage.test.tsx`).

- [ ] **1. Mappa riusata (70 min).** `maplibre-gl` + `react-map-gl` + OpenFreeMap; stili Tailwind riscritti
  in `mappa.css` con i token; worker come file (`setWorkerUrl`), caricamento differito, attribuzione
  sempre visibile, marker accessibili da tastiera; concerti e indie distinti da icona ed etichetta, non
  solo dal colore. Prova sotto la CSP di `vite preview`: se fallisce, stop e decisione con lo studente.
- [ ] **2. Centro e raggio (40 min).** `useSearchCenter`: posizione del browser → coordinate del profilo →
  Firenze con avviso e pulsante "usa la mia posizione"; `RadiusSelector` a pulsanti con
  `RADIUS_LEVELS`, iniziale 15 km (ogni livello resta in cache).
- [ ] **3. Elenchi vicini (60 min).** `/eventi`: concerti e indie vicini (due endpoint, due schede) con
  distanza, data in ora locale e generi; "Carica altri"; mappa sopra l'elenco su telefono, affiancata da
  `lg`.
- [ ] **4. Dettagli (40 min).** `/concerti/:id` e `/indie/:id`; biglietto con `ExternalLink` (conferma con
  il dominio); bozza altrui o contenuto nascosto → "non trovato" (Review Focus 6).
- [ ] **5. Test e responsive (30 min).** Catena del centro (browser, profilo, predefinito); cambio di raggio
  → nuovi parametri; `ExternalLink` rifiuta `javascript:` e chiede conferma; 404 → pagina "non trovato".
  Tre larghezze.

**Commit proposto:** `feat(fe-events): aggiunge eventi vicini con mappa e dettagli`

### Card FE-06 · Pubblicazione eventi — stima 3,5 h

**Riferimenti:** §6.6, §10.1; decisioni 22, 55, 56, 57, 76 (`EVENTS_CREATED`, attesa della geocodifica),
77. Riuso NoseY: `features/eventi/FormEvento` (logica), `components/ui/DateTimeField`.
**File:** `src/features/events/pages/` (`NewConcertPage`, `NewIndieEventPage`), `components/`
(`ConcertForm`, `IndieEventForm`, `MyEventsTab`), `eventForm.ts`, `api/eventsApi.ts` (endpoint nuovi);
`src/components/ui/ConfirmDialog.tsx`; test accanto ai file (`eventForm.test.ts`, `ConcertForm.test.tsx`,
`MyEventsTab.test.tsx`).

- [ ] **1. Form del concerto (60 min).** Solo HOST: titolo 3–150, descrizione ≤5000, locale ≤150,
  indirizzo ≤255, data futura inviata con offset (Review Focus 5), generi ≤10 normalizzati, copertina e
  biglietto `http`/`https`; attesa "Sto cercando l'indirizzo…" fino a circa 15 s; `ADDRESS_NOT_FOUND`
  sul campo indirizzo, `GEOCODING_UNAVAILABLE` con invito a riprovare, `TOO_MANY_REQUESTS`; successo →
  dettaglio.
- [ ] **2. Form dell'indie event (40 min).** Solo MUSICIAN: gli stessi campi più `isFree`; "Salva come
  bozza" o "Pubblica".
- [ ] **3. Bozze, pubblicazione e cancellazione (50 min).** Schede "Concerti" (`/official-concerts/mine`) e
  "Indie event" (`/indie-events/mine`) dell'area personale; pubblica (`EVENT_DATE_PAST`,
  `EVENT_ALREADY_PUBLISHED`); cancella con `ConfirmDialog` e motivo facoltativo, anche dal dettaglio;
  invalidazione di elenchi vicini e `/mine`.
- [ ] **4. Test e responsive (60 min).** Conversione della data con offset; normalizzazione dei generi;
  `ADDRESS_NOT_FOUND` evidenzia il campo; errori della pubblicazione; la cancellazione aggiorna gli
  elenchi. Tre larghezze.

**Commit proposto:** `feat(fe-events): aggiunge pubblicazione, bozze e cancellazione degli eventi`

### Card FE-07 · Feed, like e testo degli utenti — stima 4,5 h

**Riferimenti:** §6.8, §8.6; decisioni 61, 79.
**File:** `src/components/ui/UserText.tsx`; `src/features/feed/api/feedApi.ts`, `pages/FeedPage`,
`components/` (`FeedPostCard`, `NewPostForm`, `MyPostsTab`); `src/types/feed.ts`;
`src/test/handlers/feed.ts`, `fixtures/feed.ts`; test accanto ai file (`UserText.test.tsx`,
`feedApi.test.ts`, `FeedPostCard.test.tsx`).

- [ ] **1. UserText (60 min).** Gli URL `http`/`https` del testo diventano `ExternalLink`, il resto resta
  testo con l'escape di React; a capo con `white-space: pre-line`. Si applica a ogni testo degli utenti
  già mostrato (bio, descrizioni) e a quelli delle card successive.
- [ ] **2. Feed (60 min).** `/feed`: dal più recente, "Carica altri", filtro "vicino a me" facoltativo
  (centro e livelli di FE-05, tutti e tre i parametri o nessuno); nuovo post (testo 1–2000, immagine,
  posizione facoltativa); cancellazione dei propri.
- [ ] **3. Like ottimistico (40 min).** `PUT`/`DELETE` del like con `updateQueryData` e `undo()` se il
  server risponde con un errore; un anonimo che clicca va all'accesso.
- [ ] **4. Scheda "Post" dell'area personale (20 min).** `GET /api/feed-posts/mine`.
- [ ] **5. Test e responsive (90 min).** `<script>` e `<img onerror>` restano testo; `javascript:alert(1)`
  non diventa un link (Review Focus 9); un URL `https` apre la conferma con il dominio e poi la scheda con
  `noopener`; like annullato su 500; filtro con tutti i parametri o nessuno. Tre larghezze.

**Commit proposto:** `feat(fe-feed): aggiunge feed, like ottimistico e link sicuri nei testi`

### Card FE-08 · Collab e candidature — stima 3 h

**Riferimenti:** §6.7; decisioni 24, 59, 60, 67, 77. Taglio n. 4.
**File:** `src/features/collab/api/collabApi.ts`, `pages/` (`CollabBoardPage`, `CollabDetailPage`,
`NewCollabPage`), `components/` (`CollabForm`, `ApplyForm`, `MyCollabTab`); `src/types/collab.ts`;
`src/test/handlers/collab.ts`; test accanto ai file (`CollabDetailPage.test.tsx`, `ApplyForm.test.tsx`).

- [ ] **1. Bacheca e dettaglio (50 min).** `/collab`: annunci aperti, "Carica altri"; dettaglio anche se
  chiuso, con l'indicazione "Chiuso".
- [ ] **2. Creazione, chiusura e cancellazione (40 min).** Solo MUSICIAN: titolo, descrizione, ruolo
  cercato, generi, luogo; chiusura idempotente; cancellazione con `ConfirmDialog`.
- [ ] **3. Candidatura (40 min).** Messaggio 1–1800; errori `COLLAB_CLOSED`, `CANNOT_APPLY_OWN_POST`,
  `TOO_MANY_REQUESTS`; 201 → "Apri la chat" verso `/chat/:conversationId` (attivo dopo FE-09b).
- [ ] **4. Scheda "Annunci" e test (50 min).** `GET /api/collab-posts/mine` con i chiusi. Test: candidatura
  nascosta sul proprio annuncio; la chiusura aggiorna l'indicazione; errori della candidatura. Tre
  larghezze.

**Criterio:** fase B chiusa: promemoria merge `develop → main`; su Render mappa con le tessere caricate,
pubblicazione con geocodifica, area personale, feed e like.
**Commit proposto:** `feat(fe-collab): aggiunge bacheca collab e candidature`

---

# Fase C — Social e admin (22 – 23 ottobre)

### Card FE-09a · Amicizie e ricerca utenti — stima 3,5 h

**Riferimenti:** §6.5 (ricerca), §6.14; decisioni 59, 63, 64. Riuso NoseY: `features/social/PulsanteAmicizia`,
`RigaAmicizia`, `AvatarAmico`, `hooks/useValoreRitardato`.
**File:** `src/features/friends/api/friendsApi.ts`, `pages/` (`UserSearchPage`, `FriendsPage`),
`components/FriendshipButton`; `src/types/friends.ts`; `src/components/layout/NotificationBell.tsx`
(conteggio delle richieste); `src/hooks/useDebouncedValue.ts`; `src/test/handlers/friends.ts`; test
accanto ai file (`FriendshipButton.test.tsx`, `UserSearchPage.test.tsx`).

- [ ] **1. Ricerca (50 min).** `/amici/cerca`: attesa di 400 ms dopo l'ultimo tasto, almeno 2 caratteri,
  risultati con lo stato dell'amicizia, "Carica altri", `TOO_MANY_REQUESTS` con il suo testo.
- [ ] **2. Pulsante dell'amicizia (60 min).** Per `FriendshipView`: `NONE` → "Aggiungi"; `OUTGOING` →
  "Richiesta inviata" e annulla; `INCOMING` → accetta o rifiuta; `FRIENDS` → "Amici", rimuovi (conferma)
  e "Scrivi" (`POST /api/chats`, attivo dopo FE-09b); `UNAVAILABLE` → disattivato con testo neutro.
  `FRIEND_REQUEST_ALREADY_RECEIVED` propone di accettare.
- [ ] **3. Elenchi (40 min).** `/amici` con le schede Amici, Ricevute e Inviate; invalidazione fra ricerca,
  elenchi e conteggio.
- [ ] **4. Campanella: richieste in attesa (25 min).** Conteggio da
  `GET /api/friendships?type=INCOMING&size=1` (`totalElements`), ricaricato all'apertura, al ritorno sulla
  scheda e dopo ogni azione; nessun polling. Commento con il motivo: notifiche live delle amicizie fuori
  dall'MVP (decisione 59, Post-V1).
- [ ] **5. Test (35 min).** Pulsante per ogni stato; accettare aggiorna elenchi e conteggio; nessuna
  ricerca sotto i 2 caratteri; attesa prima della chiamata.

**Commit proposto:** `feat(fe-friends): aggiunge ricerca utenti e gestione delle amicizie`

### Card FE-09b · Chat, notifiche e contatto — stima 6 h

**Riferimenti:** §1.3 (punti 7 e 8), §6.9, §7.1–7.9; decisioni 28, 35, 59, 65, 66, 67, 69. Riuso NoseY:
`lib/websocket.ts`, `components/layout/ConnessioneLive`, `features/social/Conversazione`, `ElencoChat`,
`FormMessaggio`, `useNotificheLive`, `RigaNotifica`, `tempiChat`.
**File:** `src/lib/stomp/client.ts`, `destinations.ts`, `useStompStatus.ts`;
`src/features/chat/api/chatApi.ts`, `pages/ChatPage`, `components/` (`ConversationList`,
`ConversationView`, `MessageComposer`), `chatCache.ts`; `src/features/notifications/notificationsSlice.ts`,
`components/` (`LiveNotifications`, `NotificationItem`); `src/components/layout/MessagesBadge.tsx`,
`NotificationBell.tsx` (voci di sessione); `src/features/events/components/ContactOrganizer.tsx`;
`src/types/chat.ts`; `src/test/handlers/chat.ts`, `fixtures/chat.ts`; test accanto ai file
(`client.test.ts`, `chatCache.test.ts`, `ConversationView.test.tsx`, `MessagesBadge.test.tsx`).

- [ ] **1. Client STOMP (80 min).** Da `lib/websocket.ts` di NoseY: una connessione finché la sessione è
  attiva, URL della stessa origine; `beforeConnect` legge il token corrente; riconnessione automatica
  (circa 5 s) e nuove SUBSCRIBE alle tre code a ogni connessione; riconnessione dopo ogni refresh
  (`onTokenRefreshed`); `TOKEN_INVALID` → refresh e riconnessione; `ACCOUNT_SUSPENDED` (coda errori o
  frame ERROR) → `sessionEnded` con `SuspendedNotice`; indicatore dello stato della connessione.
- [ ] **2. Elenco delle conversazioni (50 min).** `/chat`: altro utente, ultimo messaggio con `UserText`,
  `unreadCount`, `canSend`; badge 💬 = somma degli `unreadCount`, aggiornato a ogni `NEW_MESSAGE`.
- [ ] **3. Conversazione (80 min).** `/chat/:id`: storico a cursore (30 per volta, "Messaggi precedenti"
  con `before`); messaggi di `/user/queue/messages` aggiunti alla cache senza duplicati (Review Focus 8);
  propri messaggi riconosciuti da `senderId`; `PATCH .../read` all'apertura e all'arrivo di un messaggio
  con la conversazione aperta; casella disattivata con spiegazione se `canSend` è falso; invio su
  `/app/chats/{id}/send`; errori della coda (`VALIDATION_ERROR`, `TOO_MANY_REQUESTS`, `CHAT_LOCKED` →
  `canSend` falso e ricarica). Su desktop elenco e conversazione affiancati, su telefono e tablet un
  pannello alla volta.
- [ ] **4. Notifiche e contatto (50 min; notifiche = taglio n. 2, contatto = taglio n. 3).** Toast di
  `NEW_LIKE`, `COLLAB_APPLICATION` e `NEW_MESSAGE` (quest'ultimo solo fuori da quella conversazione);
  voci di sessione nella campanella. "Contatta l'organizzatore" nel dettaglio di concerti e indie event
  (messaggio 1–1800; `EVENT_CLOSED`, `CANNOT_CONTACT_OWN_EVENT`, `TOO_MANY_REQUESTS`; 201 → chat).
  "Scrivi" di FE-09a e "Apri la chat" di FE-08 attivi.
- [ ] **5. Test (100 min).** Client STOMP con `Client` simulato: `beforeConnect` usa l'ultimo token; refresh
  → riconnessione; `TOKEN_INVALID` → refresh e poi riconnessione; `ACCOUNT_SUSPENDED` → sessione chiusa con
  avviso; nessun `TOKEN_INVALID` dopo 15 minuti grazie al rinnovo anticipato (Review Focus 7, timer finti);
  dedupe dei messaggi; storico a cursore unito senza buchi; casella disattivata con `canSend` falso; somma
  del badge. Prova manuale con due browser e due utenti in locale: chat in tempo reale, notifica,
  sospensione (da Postman fino a FE-10) che chiude la sessione.

**Commit proposto:** `feat(fe-chat): aggiunge chat in tempo reale, notifiche e contatto degli eventi`

### Card FE-10 · Area di moderazione — stima 4 h

**Riferimenti:** §5.4–5.7, §6.10; decisioni 25, 26, 27, 54, 62. Riuso NoseY: `pages/AdminUtenti`,
`features/admin/apiAdmin`, `components/ui/ConfirmDialog`, `Paginazione`.
**File:** `src/features/admin/api/adminApi.ts`, `pages/` (`AdminUsersPage`, `HiddenContentPage`, caricate
in modo differito), `components/` (`SuspensionDialog`, `AdminRoleButton`, `HideContentButton`);
`src/types/admin.ts`; `src/test/handlers/admin.ts`; test accanto ai file (`SuspensionDialog.test.tsx`,
`AdminUsersPage.test.tsx`, `HiddenContentPage.test.tsx`).

- [ ] **1. Elenco utenti (50 min).** `/admin/utenti` (solo ADMIN e SUPERADMIN nell'interfaccia): ricerca,
  filtro di stato, numeri di pagina; tabella da `lg`, schede su telefono e tablet.
- [ ] **2. Sospensione e riattivazione (60 min).** Motivo 1–500; durata a pulsanti fra 1, 3, 7, 30, 90 giorni
  e indeterminata (decisione 93: niente giorni liberi né data di fine); `INSUFFICIENT_PLATFORM_LEVEL`,
  `LAST_SUPERADMIN`; riattivazione con conferma; la riga si aggiorna.
- [ ] **3. Nomina ADMIN (30 min).** Solo per SUPERADMIN: nomina e revoca; `USER_NOT_VERIFIED`,
  `USER_NOT_ACTIVE`, `INSUFFICIENT_PLATFORM_LEVEL`.
- [ ] **4. Moderazione dei contenuti (60 min).** "Nascondi" con motivo 3–500 nei dettagli e negli elenchi di
  concerti, indie, post e annunci (solo per ADMIN); `/admin/contenuti` con una scheda per tipo
  (`hidden`) e "Ripristina"; per un contenuto cancellato dal proprietario il ripristino è disattivato con
  la spiegazione (`RESTORE_NOT_ALLOWED`); invalidazione degli elenchi pubblici.
- [ ] **5. Test e responsive (40 min).** Menu admin nascosto a FAN e MUSICIAN; nomina visibile solo al
  SUPERADMIN; nel form di sospensione vale solo l'ultima durata scelta (mai giorni e indeterminata insieme);
  ripristino disattivato per `deletedByOwner`. Tre larghezze.

**Criterio:** fase C chiusa: promemoria merge `develop → main`; su Render chat fra due account,
sospensione dall'area admin che chiude la sessione WebSocket dell'altro, hide e restore.
**Commit proposto:** `feat(fe-admin): aggiunge l'area di moderazione`

---

# Nome utente unico (22 ottobre, prima di F7-06)

Richiesta dello studente il 22 ottobre: gli utenti non hanno nome e cognome, quindi il nome visibile (`displayName`) deve essere unico,
come un nome utente nei videogiochi. Oggi nel database è unica solo l'email (`uq_users_email`): due utenti possono chiamarsi allo stesso
modo (nel database locale non ce ne sono). Scelta dello studente fra tre soluzioni: **A, nome unico e basta**; aggiungere nome e
cognome (facoltativi o obbligatori) è rimandato alle funzioni future (progettazione §15). Una card sola, backend e frontend, come
l'unicità della email: si fa **prima** di F7-06, perché la sua migrazione deve precedere quella delle notifiche.

### Card F7-08 · Nome utente unico — stima 2,5 h (provvisoria)

**Riferimenti:** decisione 84 (regole su nome e password), `docs/schema-db.md`; §4.4, §6.4, §6.5; decisione 41 e 43 (entity).
**Sicurezza: sì** (impersonificazione: stessi nomi, nomi che imitano l'amministrazione).
**Eccezione ai Vincoli globali:** il backend si tocca qui (migrazione, errore, test, Postman), insieme a un piccolo intervento nel frontend.

**Scelte già approvate dallo studente (soluzione A «come proponi»):**
- il nome è unico **senza distinguere maiuscole** («Marco» e «marco» sono lo stesso nome);
- gli spazi nel nome restano ammessi (come oggi: 3 degli 8 nomi del database locale ne hanno);
- **nomi riservati**: admin, superadmin e resonance non si possono scegliere (elenco esatto da confermare a inizio card); l'account SUPERADMIN
  creato dalle variabili d'ambiente (`SuperadminBootstrap`) non cambia, come in F7-05;
- un nome lasciato da chi lo cambia torna disponibile;
- nessuna colonna nuova e nessun rinominare: il campo resta `displayName` in DTO, JSON e Postman; nell'interfaccia diventa «Nome utente»
  (testi da proporre allo studente a inizio card).

**Punti aperti posti allo studente a inizio card (decisi il 22 ottobre, decisione 96):**
- elenco esatto dei nomi riservati e se vietarli anche con maiuscole e spazi diversi;
- cosa fare se su Render esistono già nomi doppi (di solito si controlla con una `SELECT` di sola lettura prima della migrazione);
- se i doppi spazi dentro il nome si riducono a uno solo nei nomi nuovi;
- nome «quasi uguale» (per esempio con lettere simili): si accetta il rischio o si aggiunge una regola;
- testo dell'errore («Questo nome utente è già preso») e dell'etichetta nell'interfaccia.

**Sotto-task (bozza, da dettagliare con lo studente a inizio card):**
- [x] **1. Regole e test.** Controllo dei doppioni esistenti, migrazione con indice unico su `lower(display_name)`, nomi riservati; test del
  service.
- [x] **2. Registrazione e modifica del profilo.** Nuovo errore 409 `DISPLAY_NAME_TAKEN`; due richieste insieme: la seconda ottiene il 409 per
  l'indice, non un 500; test d'integrazione.
- [x] **3. Frontend.** Messaggio sul campo nel form di registrazione e nel profilo, etichetta «Nome utente», test; tre larghezze con Playwright.
- [x] **4. Postman, documentazione e chiusura.** Collection (409 in registrazione e in modifica), §4.4, §6.2, §6.4, §6.5, `schema-db.md`,
  decisione nuova, questo piano; `./mvnw -q verify`, `npm run lint`, `npm test`, `npm run build`.

**Esito (decisione 96):** nomi occupati anche dagli account non verificati, che un job orario elimina dopo 24 ore dall'ultimo invio del codice
(aggiunta approvata a inizio card, parte del sotto-task 1); nomi riservati solo se il nome intero coincide con uno dell'elenco; spazi
ripetuti ridotti a uno; errore 409 `DISPLAY_NAME_TAKEN` «Nome già utilizzato» solo sotto il campo.

**Criterio:** due utenti non possono avere lo stesso nome, anche con maiuscole diverse; nomi riservati rifiutati; il frontend mostra l'errore
sul campo; `./mvnw -q verify` e test del frontend verdi; Postman con il 409.
**Commit proposto:** `feat(users): rende unico il nome utente`

---

# Notifiche persistenti (22 ottobre, prima di FE-12)

Aggiunta dello studente il 22 ottobre, dopo FE-10: la campanella resta vuota quando una richiesta di amicizia è accettata (nessuna
notifica a chi l'ha mandata) e le notifiche non si ritrovano dopo un ricarico. Lo studente vuole il comportamento di una campanella
come quella di Facebook: notifiche salvate, che restano finché non sono lette. Oggi sono solo in memoria (progettazione §6.13) e le
notifiche delle amicizie sono Post-V1 (decisione 59): la richiesta **sostituisce** quella parte della decisione 59 (nuova decisione
da scrivere a inizio di F7-06). Nessun taglio: lo studente ha scelto di non tagliare e di lavorare anche di sera se serve.

Due card, come F7-04: F7-06 nel backend (ciclo del backend: TDD, `./mvnw -q verify`, Postman, schema) e FE-13 nel frontend (ciclo del
frontend: `npm run lint`, `npm test`, `npm run build`, tre larghezze con Playwright). **Eccezione ai Vincoli globali:** il backend si
tocca in F7-06, con la collection Postman. **Le stime sono provvisorie** e l'ambito **non è deciso**: i punti sotto si pongono allo
studente a inizio card, uno per uno, prima di scrivere test o codice.

### Card F7-06 · Notifiche persistenti (backend) — stima 3,5 h (provvisoria)

**Riferimenti:** decisione 59 (da sostituire nella parte sulle notifiche delle amicizie), decisione 92 (notifiche live e campanella);
§6.13, §6.14, §7 (notifiche live), `docs/schema-db.md`. Riuso NoseY: `notification/Notifica*` e `NotificheService*` sono nella lista «non
portato» di `riuso-nosey.md`: si guardano solo come riferimento e la decisione sul riuso la prende lo studente.
**Sicurezza: sì** (ogni utente legge e segna lette solo le proprie notifiche).
**File:** package `notification` (entity, repository, service, controller, DTO), migrazione `V11`, i service che creano le notifiche
(`FriendshipService`, `FeedService`, `CollabService`); test d'integrazione; Postman (cartella `Notifications`); `docs/schema-db.md`
(erDiagram e flowchart), `docs/progettazione.md`, `docs/decisioni.md`, `README.md`, `package-info.java`, questo piano. `SecurityConfig` non
cambia: ogni percorso non elencato richiede già il login.

**Scelte approvate a inizio card (23 ottobre, decisione 97):**
- **Eventi salvati:** richiesta di amicizia ricevuta, richiesta accettata, like (una sola notifica per coppia autore-post) e candidatura.
  `NEW_MESSAGE` e il contatto degli eventi restano solo live. La richiesta rifiutata resta silenziosa.
- **Stato di lettura:** solo letta/non letta. Una richiesta accettata o rifiutata resta nell'elenco, letta; una annullata sparisce.
- **Elenco:** dalla più recente, paginato; conservazione 30 giorni con pulizia giornaliera; nessun tetto per utente.
- **Live:** restano, con l'`id` della notifica salvata e i nuovi tipi `FRIEND_REQUEST` e `FRIEND_ACCEPTED`.
- **Endpoint:** `GET /api/notifications`, `GET .../unread-count`, `POST .../{id}/read`, `POST .../read-all`; altrui o inesistente 404.
- **Dati esistenti:** si parte da zero, nessuna migrazione dei dati. **Privacy:** niente testo di messaggi; anche per utenti sospesi.
- **Postman:** nuova cartella `Notifications`.

**Sotto-task:**
- [x] **1. Schema e migrazione.** Tabella delle notifiche con stato di lettura e indici; `schema-db.md` (erDiagram di dettaglio e completo,
  flowchart di panoramica).
- [x] **2. Creazione delle notifiche.** Dagli eventi scelti (richiesta, accettazione, …), nella stessa transazione e senza rompere le
  notifiche live esistenti.
- [x] **3. Endpoint.** Elenco, conteggio non lette, segna letta, segna tutte lette; solo le proprie notifiche; test d'integrazione.
- [x] **4. Notifica live e compatibilità.** Cosa arriva sul WebSocket e come il frontend di FE-13 la unisce all'elenco salvato.
- [x] **5. Postman, documentazione e chiusura.** Collection (successo e almeno un errore per endpoint), `progettazione.md`,
  `decisioni.md` (sostituzione di parte della 59), questo piano; `./mvnw -q verify`.

**Criterio:** `./mvnw -q verify` verde; Postman con gli endpoint nuovi; notifiche salvate e lette provate in locale con due account.
**Commit proposto:** `feat(notifications): aggiunge le notifiche persistenti con stato di lettura`

### Card FE-13 · Notifiche persistenti (frontend) — stima 3,5 h (provvisoria)

**Riferimenti:** F7-06 (endpoint e modello), decisione 92 (campanella e toast), decisione 91 (richieste di amicizia nella campanella),
decisione 78; **Playwright** (decisione 94) per il controllo a tre larghezze.
**File (da confermare a inizio card):** `features/notifications/` (api, componenti, slice), `components/layout/NotificationBell.tsx`,
test accanto ai file, handler e dati finti in `test/`, `types/`.

**Scelte approvate a inizio card (23 ottobre, decisione 98):**
- **Elenco:** unico, dalla più recente, 10 per pagina con «Carica altri»; non lette con accento giallo e pallino giallo.
- **Numero sull'icona:** le non lette del server, da 1 a «9+»; scende solo segnandole lette.
- **Clic:** segna letta sul server e porta al bersaglio (richieste ricevute, profilo di chi ha accettato, feed, annuncio).
- **Richieste in attesa:** riga della notifica con Accetta e Rifiuta finché in attesa e tra le 10 più recenti; fuori dalle 10 nessun pulsante,
  il clic porta a `/amici?scheda=ricevute`.
- **Toast e messaggi:** i toast restano; `NEW_MESSAGE` solo toast, non in campanella né nel numero.
- **Live:** la notifica con `id` entra in cima alla prima pagina in cache e alza il numero senza chiamare il server; dopo una riconnessione si
  rilegge. Rilettura anche ad apertura dell'app, apertura del pannello e ritorno sulla scheda; nessun polling.
- **Testi:** bozza proposta («NOME ti ha inviato una richiesta di amicizia», «NOME ha accettato la tua richiesta di amicizia», «Nessuna notifica.»).

**Sotto-task:**
- [x] **1. Tipi e API.** Endpoint di F7-06 con RTK Query, tag di cache, dati finti e handler MSW.
- [x] **2. Campanella.** Elenco salvato nel pannello, non lette evidenziate, numero, «Segna come lette», vuoto ed errore.
- [x] **3. Notifiche live.** Una notifica in arrivo si unisce all'elenco e al numero; riconnessione.
- [x] **4. Test, responsive e chiusura.** Test mirati; tre larghezze con Playwright; `npm run lint`, `npm test`, `npm run build`;
  decisioni e questo piano.

**Criterio:** campanella con notifiche che restano finché non sono lette, anche dopo il ricarico e fra due account (richiesta mandata,
accettata, notifica a chi l'ha mandata); test verdi; tre larghezze.
**Commit proposto:** `feat(fe-notifications): mostra le notifiche persistenti nella campanella`

### Card F7-07 · Prova di sicurezza dinamica con Strix — stima 3 h (provvisoria, dipende dalle segnalazioni)

Card aggiunta dallo studente il 22 ottobre, dopo FE-13 e prima di FE-12. **Strix** (`usestrix/strix`, open source, licenza Apache-2.0) è un
agente AI che attacca un'applicazione web in funzione e prova le falle con proof-of-concept; serve a cercare falle di sicurezza, in
aggiunta al report di F6-02 e alle correzioni di F7-03. **Playwright** (decisione 94) resta quello previsto: prove visive a tre
larghezze, non sicurezza. Scartata ponytail (skill che riduce il codice scritto: non serve a testare e va contro le regole sui commenti e sui
test). È una card del backend (le correzioni toccano soprattutto `Resonance_BE`), descritta qui come F7-04 e F7-06.

**Riferimenti:** decisione 76 (CSP, rinforzo di sicurezza), `docs/report-sicurezza.md` (F6-02), decisione 94; §4 (autenticazione), §6.2
(codici d'errore), §8 (sicurezza). Strumento esterno: si legge la fonte e si fissa una versione prima di installarlo; non entra nelle
dipendenze del progetto e non si committa nulla di suo.
**Sicurezza: sì.**
**Eccezione ai Vincoli globali:** le correzioni toccano il backend (e il frontend dove serve), come F7-04, F7-06 e la CSP di FE-11.

**Punti aperti da porre allo studente a inizio card (nessuno è deciso):**
- **Modello AI e chiave:** quale provider e modello fa girare Strix, quanto si è disposti a spendere, dove sta la chiave (mai nel
  repository, in un documento o in un messaggio di commit). Che cosa lascia il PC: codice, richieste e risposte di prova vanno al provider.
- **Dove gira:** solo su uno stack locale isolato (backend e database di prova separati dal database vero, SUPERADMIN di prova, email
  finte nel log, nessuna chiamata a Brevo). **Mai** contro Render né contro il database con l'account vero dello studente. Che cosa fare
  con la geocodifica (Nominatim reale, con il suo limite) e con i limiti di frequenza che possono bloccare il login durante la prova.
- **Modalità e confini:** prova senza credenziali e/o con account FAN, MUSICIAN, HOST, ADMIN e SUPERADMIN; aree incluse (autenticazione,
  controlli d'accesso, contenuti, chat, notifiche, moderazione, WebSocket, Swagger) e aree escluse; durata e numero di giri.
- **Come si trattano i risultati:** ogni segnalazione si verifica a mano prima di correggere (falsi positivi); gravità; che cosa si corregge
  subito (con un test che fallisce prima, come ogni correzione), che cosa si rimanda o si accetta con una decisione.
- **Dove sta il report:** aggiornare `docs/report-sicurezza.md` (è in `.gitignore` ma già tracciato) oppure un documento nuovo; mai
  segreti, dettagli di exploit completi o credenziali nel documento (regola del progetto).

**Sotto-task (bozza, da dettagliare con lo studente a inizio card):**
- [ ] **1. Strumento e ambiente.** Lettura della fonte e versione fissata; stack locale isolato e dati di prova; prova a vuoto.
- [ ] **2. Scansione.** Senza credenziali e con gli account scelti; raccolta delle segnalazioni.
- [ ] **3. Verifica a mano e classificazione.** Per ogni segnalazione: riproducibile o falso positivo, gravità, area.
- [ ] **4. Correzioni.** Una alla volta, con test prima, Postman se cambia un endpoint; `./mvnw -q verify` e, se tocca il frontend, lint,
  test e build.
- [ ] **5. Report e decisione.** Esito nel report, decisione nuova con le scelte dello studente, questo piano; nessuna credenziale
  scritta; stack di prova spento e database di prova eliminato.

**Criterio:** nessuna segnalazione valida di gravità alta o media lasciata aperta senza una decisione dello studente; test verdi dopo le
correzioni; report aggiornato; nessun dato o chiave nel repository.
**Commit proposto:** `fix(security): corregge le falle trovate dalla prova dinamica`

---

# Rifiniture del 23 ottobre (prima di FE-12)

Richieste dello studente emerse provando l'app in locale il 23 ottobre (otto card, una per voce, con la candidatura unica divisa
in backend e frontend); si fanno tutte lo stesso giorno, un commit per card, nell'ordine sotto, prima di FE-12. **Le stime sono
provvisorie.** Se il giorno sfora si avvisa subito e si propone un taglio. Ogni card ha i suoi punti aperti da porre allo studente a inizio card, uno
per uno, prima di scrivere test o codice. **Eccezione ai Vincoli globali** per F7-09 (e per FE-16 se serve il backend): il backend si
tocca con la collection Postman.

**Restano fuori (scelta dello studente, 23 ottobre):** la **partecipazione agli eventi** con un click resta in Post-V1 (serve una
tabella nuova e una migrazione) e la **cancellazione dei messaggi** di chat resta in Post-V1. Nessuna pagina delle notifiche: resta il
pannello della campanella (FE-15).

### Card F7-09 · Candidatura unica per annuncio (backend) — stima 2 h (provvisoria)

**Perché:** oggi ci si può candidare allo stesso annuncio senza limite e si riempie la chat dell'autore di messaggi (nel database
c'erano già due candidature dello stesso utente allo stesso annuncio).
**Riferimenti:** progettazione §6.7 (candidatura), decisione 97 (notifiche), `CollabService.apply`, `docs/schema-db.md`.
**Sicurezza: sì** (abuso e spam di messaggistica).
**File (da confermare a inizio card):** `collab/CollabService`, eventuale migrazione, `ErrorCode`, test d'integrazione, Postman
(cartella Collab), `progettazione.md`, `decisioni.md`, questo piano.

**Scelta approvata (23 ottobre):** una sola candidatura per annuncio e utente; la seconda dà errore.

**Punti aperti (decisi dallo studente il 23 ottobre, decisione 99):**
- come si riconosce la candidatura già fatta (oggi non c'è una tabella delle candidature: vincolo nuovo con migrazione, oppure
  controllo sulle tracce esistenti) e che cosa accade alle candidature doppie già presenti;
- codice d'errore, stato HTTP e testo; ordine rispetto agli altri controlli e al limite di frequenza;
- due richieste insieme: la seconda ottiene l'errore previsto e non un 500;
- se l'annuncio chiuso e riaperto ammette una nuova candidatura.

**Sotto-task:**
- [x] **1. Test e regola.** Test che fallisce prima; la seconda candidatura è rifiutata; due richieste insieme.
- [x] **2. Schema (se serve).** Non serve: la riga di `chat_unlocks` basta, nessuna migrazione. Migrazione e `schema-db.md` (erDiagram di dettaglio e completo, flowchart di panoramica).
- [x] **3. Postman, documentazione e chiusura.** Richiesta di successo e errore, `progettazione.md`, `decisioni.md`, questo piano;
  `./mvnw -q verify`.

**Criterio:** `./mvnw -q verify` verde; la seconda candidatura allo stesso annuncio è rifiutata e non crea messaggi né notifiche.
**Commit proposto:** `feat(collab): consente una sola candidatura per annuncio`

### Card FE-14 · Candidatura unica (frontend) — stima 1 h (provvisoria)

**Riferimenti:** F7-09; FE-08 (collab e candidature).
**Scelta approvata (23 ottobre):** dopo la candidatura il bottone diventa «Candidatura inviata» e non si può premere.
**Punti aperti (decisi dallo studente il 23 ottobre, decisione 100):** come il frontend sa che ci si è già candidati (campo nella risposta
dell'annuncio, cioè una modifica al backend: `applicationConversationId` nel solo dettaglio); testo dell'errore e dell'etichetta; che cosa
vede chi ricarica la pagina. **Eccezione ai Vincoli globali** (backend e Postman toccati, con test d'integrazione e richiesta Postman).
**Sotto-task:**
- [x] **1. Stato e bottone.** «Candidatura inviata», errore chiaro se il server rifiuta; test. Con il campo nuovo nel dettaglio (backend, Postman,
  `progettazione.md`), campo nascosto e pulsante spento anche dopo il ricarico, `COLLAB_ALREADY_APPLIED` con testo e rilettura del dettaglio.
- [x] **2. Chiusura.** Tre larghezze con Playwright; `npm run lint`, `npm test`, `npm run build`; piano e decisioni.

**Criterio:** nessuna seconda candidatura dall'interfaccia; test verdi; tre larghezze.
**Commit proposto:** `feat(fe-collab): mostra la candidatura inviata e blocca la ripetizione`

### Card FE-15 · Margine del pannello delle notifiche sul telefono — stima 0,5 h (provvisoria)

**Perché:** sotto i 460 px di larghezza il pannello della campanella sta attaccato al bordo (visto a 448 px, a 460 è corretto).
**Scelta approvata (23 ottobre):** solo il margine, deve fermarsi con lo stesso margine che ha a 460 px; il resto del pannello
(a pagine di 10 con «Carica altri») non cambia; nessuna pagina nuova e nessuno scorrimento infinito.
**File:** `src/styles/index.css` (`.rs-bell__panel`), test sul CSS dove c'è.
**Punti aperti a inizio card:** il margine esatto da usare e come si comporta il pannello sotto i 360 px.
**Sotto-task:**
- [ ] **1. CSS e prova.** Margine corretto a 448 px e sotto; invariato da 460 px in su; controllo con Playwright; `npm run lint`,
  `npm test`, `npm run build`.

**Criterio:** a 448 px il pannello ha gli stessi margini che a 460 px.
**Commit proposto:** `fix(fe-ui): corregge il margine del pannello delle notifiche sul telefono`

### Card FE-16 · Richiesta di amicizia dal profilo — stima 2,5 h (provvisoria)

**Perché:** oggi non si può chiedere l'amicizia da un profilo (da ricerca utenti o dal nome dell'autore di un evento, di un post o di
un annuncio).
**Riferimenti:** FE-09a (amicizie e ricerca utenti), decisioni 78 e 91; pagina profilo degli altri utenti.
**Scelta approvata (23 ottobre):** bottone che segue lo stato: «Aggiungi agli amici», «Richiesta inviata», «Accetta» e «Rifiuta» se la
richiesta l'ha mandata l'altro, «Amici».
**Punti aperti (decisi dallo studente il 23 ottobre, decisione 102):** stato dell'amicizia con un endpoint nuovo `GET /api/friendships/with/{userId}`
(solo con login, 400 sul proprio id, 404 per utenti non attivi, limite dedicato `FRIENDSHIP_STATE` di 60 al minuto, consumato per primo); pulsante
`FriendshipButton` con tutti i suoi stati e «Aggiungi agli amici» sul profilo (prop `addLabel`), nell'intestazione sotto nome e città; sul proprio
profilo niente, senza sessione il link «Accedi per aggiungere» con ritorno al profilo. **Eccezione ai Vincoli globali** (backend e Postman toccati,
con test d'integrazione e richieste Postman nella cartella Friends).
**Sotto-task:**
- [x] **1. Stato dell'amicizia.** Come il frontend lo ottiene; dati finti e handler MSW. Con l'endpoint nuovo (backend, limite, test d'integrazione,
  Postman, `progettazione.md` 6.14 e 8.8), `getFriendshipWith`, tag `FriendshipState` e handler MSW.
- [x] **2. Bottone sul profilo.** Quattro stati, errori, test. `ProfileFriendship` nel `ProfileHeader`, `addLabel` su `FriendshipButton`.
- [x] **3. Chiusura.** Tre larghezze con Playwright; `npm run lint`, `npm test`, `npm run build`; piano e decisioni.

**Criterio:** da un profilo (anche arrivando dal nome dell'autore) si manda e si accetta una richiesta fra due account, senza doppioni.
Provato con Playwright a 375, 768 e 1280 px fra due account su un database di prova separato.
**Commit proposto:** `feat(fe-friends): aggiunge la richiesta di amicizia dal profilo`

### Card FE-17 · Amici nella navigazione laterale — stima 1,5 h (provvisoria)

**Riferimenti:** decisione 83 (navigazione), `SideNav`, `navItems.ts`, `UserMenu`; icone animate (Animate UI); decisione 103.
**Scelte approvate (23 ottobre, riviste con lo studente a inizio card):** una voce «Amici» che apre `/amici`, in `NAV_ITEMS` dopo
«Profilo»: quindi nella colonna a sinistra da 768 px **e** nelle tab del telefono (sei), con la stessa animazione delle altre voci (sulla
voce intera); icona `coffee` dal registro Animate UI (diversa da Collab e Profilo); la voce «Amici» **esce dal menu del profilo a ogni
larghezza**; badge col numero delle richieste ricevute (stessa query della campanella, stile dei Messaggi, aggiornato anche dalla
notifica live e dopo una riconnessione). La scelta iniziale («sul telefono resta nel menu») è sostituita: vedi decisione 103.
**Sotto-task:**
- [x] **1. Icona e voce.** Icona adattata al progetto, voce nella colonna con hover animato, stato attivo. `coffee.tsx`, voce in `navItems.ts`,
  `FriendRequestsBadge` (con test).
- [x] **2. Menu del profilo.** «Amici» solo sul telefono; test aggiornati. Poi riveduto: «Amici» esce dal menu a ogni larghezza; test di
  `UserMenu`, `TabBar` e `SideNav` aggiornati; notifica live e riconnessione invalidano `FriendRequests` (test in `notificationsApi` e `LiveNotifications`).
- [x] **3. Chiusura.** Tre larghezze con Playwright; `npm run lint`, `npm test`, `npm run build`; piano e decisioni.

**Criterio:** «Amici» è nella colonna da 768 px e nelle tab del telefono, non nel menu; comportamento uguale alle altre voci, con il badge delle richieste.
Provato con Playwright a 360, 375, 768 e 1280 px con tre account reali su un database di prova separato.
**Commit proposto:** `feat(fe-nav): aggiunge Amici alla navigazione con il badge delle richieste`

### Card FE-18 · Filtro «Eventi» sulla mappa — stima 2 h (provvisoria)

**Riferimenti:** FE-05 (eventi vicini e mappa), decisioni 78 e 83; scheda Ufficiali / Indie.
**Scelta approvata (23 ottobre):** nuova scheda «Eventi» prima di Ufficiali e Indie, selezionata all'apertura, che mostra insieme i
due tipi sulla mappa nel raggio scelto; Ufficiali e Indie restano come filtri.
**Scelte approvate (23 ottobre, a inizio card):** due chiamate in parallelo, elenco unito per distanza, «Carica altri» per tipo; con un
tipo non caricato si mostra l'altro con un avviso e «Riprova»; nessun parametro = Eventi, `?tipo=ufficiali` e `?tipo=indie`; legenda,
titolo e conteggio (somma dei totali) invariati, vuoto «Nessun evento entro N km». Vedi decisione 104.
**Sotto-task:**
- [x] **1. Dati.** Elenco unico dei due tipi nel raggio: hook `useNearbyEvents` con test (gli handler MSW esistenti bastano).
- [x] **2. Scheda e mappa.** Scheda «Eventi» predefinita, marcatori dei due tipi, vuoto ed errore (anche di un tipo solo); `router.test.tsx`
  registra anche gli indie.
- [x] **3. Chiusura.** Tre larghezze con Playwright (risposte simulate); `npm run lint`, `npm test`, `npm run build`; piano e decisioni.

**Criterio:** all'apertura si vedono sulla mappa tutti gli eventi nel raggio; Ufficiali e Indie li restringono.
Provato con Playwright a 375, 768 e 1280 px con le risposte di `/nearby` simulate nel browser (nessun database).
**Commit proposto:** `feat(fe-events): aggiunge la scheda Eventi con ufficiali e indie insieme`

### Card FE-19 · Selettore di emoji nella chat — stima 2 h (provvisoria)

**Riferimenti:** FE-09b (chat), regola sulle emoji (decisione 84: ammesse nei messaggi, non in nome e password); CSP (decisione 76).
**Scelta approvata (23 ottobre):** si fa adesso, con una libreria già pronta; un pulsante nella casella del messaggio apre il selettore
e inserisce l'emoji nel testo.
**Punti aperti a inizio card:** quale libreria (peso, tema scuro, italiano, compatibilità con la CSP: niente script inline né da CDN);
dove sta il pulsante e come si apre su telefono e desktop; inserimento nel punto del cursore; accessibilità da tastiera; peso del
bundle.
**Sotto-task:**
- [x] **1. Libreria e pulsante.** Dipendenza scelta, pulsante e selettore nel tema scuro.
- [x] **2. Inserimento nel testo.** Nel punto del cursore, con il limite di lunghezza del messaggio; test.
- [x] **3. Chiusura.** Tre larghezze con Playwright, prova del peso; `npm run lint`, `npm test`, `npm run build`; piano e decisioni.

**Criterio:** dalla chat si apre il selettore e l'emoji entra nel messaggio; test verdi; tre larghezze; bundle sotto controllo.
**Esito (23 ottobre, decisione 105):** libreria `emoji-picker-element` con dati italiani locali, caricata solo all'apertura (chunk di 38 KB, bundle iniziale invariato); provato con Playwright a 375, 768 e 1280 px (risposte simulate) e con la CSP di `vite preview`.
**Commit proposto:** `feat(fe-chat): aggiunge il selettore di emoji nella chat`

### Card FE-20 · Icone animate al tocco su tablet — stima 1 h (provvisoria)

**Perché:** su tablet le icone non si animano al tocco come sul telefono e, senza cursore, l'animazione al passaggio del mouse non
scatta mai (richiesta dello studente, 23 ottobre).
**Riferimenti:** decisione 83 (navigazione), `SideNav`, `navItems.ts`, icone animate (Animate UI).
**Punti aperti a inizio card (nessuno è deciso):** quali icone e quale evento le anima al tocco; come si riconosce un dispositivo senza
cursore (`hover: none` / `pointer: coarse`) e che cosa succede con tastiera o mouse collegati; durata e `prefers-reduced-motion`.
**Sotto-task:**
- [ ] **1. Animazione al tocco.** Le icone si animano al tocco sui dispositivi senza cursore; test.
- [ ] **2. Chiusura.** Tre larghezze con Playwright (768 px in modalità touch); `npm run lint`, `npm test`, `npm run build`; piano e decisioni.

**Criterio:** su tablet le icone si animano al tocco come sul telefono; con il mouse nessuna regressione.
**Commit proposto:** `fix(fe-ui): anima le icone al tocco sui dispositivi senza cursore`

---

# Fase D — Rilascio (23 ottobre)

### Card FE-12 · Rifinitura — stima 3 h

**Riferimenti:** brief §12 (strumenti e UI); decisione 78; skill impeccable; ReactBits.
**File:** `src/styles/*` e componenti delle schermate; `src/components/motion/*` (componenti ReactBits).

**Rischio di tempo (21 ottobre):** i sotto-task 3 e 4 si sommano alle 3 h della card, e il 23 ottobre non ha margine (vedi
"Calendario e stime"). Se il giorno sfora, il documento dei costi si scrive il 24 mattina o si riduce a una tabella con le voci e le cifre, e la
landing page si riduce a una sola schermata statica o si taglia (nell'ordine: prima la landing, poi il documento dei costi, da confermare con lo studente).

**Aggiunta del 20 ottobre (decisione 85):** scrivere i testi di **copyright** e **termini di servizio**, oggi link vuoti nel
footer (`Footer.tsx`), con lo studente; le due informative sono già vere. Sostituire anche i contatti segnaposto di
`src/config.ts` (`APPEAL_CONTACT`, `PRIVACY_CONTACT`) se la consegna è reale.

- [ ] **1. Revisione con impeccable (120 min; taglio n. 5).** Tutte le schermate: gerarchia, spaziature,
  stati di caricamento, vuoto ed errore, contrasto, focus da tastiera, tre larghezze. Solo stile e testi:
  nessun cambiamento di comportamento, test invariati e verdi.
- [ ] **2. ReactBits (60 min; taglio n. 1).** Due o tre componenti TypeScript + CSS, senza WebGL, scelti con
  lo studente; `prefers-reduced-motion` rispettato; controllo sotto CSP in anteprima e del peso del bundle.
  **Candidato fuori dal perimetro "senza WebGL":** MagicRings (sfondo animato in WebGL2, solo desktop). Il codice è
  salvato in locale in `docs/magic-rings.md` (non versionato), con le note per adattarlo. Si decide in FE-12 con la
  prova di peso, CSP e consumo, scelta per scelta con lo studente; se si sceglie, la decisione 78 si aggiorna allora.
- [ ] **3. Analisi dei costi operativi (documento a parte, `docs/analisi-costi.md`; stima da concordare).**
  Proiezione generica di quanto costerebbe tenere l'applicazione attiva nel tempo, **non solo con i piani gratuiti di
  oggi**: hosting (Render), database, email (Brevo), geocodifica (Nominatim), eventuale dominio, con più scenari di
  crescita degli utenti. Si scrive con lo studente a fine progetto; nessuna modifica al codice. Aggiunta dello
  studente il 21 ottobre.
- [ ] **4. Pagina di presentazione (landing page; stima da concordare).** Una home che spiega cos'è Resonance, i ruoli
  (fan, musicista, host), le funzioni (eventi vicini, collab, feed, chat) e porta ad accedere o registrarsi, come in altri
  siti. Solo frontend, contenuto statico. Da decidere con lo studente quando si arriva: dove sta (oggi `/` porta agli
  Eventi vicini: decisione 85 e test del router), che cosa vede chi ha già fatto l'accesso, il mock-up in Stitch e i testi.
  Aggiunta dello studente il 21 ottobre.

**Difetto da correggere (22 ottobre):** nelle pagine di accesso e registrazione, da 768 px, il footer non parte dal bordo
sinistro dello schermo: `.rs-footer` ha `left: 4.5rem` (da 1200 px `15rem`) per stare a destra della colonna di
navigazione, che quelle pagine non hanno. Si corregge nel sotto-task 1 (regola per le pagine senza colonna, con un test sul
CSS). Segnalato dallo studente durante FE-09a; scelta dello studente: rimandarlo a FE-12.

**Da decidere in FE-12 (22 ottobre):** la password richiesta di nuovo nella schermata del codice (`/verifica`) è ridondante
per lo studente. Il controllo sta nel backend (progettazione, sezione 4.5, passo 7: `WRONG_PASSWORD`), quindi non si toglie
solo dal frontend. Due strade, da scegliere con lo studente: (a) togliere il controllo dal backend (`VerifyRequest`, service,
test, Postman, progettazione e una decisione nuova; fuori dal "nessuna modifica al backend" del piano); (b) solo frontend: il
form di registrazione tiene la password in memoria e la invia da solo alla verifica, ma dopo un ricarico o un link aperto
altrove va riscritta. Richiesta dello studente durante FE-09a, rimandata a FE-12.

**Candidato se avanza tempo (21 ottobre):** titolo nei post del feed. Richiede una modifica al backend (colonna in
`feed_posts` con migrazione, DTO, Postman), fuori dal "nessuna modifica al backend" del piano: si decide con lo studente
solo a fine frontend, con il calendario davanti. Le altre funzioni emerse (suggerimento degli indirizzi, elenco di generi
a chip, carosello degli eventi, filtri della bacheca, candidature con accettazione) sono in `progettazione.md`, sezione 15.

**Commit proposto:** `style(fe-ui): rifinisce l'interfaccia e aggiunge componenti animati`

### Card FE-11 · Deploy integrato, CSP e prova della demo — stima 4 h

**Riferimenti:** decisioni 1, 74, 76; §12.5–12.7, §14 (demo finale); README.
**File:** `config/SecurityConfig`; test della CSP (nuovo, in `config`); `docs/decisioni.md` (76, esito della
CSP), `docs/progettazione.md` (§8); `README.md`; `docs/riuso-nosey.md`.

- [ ] **1. CSP nel backend (60 min).** Header `Content-Security-Policy` della decisione 76 su tutte le
  risposte con gli header di Spring Security. Test MockMvc: header presente su `/`, `/api/health` e
  `/swagger-ui/index.html`. Prova in locale nel browser: frontend compilato e Swagger UI senza violazioni.
  `./mvnw -q verify`.
  **Da valutare nello stesso intervento (trovato su Render il 20 ottobre, dopo FE-03b):** le richieste `HEAD` su
  pagine e asset danno 401, mentre `GET` dà 200, perché `SecurityConfig.isStaticFileRequest` ammette solo `GET`.
  Non cambia nulla per i browser; può dare problemi a controlli di uptime e anteprime dei link. Se si corregge,
  ammettere anche `HEAD` per i file statici e la SPA (non per `/api` e `/ws`), con un test MockMvc.
  **Da guardare nel log di Render (20 ottobre, ore 13:15 italiane):** messaggio INFO di Spring `More than one
  TaskExecutor bean found within the context, and none is named 'taskExecutor'` (`AnnotationAsyncExecutionInterceptor`,
  con `clientInboundChannelExecutor`, `clientOutboundChannelExecutor`, `brokerChannelExecutor` e
  `messageBrokerTaskScheduler`). Non è un errore: per gli `@Async` (invio delle email) Spring non sa quale esecutore
  usare. Verificare quale esecutore usano davvero gli `@Async` e, se serve, dichiararne uno con il nome `taskExecutor`.
- [ ] **2. Build e deploy (50 min).** `docker build` dalla radice; promemoria merge `develop → main`; su
  Render log, `/api/health`, apertura dell'app, login, sessione ripresa dopo il ricaricamento, chat fra due
  account, nessuna violazione CSP nella console, Swagger UI.
- [ ] **3. Account e prova della demo (70 min).** SUPERADMIN dalle variabili, due utenti registrati
  dall'interfaccia e resi amici; eventi, post e annunci di prova; prova completa della sequenza di §14 con
  il livello di raggio adatto agli eventi di prova; problemi annotati e corretti se piccoli, altrimenti
  segnalati.
- [ ] **4. README e chiusura (60 min).** README: frontend (avvio, script, variabili), limiti noti (richieste
  di amicizia non live, link solo con conferma), checklist della demo aggiornata; `riuso-nosey.md`
  completato; decisione 76 con l'esito della CSP.

**Criterio:** fase D chiusa; deploy finale verificato; demo provata per intero.
**Commit proposto:** `feat(web): aggiunge la content security policy e completa il rilascio integrato`

---

## Allineamento all'approvazione del piano

Da fare insieme alla scrittura di questo file nel repository (sessione di pianificazione del 18–19
ottobre), prima di F7-04:

- `docs/decisioni.md`: decisione 77 (elenchi `/mine` nell'MVP, regole di F7-04; l'esito lo aggiunge la
  card), 78 (scelte del piano del frontend: librerie, riuso, test, responsive, strumenti, fasi, tagli,
  raggio, icone, campanella non live), 79 (testo degli utenti senza DOMPurify).
- `docs/progettazione.md`: §8.6 (decisione 79); §14 (card FE con FE-09a, FE-09b, FE-12, calendario dal 18
  al 24, tagli del frontend, F7-04); §15 Post-V1 (partecipazione agli eventi; testo ricco con DOMPurify).
- Piano del backend: card F7-04 nella fase F7 (titolo "Valutazione, rinforzo e integrazioni"); la sezione
  "Card FE" rimanda a questo piano.
- Trello: FE-09 rinominata "FE-09a · Amicizie e ricerca utenti"; card nuove "FE-09b · Chat, notifiche e
  contatto" e "FE-12 · Rifinitura" in "FE in attesa", "F7-04 · Elenchi dei contenuti dell'utente" in
  "Fase 7". Sulle card esistenti si aggiornano le voci della checklist "Sotto-task" già presente (letta con
  `trelloReadChecklist`); solo sulle tre card nuove la checklist "Sotto-task" si crea (eccezione approvata).

**Commit proposto della pianificazione:** `docs(planning): aggiunge il piano del frontend e la card F7-04`
