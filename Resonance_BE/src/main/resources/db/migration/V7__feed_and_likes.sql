-- Post del feed e like (progettazione, sezioni 3.2, 3.4 e 3.6).

CREATE TABLE feed_posts (
    id            uuid             NOT NULL DEFAULT gen_random_uuid(),
    author_id     uuid             NOT NULL,
    body          varchar(2000)    NOT NULL,
    image_url     varchar(2048),                                -- solo http/https, validato dall'applicazione
    latitude      double precision,                             -- gradi; entrambe le coordinate o nessuna
    longitude     double precision,
    likes_count   integer          NOT NULL DEFAULT 0,          -- denormalizzato, aggiornato in modo atomico (sezione 3.4)
    created_at    timestamptz      NOT NULL DEFAULT now(),
    hidden_at     timestamptz,                                  -- NULL = visibile (moderazione, sezione 5.7)
    hidden_by     uuid,
    hidden_reason varchar(500),
    CONSTRAINT pk_feed_posts PRIMARY KEY (id),
    CONSTRAINT fk_feed_posts_author FOREIGN KEY (author_id) REFERENCES users (id),
    CONSTRAINT fk_feed_posts_hidden_by FOREIGN KEY (hidden_by) REFERENCES users (id),
    -- Coordinate insieme o assenti, e nei range (per NULL il controllo e' soddisfatto).
    CONSTRAINT ck_feed_posts_coordinates CHECK (
        (latitude IS NULL) = (longitude IS NULL)
        AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
    ),
    -- Rete di sicurezza: il contatore non scende sotto zero (sezione 3.4).
    CONSTRAINT ck_feed_posts_likes CHECK (likes_count >= 0),
    -- Vincolo comune dei contenuti moderabili (sezione 3.2), come in official_concerts.
    CONSTRAINT ck_feed_posts_hidden CHECK (
        (hidden_at IS NULL) = (hidden_by IS NULL)
        AND (hidden_at IS NOT NULL OR hidden_reason IS NULL)
    )
);

CREATE INDEX ix_feed_posts_author ON feed_posts (author_id);
-- Lista pubblica: solo post non nascosti, dal piu' recente.
CREATE INDEX ix_feed_posts_created ON feed_posts (created_at DESC, id DESC) WHERE hidden_at IS NULL;
-- Prefiltro a bounding box del filtro per raggio (sezione 10.2): solo i post con coordinate.
CREATE INDEX ix_feed_posts_coordinates ON feed_posts (latitude, longitude) WHERE latitude IS NOT NULL;

CREATE TABLE post_likes (
    user_id    uuid        NOT NULL,
    post_id    uuid        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_post_likes PRIMARY KEY (user_id, post_id),
    CONSTRAINT fk_post_likes_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_post_likes_post FOREIGN KEY (post_id) REFERENCES feed_posts (id)
);

CREATE INDEX ix_post_likes_post ON post_likes (post_id);
