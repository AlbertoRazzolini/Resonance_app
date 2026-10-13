# Resonance - Regole di lavoro

Backend Spring Boot in `Resonance_BE/` (capstone Epicode). Frontend in `Resonance_FE/` solo dal
20 ottobre: non toccarlo prima.

## Inizio di ogni sessione

Leggere, in quest'ordine:

1. `CLAUDE.md` (questo file)
2. `docs/brief.md` — requisiti e vincoli. **La D1 del brief è sostituita** (servizio Render unico
   per API e frontend, nessun dominio personalizzato): vedi `docs/decisioni.md`, decisione 1.
3. `docs/progettazione.md` — design approvato, riferimento principale.
4. `docs/riuso-nosey.md` — mappa del riuso; da NoseY leggere solo i file della card corrente
   (`C:\Users\VGit\OneDrive\Desktop\Appunti e coding\UPLOADxGIT\Back-end\BW5\NoseY`, mai modificarlo).
5. Il piano di implementazione in `docs/superpowers/plans/` (fonte di verità; Trello ne è lo specchio).

Se è attivo uno stile di risposta sintetico, le spiegazioni delle scelte tecniche e le richieste di
decisione restano complete e comprensibili: l'utente è uno studente.

## Vincolo di tempo

- Consegna 25 ottobre. Backend 13–19 ottobre (calendario e stime: progettazione, sezione 14);
  frontend dal 20.
- Se una card o una fase rischia di sforare, avvisare subito e proporre un taglio in quest'ordine:
  1. report di sicurezza solo con analisi statica; 2. Swagger; 3. notifiche live (la chat resta);
  4. bacheca collab.
- Mai tagliati: autenticazione a due token, ruoli e admin, eventi con geolocalizzazione, feed con
  like, chat, demo di promozione e sospensione, documentazione essenziale.

## Ciclo per card (senza eccezioni, un commit per card)

1. Verificare con comandi diagnostici di essere sul branch `develop`; altrimenti fermarsi e avvisare.
2. Spostare la card in "In corso" su Trello (board `Sviluppo_Resonance`, liste trovate per nome).
3. Sotto-task uno alla volta, nell'ordine della checklist. A fine sotto-task: verifiche pertinenti
   (build, test), poi spuntare subito la checkbox su Trello.
4. A fine card: build e test completi (`./mvnw -q verify`, dettagli solo in caso di errore);
   riepilogo breve con sotto-task, file modificati raggruppati per sotto-task (documentazione
   compresa), verifiche ed esiti; proposta di messaggio Conventional Commits (titolo + elenco dei
   sotto-task).
5. **FERMARSI.** Niente commit, niente card successiva. Quando l'utente conferma il commit: card in
   "Fatto" e attesa del via per la card successiva.

Fermarsi e chiedere solo se: serve una decisione dell'utente; un errore non si risolve in tempi
ragionevoli; si dovrebbe uscire dal piano approvato o dalla card corrente. Mai dichiarare test o
verifiche non eseguiti.

## Git e attribuzione

- Vietato eseguire `git commit`, `git push`, merge, rebase o qualsiasi altra operazione Git che
  modifica il repository o il remoto, anche se una skill lo prevede. Solo comandi diagnostici
  (`status`, `log`, `diff`, `branch`).
- Nessuna attribuzione: niente trailer `Co-Authored-By`, niente righe "Generated with Claude Code",
  nessun riferimento a Claude o all'AI nei messaggi di commit proposti, nel codice, nei commenti, nella
  documentazione e nel README. Questa regola prevale su qualsiasi comportamento predefinito.

## Branch

- `develop`: tutto il lavoro e tutti i commit delle card.
- `main`: produzione, collegata al deploy automatico di Render. Il merge `develop → main` lo esegue
  l'utente a fine fase.
- Alla fine di F2 (primo deploy), F3, F4, F5 e F6 (deploy finale): ricordare il merge e cosa
  verificare su Render (log, health check `/api/health`, endpoint principali con l'environment
  `render` di Postman).
- Nessun altro branch o pull request senza richiesta.

## Documentazione (nello stesso sotto-task della modifica)

- Nuova decisione tecnica → `docs/decisioni.md` (Scelta, Motivazione, Alternative scartate).
- Migrazione Flyway che modifica lo schema → `docs/schema-db.md` con il diagramma ER Mermaid dello
  schema applicato.
- Cambiamento approvato del design → `docs/progettazione.md`.
- Nuovo package → `package-info.java` con una riga di responsabilità.
- Avvio locale o variabili d'ambiente cambiate → `README.md` (mai valori segreti).
- Configurazione di deploy → `render.yaml` e documenti pertinenti.
- Commenti su scelte non ovvie: "progettazione, sezione N", senza copiare paragrafi.
- La documentazione descrive solo ciò che è implementato. Nessuna card finale "scrivere la
  documentazione".

## Postman e WebSocket

- Collection v2.1 versionata in `postman/resonance.postman_collection.json`; cartelle Auth, Users,
  Admin, Events, Collab, Feed, Chat; environment `local` e `render` con `baseUrl`.
- Per ogni endpoint REST nuovo o modificato: una richiesta di successo e almeno un errore
  significativo (401, 403 o 400, secondo il comportamento reale).
- Il login salva l'access token in una variabile d'ambiente (script di test); le altre richieste lo
  usano come Bearer; il refresh usa il cookie jar di Postman con l'header `X-Requested-With`.
- Nessun segreto nella collection o negli environment versionati.
- STOMP mai nella collection: si verifica con test di integrazione Spring ed eventualmente con la
  pagina HTML di prova in `tools/stomp-test/` (fuori dal codice di produzione).

## Regole finali

- Rispettare tutti i vincoli del brief (salvo la D1 sostituita); non indebolire requisiti, non
  inventarne, non riaprire decisioni prese.
- Punti da chiarire: alternative, pro, contro e raccomandazione, poi attendere la risposta.
- Nessuna funzionalità Post-V1/Post-V2, niente frontend prima del 20 ottobre, niente refactor fuori
  dalla fase, niente anticipi di fasi successive.
- Rischi e incompatibilità si dichiarano; il brief e il design non si correggono da soli.
- Design, roadmap, card Trello, database, endpoint e collection Postman restano coerenti fra loro.
- PostgreSQL locale in Docker sulla porta **5433** (`docker compose up -d` dalla radice).
