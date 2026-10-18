# Valutazione dell'ottimizzazione del backend

Esito della card F7-01 (decisione 71; progettazione, sezione 14): quali parti del backend si possono alleggerire o
riorganizzare senza cambiarne il comportamento. È solo analisi: nessun file di codice è stato modificato.

Una proposta è ammessa solo se valgono tutti e tre i criteri:

1. non cambia il comportamento osservabile (stesse risposte, stessi codici d'errore, stesso ordine dei controlli);
2. è coperta da test già esistenti;
3. ha un beneficio concreto: meno duplicazione o complessità, oppure un punto lento misurato.

Restano fuori il codice solido anche se più pesante, in particolare concorrenza e sicurezza (refresh token, like
concorrenti, ordine dei controlli STOMP), e la logica fissata nelle decisioni.

## Metodo

- **Revisione in due passi.** Prima una lettura completa di `src/main` (205 file, circa 10.200 righe), delle
  migrazioni V1–V9 e degli `application*.yml`, fatta senza leggere decisioni, progettazione e test, per non
  partire dalle motivazioni già scritte: 30 segnalazioni fra duplicazioni, classi con troppe responsabilità,
  codice inutile e possibili punti lenti. Poi ogni segnalazione è passata per i tre criteri e per le decisioni.
- **Misure.** Le query sospette sono state misurate con `EXPLAIN (ANALYZE, BUFFERS)`, a cache calda, su un database
  separato (`resonance_bench`) creato nel container di sviluppo con le migrazioni V1–V9 e poi eliminato. Database di
  sviluppo e di test non sono stati toccati. Volumi sintetici, circa cento volte quelli della demo:
  - 100.000 utenti verificati e attivi;
  - 200.000 concerti in una zona di circa 110 × 80 km, il 90% già passati;
  - 300.000 post del feed, il 60% con coordinate;
  - 303.000 amicizie, di cui 3.000 di un solo utente;
  - 300.000 messaggi: un utente con 50 conversazioni da 2.000 messaggi (il 10% non letti), più 2.000
    conversazioni da 100 messaggi.

## Risultato in breve

- Cinque proposte ammesse, tutte piccole: una sola porta un guadagno di velocità misurato (O1), le altre tolgono
  duplicazioni o codice usato solo dai test. Insieme valgono circa un'ora e mezza di lavoro più la verifica.
- Nessuna query N+1 e nessuna paginazione in memoria. Le altre query sospette restano sotto i 25 ms anche con i volumi
  sintetici.
- Le duplicazioni più vistose sono già state scelte e motivate nelle decisioni (moderazione, concerti e indie event
  separati) oppure riguardano codice di sicurezza.

## Proposte ammesse

### O1. Ultimo messaggio della lista delle chat con `LATERAL`

- **File:** `chat/ChatMessageRepository.java` (`findLastOfEach`).
- **Oggi:** `select distinct on (conversation_id) * ... where conversation_id in (...)` legge tutti i messaggi delle
  conversazioni della pagina e li ordina per tenerne uno per conversazione. Il costo cresce con la lunghezza delle chat.
- **Proposta:** per ogni conversazione si legge solo il messaggio più recente, con l'indice `ix_chat_messages_cursor`:

  ```sql
  select m.* from chat_conversations c
  cross join lateral (
      select * from chat_messages x
      where x.conversation_id = c.id
      order by x.sent_at desc, x.id desc
      limit 1) m
  where c.id in (:conversationIds)
  ```

- **Beneficio misurato:** con 20 conversazioni da 2.000 messaggi si passa da 27 ms (40.000 righe lette, ordinamento
  su disco) a 0,08 ms (20 righe). Con i volumi della demo la differenza non si nota: conta solo se le chat crescono.
- **Stesso risultato:** le due query restituiscono gli stessi messaggi su tutte le 2.050 conversazioni del database
  di prova; una conversazione senza messaggi non ha riga in nessuna delle due.
- **Rischio:** basso. Cambia una sola query nativa; mappatura e ordine dei campi restano quelli dell'entity.
- **Test:** `ChatRestIntegrationTest.list_ordersByLastActivityWithLastMessageAndUnreadCount` (più conversazioni,
  ultimo messaggio e conversazione senza messaggi).
- **Effort:** 15 minuti.

### O2. Ricerca nelle vicinanze: una sola riga di risultato e una sola formula

- **File:** `event/OfficialConcertRepository.java`, `event/IndieEventRepository.java`, `feed/FeedPostRepository.java`,
  `event/IndieEventService.java`, `event/OfficialConcertService.java`, `feed/FeedService.java` (importano
  `geo.NearbyRow` al posto del tipo definito in ogni repository), nuovo tipo in `geo`.
- **Oggi:** l'interfaccia `NearbyRow { getId(); getDistanceKm(); }` è identica nei tre repository. La formula
  `DISTANCE_KM` è condivisa fra concerti e indie event (decisione 57), ma `FeedPostRepository` ne ha una copia che
  cambia solo l'alias della tabella (`p` invece di `c`).
- **Proposta:** un solo `geo.NearbyRow` e una sola costante della formula, con un alias neutro usato da tutte e tre le
  query. La formula deve restare una costante: il testo di una `@Query` deve essere noto alla compilazione, quindi
  non si può costruire con un metodo che riceve l'alias.
- **Beneficio:** circa 20 righe in meno e una sola formula da tenere corretta.
- **Rischio:** basso; il testo SQL generato resta lo stesso, cambia solo l'alias del feed.
- **Test:** `NearbySqlTest` (fra cui `nearby_sqlDistanceMatchesHaversine` e `nearby_paginates_andCountsAllMatches`),
  i test `nearby_*` di `IndieEventIntegrationTest`, i test `list_withRadius_*` di `FeedIntegrationTest` (fra cui
  `list_withRadius_sqlDistanceMatchesHaversine`).
- **Effort:** 30 minuti.
- **Non compreso:** il metodo generico che comporrebbe anche la pagina nei tre service (vedi "Cosa non si tocca").

### O3. Parte finale comune di candidatura e contatto

- **File:** `chat/ChatService.java`, `collab/CollabService.java` (`apply`), `event/EventContactService.java`
  (`contact`).
- **Oggi:** dopo i controlli, i due metodi ripetono la stessa sequenza: `findOrCreateConversation`, `unlock`,
  `appendMessage` con il prefisso e il titolo, `ChatMessageEvent` a entrambi.
- **Proposta:** un metodo di `ChatService` che fa questa sequenza e restituisce il messaggio salvato. Controlli,
  limite di frequenza e notifica restano nei due chiamanti (la candidatura invia `COLLAB_APPLICATION`, il contatto
  `NEW_MESSAGE`), quindi l'ordine dei controlli non cambia.
- **Beneficio:** circa 10 righe in meno; la regola "chi aggiunge un messaggio pubblica `ChatMessageEvent` nella stessa
  transazione" (decisione 66) sta in un punto solo invece che in ogni chiamante.
- **Rischio:** basso-medio: tocca l'ordine di pubblicazione degli eventi dentro la transazione, che i test verificano.
- **Test:** i 15 test di `CollabApplicationIntegrationTest` e i 19 di `EventContactIntegrationTest`, fra cui
  `apply_deliversMessageToBoth_andOnlyCollabApplicationToTheAuthor`,
  `contact_deliversMessageToBoth_andNewMessageOnlyToTheOrganizer` e i due
  `rejected*_doNotConsumeTheLimit`.
- **Effort:** 30 minuti, più l'aggiornamento delle decisioni 66 e 69 e della riga di `ChatService` nelle "Interfacce
  condivise" del piano.
- **Non compreso:** unire i DTO `ApplicationResponse`/`ContactResponse` e `ApplyRequest`/`ContactRequest`, che sono
  identici: cambierebbe lo schema OpenAPI pubblicato.

### O4. `User.clearSuspension()`

- **File:** `user/User.java`, `admin/AdminUserService.java` (riattivazione manuale), `auth/SuperadminBootstrap.java`
  (`promote`).
- **Oggi:** stato `ACTIVE` e i quattro campi della sospensione azzerati con cinque setter, copiati nelle due classi.
- **Proposta:** un metodo dell'entity che riporta l'utente ad `ACTIVE` e azzera i campi insieme, come chiede il
  vincolo `ck_users_suspension`. La riattivazione pigra (decisione 26) resta un `UPDATE` condizionale e non cambia.
- **Beneficio:** circa 8 righe in meno; il vincolo sui campi della sospensione si rispetta in un punto solo.
- **Rischio:** minimo.
- **Test:** `SuspensionIntegrationTest.reactivate_manually_allowsLoginAgain` e
  `reactivate_isIdempotent_onAnActiveUser`; `SuperadminBootstrapTest.run_withASuspendedExistingUser_reactivatesItAndClearsTheSuspension`.
- **Effort:** 10 minuti.

### O5. `geo.Haversine` fra le classi di test

- **File:** `geo/Haversine.java` spostato in `src/test/java/it/epicode/resonance/geo/`; `geo/package-info.java`.
- **Oggi:** nessuna classe di produzione usa `Haversine`: la distanza si calcola in SQL (decisione 32) e la classe
  serve solo ai test, come riferimento per verificare la formula SQL.
- **Proposta:** spostarla fra le classi di test, nello stesso package, e aggiornare la riga di `package-info.java`.
  I Javadoc dei repository che la citano restano validi.
- **Beneficio:** nel codice di produzione non resta codice usato solo dai test.
- **Rischio:** nessuno.
- **Test:** `HaversineTest`, `NearbySqlTest.nearby_sqlDistanceMatchesHaversine`,
  `FeedIntegrationTest.list_withRadius_sqlDistanceMatchesHaversine`, `IndieEventIntegrationTest`.
- **Effort:** 10 minuti, più la struttura dei file nel piano.

## Misure

| Query | Dati | Tempo | Esito |
|---|---|---|---|
| Ultimo messaggio di 20 conversazioni (`findLastOfEach`) | 40.000 messaggi nelle conversazioni | 27 ms; con `LATERAL` 0,08 ms | proposta O1 |
| Non letti di 20 conversazioni (`countUnread`) | come sopra | 3 ms | invariata |
| Segna come letti una conversazione (`markReadFor`) | 2.000 messaggi | 1,7 ms | invariata |
| Concerti vicini, raggio 25 km (`findNearby` + `countNearby`) | 200.000 concerti, 90% passati | 5 ms + 4 ms | invariata |
| Feed con raggio 200 km (`findNearby` + `countNearby`) | 300.000 post | 0,03 ms + 17 ms | invariata |
| Conteggio della lista del feed | 300.000 post | 10 ms | invariata |
| Amicizia fra due utenti (`existsBetween`) | 303.000 amicizie | 0,03 ms; con `LEAST`/`GREATEST` 0,02 ms | invariata |
| Ricerca utenti per nome (pagina + conteggio) | 100.000 utenti | 25 ms + 21 ms | invariata (decisione 68) |

Non misurati: il numero di query per invio di un messaggio STOMP e per login e refresh (percorsi esclusi per
sicurezza), le liste dell'area admin (traffico minimo).

## Cosa non si tocca e perché

**Escluso da una decisione già presa**

- Interfaccia o superclasse comune per i quattro contenuti moderabili: scartata nella decisione 62, che tiene le entity
  indipendenti e la regola di moderazione in uno `switch`.
- Un'entità unica, o una superclasse, per concerti e indie event: decisioni 18 e 57.
- Un solo "utente attivo adesso?" per chat, amicizie e ricerca: le regole sono diverse di proposito. La chat considera
  attiva una sospensione scaduta (decisione 66), mentre amicizie e ricerca guardano lo stato salvato, aggiornato dalla
  riattivazione pigra (decisioni 63 e 64). Unirle cambierebbe il comportamento.
- Indice `pg_trgm` per la ricerca utenti e paginazione a cursore del feed: rimandati dalla decisione 68. Il cursore
  toglierebbe anche `totalElements` e `totalPages` da `PageResponse`.
- `UnmappedApiRequestMatcher`, che ripete la ricerca dell'handler a ogni richiesta `/api`: decisione 46.
- `FriendshipSummary`, uguale a `FriendshipRelation`: è il DTO della risposta (decisione 64), separato dal tipo interno.
- `UserSearchController` e `UserSearchService` nel package `friendship`: struttura dei file del piano.

**Sicurezza o concorrenza, fuori perimetro**

- Controllo del token ripetuto in `JwtChannelInterceptor` e `ChatService` e controlli dell'invio STOMP (compresa la
  rilettura degli utenti a ogni invio): ordine dei controlli STOMP e decisione 66.
- Verifica dell'origine e del CSRF in `AuthController`, flussi di login, refresh e reset in `AuthService` e
  `RefreshTokenService` (anche la mappa dei dettagli di sospensione costruita in entrambi).
- Preambolo delle operazioni admin (lock dell'utente, ruoli, regola dei livelli).
- Normalizzazione dell'email nei DTO di autenticazione (Review Focus 1 del piano).

**Misurato e trascurabile**

- Ricerca nelle vicinanze di concerti, indie event e feed, conteggio della lista del feed, controllo di amicizia con la
  coppia canonica, non letti e lettura della chat: i tempi sono nella tabella delle misure.

**Beneficio troppo basso o comportamento che cambierebbe**

- Metodo generico per comporre la pagina della ricerca nelle vicinanze nei tre service: più complesso delle righe che
  toglie.
- Caricamento "utente o 404" ripetuto 7 volte: il ramo 404 non è raggiungibile (l'utente è quello autenticato o è già
  stato controllato) e nessun test lo copre; il beneficio è di circa 7 righe.
- DTO di candidatura e contatto uniti: cambierebbe lo schema OpenAPI.
- Divisione di `ChatService` in più classi: tocca il percorso dell'invio STOMP.
- `EventInputNormalizer` spostato in `common`, client HTTP comune per Brevo e Nominatim, `HtmlEmailService` fusa in
  `BrevoEmailService`, `AsyncConfig` e `SchedulingConfig` unite: solo spostamenti, senza un beneficio concreto.
- Membri usati solo dai test o richiesti dalle regole delle entity: `ModeratedContentType.path()` (lo usano i test della
  moderazione), costruttori di `ChatConversation` e `ChatUnlock` (decisione 41), `IssuedRefreshToken.expiresAt`
  (refresh token).
- Indici per gli elenchi dell'area admin: traffico minimo.

## Note emerse dall'analisi

- **Nessuna query N+1:** ogni pagina carica autori, ruoli, like e relazioni di amicizia con query a lotti o con
  `@EntityGraph`, e `open-in-view` è disattivato.

## Decisione

Lo studente ha scelto di realizzare tutte e cinque le proposte nella card F7-02, il 19 ottobre, con O3 per ultima e
prima da tagliare se il tempo stringe (decisione 75). Il comportamento si confronta prima e dopo con la collection
Postman in locale, e su O1 e O3 una prova di copertura verifica che i test indicati falliscano se la nuova versione
è sbagliata.

## Esito della realizzazione (F7-02)

Realizzate tutte e cinque le proposte, senza ritirarne nessuna e senza test nuovi o modificati; i test indicati per
ogni proposta sono passati prima e dopo.

- **O1:** `findLastOfEach` usa `LATERAL`. Prova di copertura: con l'ordine invertito (primo messaggio invece
  dell'ultimo) fallisce `ChatRestIntegrationTest.list_ordersByLastActivityWithLastMessageAndUnreadCount`.
- **O2:** un solo `geo.NearbyRow`, con la costante `DISTANCE_KM` (alias `e`), usata dalle query di concerti, indie
  event e feed.
- **O3:** `ChatService.sendUnlockedMessage` raccoglie la parte finale di candidatura e contatto; decisioni 66 e 69 e
  «Interfacce condivise» del piano aggiornate. Prova di copertura: senza `ChatMessageEvent` nel nuovo metodo
  falliscono `CollabApplicationIntegrationTest.apply_deliversMessageToBoth_andOnlyCollabApplicationToTheAuthor` e
  `EventContactIntegrationTest.contact_deliversMessageToBoth_andNewMessageOnlyToTheOrganizer`.
- **O4:** `User.clearSuspension()`, usato da `AdminUserService` (riattivazione manuale) e `SuperadminBootstrap.promote`.
- **O5:** `Haversine` spostata in `src/test` (stesso package); `geo/package-info.java` e struttura dei file del piano
  aggiornati.

### Verifica su Render

Dopo il merge `develop → main`, il deploy automatico del commit `01eb48c` è riuscito (circa 4 minuti) e
`GET /api/health` risponde `{"status":"UP","database":"UP"}`.

Prova con l'environment `render` di Postman: 26 richieste della collection che non richiedono credenziali e non
scrivono dati (`scripts/postman-render-subset.sh`).

- Stato di tutte e 26 le richieste: quello atteso, nessuna fallita.
- Asserzioni: 26, di cui 5 fallite. Sono le stesse 5 della prova locale a database vuoto e della prova del 17 ottobre
  (F6-03): concerti vicini, indie event vicini, annunci, post e post con coordinate controllano un contenuto che il
  database di produzione, ancora vuoto, non ha. Non sono regressioni.
- Prima e dopo il deploy gli esiti sono identici (la prima prova girava sul codice precedente).
- Non è stato creato nessun utente né scritto nessun dato sul database di produzione, quindi non c'è nulla da
  cancellare.

Non coperto su Render: le query di O1 e O2 e il messaggio di O3 richiedono il login, quindi sono provati dai test e
dalla collection completa in locale (143 richieste, esiti identici prima e dopo). La prova completa con utenti e dati
veri è rimandata a dopo il frontend.
