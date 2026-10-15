-- Codici email a 6 cifre e contatori dei limiti di invio (progettazione, sezioni 3.1, 3.2, 4.5 e 4.6).

CREATE TYPE email_code_purpose AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

CREATE TABLE email_codes (
    id                 uuid               NOT NULL DEFAULT gen_random_uuid(),
    user_id            uuid               NOT NULL,
    purpose            email_code_purpose NOT NULL,
    code               varchar(6),                          -- NULL = nessun codice attivo (dopo l'uso)
    sent_at            timestamptz,                         -- ultimo invio: limite dei 60 s e scadenza dei 15 min
    attempts           int                NOT NULL DEFAULT 0,
    sends_count        int                NOT NULL DEFAULT 0,
    sends_window_start timestamptz,                         -- inizio della finestra di 24 ore
    created_at         timestamptz        NOT NULL DEFAULT now(),
    CONSTRAINT pk_email_codes PRIMARY KEY (id),
    -- Una riga per coppia (utente, scopo): il codice attivo e i suoi contatori.
    CONSTRAINT uq_email_codes_user_purpose UNIQUE (user_id, purpose),
    CONSTRAINT fk_email_codes_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    -- Un codice attivo ha sempre l'istante di invio, da cui si calcola la scadenza.
    CONSTRAINT ck_email_codes_code CHECK (code IS NULL OR sent_at IS NOT NULL)
);
