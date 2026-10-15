-- Refresh token con rotazione e finestra di tolleranza (progettazione, sezioni 3.2, 4.2 e 4.8).

CREATE TABLE refresh_tokens (
    id          uuid         NOT NULL DEFAULT gen_random_uuid(),
    user_id     uuid         NOT NULL,
    token_hash  char(64)     NOT NULL,                  -- SHA-256 esadecimale del valore; il valore non e' salvato
    expires_at  timestamptz  NOT NULL,
    revoked     boolean      NOT NULL DEFAULT false,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    revoked_at  timestamptz,                            -- istante della revoca: serve alla finestra di 10 secondi
    replaced_by uuid,                                   -- token che ha sostituito questo nella rotazione
    CONSTRAINT pk_refresh_tokens PRIMARY KEY (id),
    CONSTRAINT uq_refresh_tokens_hash UNIQUE (token_hash),
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_refresh_tokens_replaced_by FOREIGN KEY (replaced_by) REFERENCES refresh_tokens (id) ON DELETE SET NULL,
    -- revoked e revoked_at coincidono; replaced_by ha senso solo per un token revocato.
    CONSTRAINT ck_refresh_tokens_revoked CHECK (
        revoked = (revoked_at IS NOT NULL)
        AND (replaced_by IS NULL OR revoked)
    )
);

CREATE INDEX ix_refresh_tokens_user ON refresh_tokens (user_id);
-- Pulizia dei token scaduti.
CREATE INDEX ix_refresh_tokens_expires ON refresh_tokens (expires_at);
