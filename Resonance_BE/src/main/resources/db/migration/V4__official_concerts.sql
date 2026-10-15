-- Concerti ufficiali pubblicati dagli HOST (progettazione, sezioni 3.2, 3.5 e 3.6).

CREATE TABLE official_concerts (
    id                  uuid             NOT NULL DEFAULT gen_random_uuid(),
    host_id             uuid             NOT NULL,
    title               varchar(150)     NOT NULL,
    description         varchar(5000),
    venue_name          varchar(150)     NOT NULL,
    address             varchar(255)     NOT NULL,              -- indirizzo digitato dall'host, da cui si ricavano le coordinate
    latitude            double precision NOT NULL,              -- gradi, da geocodifica (sezione 10.1)
    longitude           double precision NOT NULL,
    event_date          timestamptz      NOT NULL,
    genre_tags          text[]           NOT NULL DEFAULT '{}', -- normalizzati dall'applicazione: minuscoli, senza duplicati
    cover_image_url     varchar(2048),                          -- solo http/https, validato dall'applicazione
    external_ticket_url varchar(2048),                          -- solo http/https, validato dall'applicazione
    created_at          timestamptz      NOT NULL DEFAULT now(),
    hidden_at           timestamptz,                            -- NULL = visibile (moderazione, sezione 5.7)
    hidden_by           uuid,
    hidden_reason       varchar(500),
    CONSTRAINT pk_official_concerts PRIMARY KEY (id),
    CONSTRAINT fk_official_concerts_host FOREIGN KEY (host_id) REFERENCES users (id),
    CONSTRAINT fk_official_concerts_hidden_by FOREIGN KEY (hidden_by) REFERENCES users (id),
    CONSTRAINT ck_official_concerts_coordinates CHECK (
        latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
    ),
    -- Vincolo comune dei contenuti moderabili (sezione 3.2): data e autore del nascondimento vanno insieme
    -- e il motivo esiste solo se il contenuto e' nascosto. Che il motivo sia obbligatorio per gli admin lo
    -- controlla il service: il database non sa chi nasconde.
    CONSTRAINT ck_official_concerts_hidden CHECK (
        (hidden_at IS NULL) = (hidden_by IS NULL)
        AND (hidden_at IS NOT NULL OR hidden_reason IS NULL)
    )
);

CREATE INDEX ix_official_concerts_host ON official_concerts (host_id);
-- Prefiltro a bounding box della ricerca nelle vicinanze (sezione 10.2).
CREATE INDEX ix_official_concerts_coordinates ON official_concerts (latitude, longitude);
CREATE INDEX ix_official_concerts_event_date ON official_concerts (event_date);
