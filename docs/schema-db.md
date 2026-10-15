# Resonance - Schema del database

Schema PostgreSQL **effettivamente applicato** dalle migrazioni Flyway in
`Resonance_BE/src/main/resources/db/migration/`. Il modello di riferimento approvato è in
`docs/progettazione.md`, sezione 3; questo documento descrive solo ciò che le migrazioni hanno già
creato e si aggiorna a ogni migrazione che modifica lo schema, nello stesso sotto-task.

## Stato

| Migrazione | Card | Contenuto | Stato |
|---|---|---|---|
| `V1__users_and_roles` | F0-02 | enum `user_role`, `user_status`; tabelle `users`, `user_roles` | Applicata |
| `V2__refresh_tokens` | F1-02 | tabella `refresh_tokens` | Applicata |
| `V3__email_codes` | F1-03 | enum `email_code_purpose`; tabella `email_codes` | Applicata |

Migrazioni ancora da fare (progettazione, sezione 3.6): `V4__official_concerts` (F3-02), `V5__indie_events` (F3-03),
`V6__collab_posts` (F4-01), `V7__feed_and_likes` (F4-02), `V8__chat` (F5-02).

## Convenzioni

- Chiavi primarie ed esterne `uuid`, `DEFAULT gen_random_uuid()`; Hibernate usa `GenerationType.UUID`.
- Timestamp `timestamptz` in UTC.
- Nomi dei vincoli espliciti: `pk_`, `uq_`, `fk_`, `ck_`, `ix_` + tabella + colonne.
- Enum PostgreSQL con valori in maiuscolo, mappati su enum Java.
- Contenuti moderabili con `hidden_at`, `hidden_by`, `hidden_reason`.
- Nessuna credenziale nelle migrazioni; nessuna modifica a migrazioni già applicate.

## Enum

| Tipo | Valori | Enum Java |
|---|---|---|
| `user_role` | `FAN`, `MUSICIAN`, `HOST`, `ADMIN`, `SUPERADMIN` | `Role` |
| `user_status` | `ACTIVE`, `SUSPENDED` | `UserStatus` |
| `email_code_purpose` | `EMAIL_VERIFICATION`, `PASSWORD_RESET` | `EmailCodePurpose` |

## Tabelle

### users

| Colonna | Tipo | Vincoli |
|---|---|---|
| `id` | uuid | PK `pk_users`, default `gen_random_uuid()` |
| `email` | varchar(255) | NOT NULL, univoca `uq_users_email`; sempre minuscola (la normalizza l'applicazione) |
| `password_hash` | varchar(100) | NOT NULL (BCrypt) |
| `display_name` | varchar(50) | NOT NULL |
| `avatar_url` | varchar(2048) | NULL; solo http/https (validato dall'applicazione) |
| `email_verified` | boolean | NOT NULL, default `false` |
| `status` | user_status | NOT NULL, default `ACTIVE` |
| `bio` | varchar(500) | NULL |
| `city` | varchar(100) | NULL, testo libero |
| `latitude` | double precision | NULL finché l'utente non condivide la posizione |
| `longitude` | double precision | NULL finché l'utente non condivide la posizione |
| `created_at` | timestamptz | NOT NULL, default `now()` |
| `suspended_at` | timestamptz | NULL |
| `suspended_by` | uuid | NULL, FK `fk_users_suspended_by` → `users(id)` |
| `suspension_reason` | varchar(500) | NULL |
| `suspended_until` | timestamptz | NULL (NULL = sospensione a tempo indeterminato) |

Vincoli di controllo:

- `ck_users_coordinates`: latitudine e longitudine sono entrambe nulle oppure entrambe presenti, con
  latitudine fra −90 e 90 e longitudine fra −180 e 180.
- `ck_users_suspension`: se `status = 'ACTIVE'` i quattro campi di sospensione sono nulli; se
  `status = 'SUSPENDED'` `suspended_at`, `suspended_by` e `suspension_reason` sono valorizzati
  (`suspended_until` resta facoltativo).

### user_roles

| Colonna | Tipo | Vincoli |
|---|---|---|
| `user_id` | uuid | FK `fk_user_roles_user` → `users(id)` ON DELETE CASCADE |
| `role` | user_role | NOT NULL |
| `granted_at` | timestamptz | NOT NULL, default `now()` |

Chiave primaria composta `pk_user_roles (user_id, role)`: una riga per ogni ruolo attivo di un
utente. Indice `ix_user_roles_role (role)` per cercare se esiste un SUPERADMIN e per gli elenchi per
ruolo.

### refresh_tokens

| Colonna | Tipo | Vincoli |
|---|---|---|
| `id` | uuid | PK `pk_refresh_tokens`, default `gen_random_uuid()` |
| `user_id` | uuid | NOT NULL, FK `fk_refresh_tokens_user` → `users(id)` ON DELETE CASCADE |
| `token_hash` | char(64) | NOT NULL, univoca `uq_refresh_tokens_hash`; SHA-256 esadecimale del valore (il valore non è salvato) |
| `expires_at` | timestamptz | NOT NULL |
| `revoked` | boolean | NOT NULL, default `false` |
| `created_at` | timestamptz | NOT NULL, default `now()` |
| `revoked_at` | timestamptz | NULL; istante della revoca, da cui parte la finestra di tolleranza di 10 secondi |
| `replaced_by` | uuid | NULL, FK `fk_refresh_tokens_replaced_by` → `refresh_tokens(id)` ON DELETE SET NULL |

Vincolo di controllo `ck_refresh_tokens_revoked`: `revoked` è vero se e solo se `revoked_at` è presente, e
`replaced_by` può essere valorizzato solo per un token revocato. Indici `ix_refresh_tokens_user (user_id)`
e `ix_refresh_tokens_expires (expires_at)` per la revoca totale e la pulizia dei token scaduti.

### email_codes

Una riga per coppia (utente, scopo): contiene il codice attivo e i contatori dei limiti di invio.

| Colonna | Tipo | Vincoli |
|---|---|---|
| `id` | uuid | PK `pk_email_codes`, default `gen_random_uuid()` |
| `user_id` | uuid | NOT NULL, FK `fk_email_codes_user` → `users(id)` ON DELETE CASCADE |
| `purpose` | email_code_purpose | NOT NULL |
| `code` | varchar(6) | NULL (NULL = nessun codice attivo, dopo l'uso); salvato in chiaro: 6 cifre hanno troppa poca entropia perché un hash protegga davvero, la protezione è data da scadenza, tentativi e limiti |
| `sent_at` | timestamptz | NULL; ultimo invio, da cui contano i 60 secondi fra due invii e i 15 minuti di validità |
| `attempts` | int | NOT NULL, default 0; tentativi di verifica consumati (massimo 5) |
| `sends_count` | int | NOT NULL, default 0; invii nella finestra corrente di 24 ore (massimo 5) |
| `sends_window_start` | timestamptz | NULL; inizio della finestra di 24 ore |
| `created_at` | timestamptz | NOT NULL, default `now()` |

Vincoli: `uq_email_codes_user_purpose (user_id, purpose)`; `ck_email_codes_code` (se `code` non è nullo,
`sent_at` non è nullo, perché la scadenza si calcola da lì). Dopo l'uso `code` torna NULL ma i contatori
restano, così l'uso di un codice non azzera i limiti di invio.

## Relazioni (diagramma ER)

```mermaid
erDiagram
    USERS ||--o{ USER_ROLES : "ha ruoli"
    USERS |o--o{ USERS : "sospeso da (suspended_by)"
    USERS ||--o{ REFRESH_TOKENS : "ha sessioni"
    REFRESH_TOKENS |o--o| REFRESH_TOKENS : "sostituito da (replaced_by)"
    USERS ||--o{ EMAIL_CODES : "riceve codici"

    USERS {
        uuid id PK
        varchar email UK
        varchar password_hash
        varchar display_name
        varchar avatar_url
        boolean email_verified
        user_status status
        varchar bio
        varchar city
        double latitude
        double longitude
        timestamptz created_at
        timestamptz suspended_at
        uuid suspended_by FK
        varchar suspension_reason
        timestamptz suspended_until
    }

    USER_ROLES {
        uuid user_id PK, FK
        user_role role PK
        timestamptz granted_at
    }

    REFRESH_TOKENS {
        uuid id PK
        uuid user_id FK
        char token_hash UK
        timestamptz expires_at
        boolean revoked
        timestamptz created_at
        timestamptz revoked_at
        uuid replaced_by FK
    }

    EMAIL_CODES {
        uuid id PK
        uuid user_id FK
        email_code_purpose purpose UK
        varchar code
        timestamptz sent_at
        int attempts
        int sends_count
        timestamptz sends_window_start
        timestamptz created_at
    }
```
