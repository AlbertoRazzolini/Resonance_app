-- Indie event pubblicati dai MUSICIAN, con bozze (progettazione, sezioni 3.2 e 3.6).

CREATE TYPE indie_event_status AS ENUM ('DRAFT', 'PUBLISHED');

CREATE TABLE indie_events (
    id              uuid               NOT NULL DEFAULT gen_random_uuid(),
    musician_id     uuid               NOT NULL,
    title           varchar(150)       NOT NULL,
    description     varchar(5000),
    venue_name      varchar(150)       NOT NULL,
    address         varchar(255)       NOT NULL,              -- indirizzo digitato dal musicista, da cui si ricavano le coordinate
    latitude        double precision   NOT NULL,              -- gradi, da geocodifica (sezione 10.1)
    longitude       double precision   NOT NULL,
    event_date      timestamptz        NOT NULL,
    genre_tags      text[]             NOT NULL DEFAULT '{}', -- normalizzati dall'applicazione: minuscoli, senza duplicati
    cover_image_url varchar(2048),                            -- solo http/https, validato dall'applicazione
    is_free         boolean            NOT NULL DEFAULT false,
    status          indie_event_status NOT NULL DEFAULT 'PUBLISHED',
    created_at      timestamptz        NOT NULL DEFAULT now(),
    hidden_at       timestamptz,                              -- NULL = visibile (moderazione, sezione 5.7)
    hidden_by       uuid,
    hidden_reason   varchar(500),
    CONSTRAINT pk_indie_events PRIMARY KEY (id),
    CONSTRAINT fk_indie_events_musician FOREIGN KEY (musician_id) REFERENCES users (id),
    CONSTRAINT fk_indie_events_hidden_by FOREIGN KEY (hidden_by) REFERENCES users (id),
    CONSTRAINT ck_indie_events_coordinates CHECK (
        latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
    ),
    -- Vincolo comune dei contenuti moderabili (sezione 3.2), come in official_concerts.
    CONSTRAINT ck_indie_events_hidden CHECK (
        (hidden_at IS NULL) = (hidden_by IS NULL)
        AND (hidden_at IS NOT NULL OR hidden_reason IS NULL)
    )
);

CREATE INDEX ix_indie_events_musician ON indie_events (musician_id);
-- Prefiltro a bounding box della ricerca nelle vicinanze (sezione 10.2).
CREATE INDEX ix_indie_events_coordinates ON indie_events (latitude, longitude);
CREATE INDEX ix_indie_events_event_date ON indie_events (event_date);
