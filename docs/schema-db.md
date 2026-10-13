# Resonance - Schema del database

Schema PostgreSQL **effettivamente applicato** dalle migrazioni Flyway in
`Resonance_BE/src/main/resources/db/migration/`. Il modello di riferimento approvato è in
`docs/progettazione.md`, sezione 3; questo documento descrive solo ciò che le migrazioni hanno già
creato e si aggiorna a ogni migrazione che modifica lo schema, nello stesso sotto-task.

## Stato

| Migrazione | Card | Stato |
|---|---|---|
| — | — | Nessuna migrazione applicata (F0 non ancora iniziata). |

Migrazioni previste (progettazione, sezione 3.6): `V1__users_and_roles` (F0-02),
`V2__refresh_tokens` (F1-02), `V3__email_codes` (F1-03), `V4__official_concerts` (F3-02),
`V5__indie_events` (F3-03), `V6__collab_posts` (F4-01), `V7__feed_and_likes` (F4-02),
`V8__chat` (F5-02).

## Convenzioni

- Chiavi primarie ed esterne `uuid`, `DEFAULT gen_random_uuid()`; Hibernate usa `GenerationType.UUID`.
- Timestamp `timestamptz` in UTC.
- Nomi dei vincoli espliciti: `pk_`, `uq_`, `fk_`, `ck_`, `ix_` + tabella + colonne.
- Enum PostgreSQL con valori in maiuscolo, mappati su enum Java.
- Contenuti moderabili con `hidden_at`, `hidden_by`, `hidden_reason`.
- Nessuna credenziale nelle migrazioni; nessuna modifica a migrazioni già applicate.

## Enum

_Nessuno ancora._

## Tabelle

_Nessuna ancora._

## Relazioni (diagramma ER)

_Il diagramma Mermaid viene aggiunto con la prima migrazione (V1)._
