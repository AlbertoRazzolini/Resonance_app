# Valutazione dell'ottimizzazione del frontend

Esito della card FE-25 (decisioni 71, 75 e 116): quali parti del frontend si possono alleggerire o riorganizzare senza
cambiarne il comportamento. È solo analisi: nessun file di codice è stato modificato. Il metodo è quello della
valutazione del backend (`docs/ottimizzazione.md`).

Una proposta è ammessa solo se valgono tutti e tre i criteri:

1. non cambia il comportamento osservabile;
2. è coperta da test già esistenti (o dal controllo dei tipi della build);
3. ha un beneficio concreto: meno duplicazione o complessità, oppure un punto lento misurato.

Restano fuori il codice di sessione e di accesso (refresh, CSP, connessione STOMP), lo stile e il design già approvati
(FE-12, FE-22, FE-23) e le funzioni nuove.

## Metodo

- **Revisione in due passi.** Prima una lettura di `Resonance_FE/src` (217 file di codice, circa 20.700 righe, più 147 file
  di test) fatta senza leggere decisioni e piano: mappa dei file più grandi, esportazioni mai usate, file non importati,
  blocchi di righe duplicate (finestre di 7 righe uguali, esclusi i componenti copiati da librerie), classi e selettori
  CSS, dipendenze. Poi ogni segnalazione è passata per i tre criteri e per le decisioni.
- **Misure.** Build di produzione di Vite (`npm run build`, e una build con le mappe dei sorgenti in una cartella
  temporanea) e Chrome pilotato con Playwright su `vite preview`, senza limitare la rete: richieste, byte trasferiti
  (compressi), caricamento, parte più grande visibile (LCP) e copertura di JavaScript e CSS. Pagine misurate: landing,
  accesso ed eventi, cioè quelle visibili senza sessione. Nessun database né Render coinvolti.

## Misure

| Pagina | Richieste | Trasferiti | Caricamento | LCP | JavaScript usato | CSS usato |
|---|---|---|---|---|---|---|
| Landing | 22 | 362 kB | 666 ms | 320 ms | 35% | 9% |
| Accesso | 27 | 379 kB | 625 ms | 132 ms | 30% | 6% |
| Eventi (con mappa) | 44 | 700 kB | 1,2 s | 196 ms | 38% | 9% |

- **Primo caricamento:** circa 695 kB di JavaScript (232 kB compressi) in nove file, 282 kB di CSS (40 kB compressi) e tre o
  quattro pesi di Barlow Condensed (circa 21 kB ciascuno, scaricati solo se usati).
- **Pacchetto principale (`index`, 489 kB, 157 kB compressi).** Sorgenti prima della minificazione: `react-dom` 612 kB,
  `motion-dom` 430 kB e `framer-motion` 70 kB (animazioni), `react-router` 129 kB (più 236 kB nel pacchetto `routes`),
  `@stomp/stompjs` 68 kB, `@popperjs/core` 64 kB, il codice proprio circa 130 kB.
- **Già in differita:** tutte le 28 rotte con una pagina (`lazy` del router); la mappa (`Map`, 1,09 MB, 295 kB compressi, più il worker
  da 506 kB e 71 kB di CSS) si scarica solo con la pagina Eventi; il selettore delle emoji e il suo file di dati (477 kB)
  solo all'apertura (decisione 92).
- **CSS:** il foglio unico di 282 kB contiene Bootstrap intero e circa 3.300 righe proprie; per pagina se ne usa il 6-9%,
  ma si scarica una volta e resta in cache. Le 301 classi `rs-*` definite sono tutte nominate nel codice.
- **Duplicazioni:** solo due coppie di file con due piccoli blocchi uguali ciascuna (`NearbyEventsPage` e `FeedPage`;
  `FriendsPage` e `AreaTabs`).
- **Codice inutilizzato:** un solo simbolo esportato e mai usato, il tipo `MessagesArgs` in `types/chat.ts`. Un file
  segnalato dal controllo (`components/map/index.ts`) è in realtà usato, con l'importazione `@/components/map`.

## Risultato in breve

- Nessun punto lento: le pagine si caricano in meno di 1,3 s in locale e la parte più grande si vede entro 320 ms.
- Una sola proposta ammessa, di beneficio minimo (O1).
- Il resto è già come lo vorrebbe una revisione: pagine in differita, dati pesanti caricati al bisogno, quasi nessuna
  duplicazione, CSS senza classi morte.

## Proposta ammessa

**O1. Togliere il tipo `MessagesArgs`** (`types/chat.ts`, 4 righe con il commento): dichiarato ed esportato ma non
importato da nessuno, nemmeno dai test. Non cambia il comportamento e la build (`tsc -b`) lo verifica; il beneficio è una
dichiarazione morta in meno. **Non è stata realizzata**: la decisione 116 la lascia in sospeso.

## Proposte scartate

- **`LazyMotion` per alleggerire `motion`.** Il pacchetto principale contiene circa 500 kB di sorgenti di animazione, ma le
  icone di `@animate-ui` (nove file in `components/animate-ui/icons` e `IconWrapper` della libreria) importano comunque
  `motion/react` dentro il pacchetto: con `LazyMotion` il risparmio non ci sarebbe senza modificare la libreria.
- **Caricare `@stomp/stompjs` solo dopo il login** (68 kB di sorgenti, circa 20 kB compressi che un visitatore anonimo non
  usa). È codice di sessione e di connessione live, quindi fuori ambito (criterio di sicurezza e accesso), e il
  guadagno è piccolo.
- **Dividere o ridurre Bootstrap** (da 282 kB a un CSS per pagina o a un'importazione parziale): serve un refactor degli
  stili e di Sass, con il rischio di cambiare l'aspetto, per qualche kB compresso risparmiato una volta sola.
- **Unire i cinque selettori CSS scritti due volte** (`.rs-bell`, `.rs-side-item`, `.rs-event-card__bottom`,
  `.rs-composer`, `.rs-map .maplibregl-ctrl-attrib`): sono override voluti in punti diversi del foglio; unirli cambia
  l'ordine della cascata e il CSS non ha test (jsdom non calcola gli stili).
- **Togliere un peso del carattere** (400, 500, 600 o 700): i file si scaricano solo se la pagina usa quel peso, quindi
  non cambia niente per l'utente.
- **Dividere o ridurre il pacchetto della mappa** (MapLibre, 1,09 MB): è già in differita e non si può alleggerire senza
  cambiare libreria.
- **Unire i blocchi duplicati** di `NearbyEventsPage`/`FeedPage` e `FriendsPage`/`AreaTabs`: sono due finestre da 7 righe,
  una forma comune a due pagine; estrarle aggiunge indirezione senza togliere complessità.

## Non misurato

- Le pagine con sessione (feed, chat, moderazione, profilo): richiedono un utente e dati; il loro codice è comunque in
  pacchetti in differita di pochi kB.
- Rete lenta o telefono: le misure sono in locale e senza limitazione della velocità.
- Render: nessuna misura sul sito pubblico.

## Conclusione

Il frontend non ha bisogno di una card di realizzazione. L'unica proposta ammessa (O1) si può fare in due minuti se lo
studente la vuole, ma non cambia niente per l'utente.
