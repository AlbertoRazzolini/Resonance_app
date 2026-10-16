-- Annunci di collaborazione dei MUSICIAN (progettazione, sezioni 3.2 e 3.6). Le candidature arrivano con la chat (F5).

CREATE TABLE collab_posts (
    id            uuid         NOT NULL DEFAULT gen_random_uuid(),
    musician_id   uuid         NOT NULL,
    title         varchar(150) NOT NULL,
    description   varchar(5000) NOT NULL,
    role_needed   varchar(100) NOT NULL,                       -- ruolo cercato, testo libero (es. "Batterista")
    genre_tags    text[]       NOT NULL DEFAULT '{}',          -- normalizzati dall'applicazione: minuscoli, senza duplicati
    location      varchar(150),                                -- testo libero, non geocodificato
    is_open       boolean      NOT NULL DEFAULT true,          -- false = chiuso dall'autore: resta consultabile, non in lista
    created_at    timestamptz  NOT NULL DEFAULT now(),
    hidden_at     timestamptz,                                 -- NULL = visibile (moderazione, sezione 5.7)
    hidden_by     uuid,
    hidden_reason varchar(500),
    CONSTRAINT pk_collab_posts PRIMARY KEY (id),
    CONSTRAINT fk_collab_posts_musician FOREIGN KEY (musician_id) REFERENCES users (id),
    CONSTRAINT fk_collab_posts_hidden_by FOREIGN KEY (hidden_by) REFERENCES users (id),
    -- Vincolo comune dei contenuti moderabili (sezione 3.2), come in official_concerts.
    CONSTRAINT ck_collab_posts_hidden CHECK (
        (hidden_at IS NULL) = (hidden_by IS NULL)
        AND (hidden_at IS NOT NULL OR hidden_reason IS NULL)
    )
);

CREATE INDEX ix_collab_posts_musician ON collab_posts (musician_id);
-- Lista pubblica: solo annunci aperti e non nascosti, dal piu' recente.
CREATE INDEX ix_collab_posts_open_created ON collab_posts (created_at DESC, id DESC)
    WHERE is_open AND hidden_at IS NULL;
