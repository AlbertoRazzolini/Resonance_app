-- Utenti e ruoli (progettazione, sezioni 3.1, 3.2 e 3.6).

CREATE TYPE user_role   AS ENUM ('FAN', 'MUSICIAN', 'HOST', 'ADMIN', 'SUPERADMIN');
CREATE TYPE user_status AS ENUM ('ACTIVE', 'SUSPENDED');

CREATE TABLE users (
    id                uuid             NOT NULL DEFAULT gen_random_uuid(),
    email             varchar(255)     NOT NULL,            -- sempre minuscola (normalizzata dall'applicazione)
    password_hash     varchar(100)     NOT NULL,            -- BCrypt
    display_name      varchar(50)      NOT NULL,
    avatar_url        varchar(2048),                        -- solo http/https, validato dall'applicazione
    email_verified    boolean          NOT NULL DEFAULT false,
    status            user_status      NOT NULL DEFAULT 'ACTIVE',
    bio               varchar(500),
    city              varchar(100),
    latitude          double precision,                     -- NULL finche' l'utente non condivide la posizione
    longitude         double precision,
    created_at        timestamptz      NOT NULL DEFAULT now(),
    suspended_at      timestamptz,
    suspended_by      uuid,
    suspension_reason varchar(500),
    suspended_until   timestamptz,                          -- NULL = sospensione a tempo indeterminato
    CONSTRAINT pk_users PRIMARY KEY (id),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT fk_users_suspended_by FOREIGN KEY (suspended_by) REFERENCES users (id),
    -- Latitudine e longitudine insieme o nessuna dei due, nei range. IS NOT NULL esplicito:
    -- un CHECK con valore NULL passerebbe comunque.
    CONSTRAINT ck_users_coordinates CHECK (
        (latitude IS NULL AND longitude IS NULL)
        OR (latitude IS NOT NULL AND longitude IS NOT NULL
            AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
    ),
    -- ACTIVE: nessun campo di sospensione. SUSPENDED: data, autore e motivo obbligatori;
    -- la scadenza resta facoltativa (progettazione, sezione 5.5).
    CONSTRAINT ck_users_suspension CHECK (
        (status = 'ACTIVE' AND suspended_at IS NULL AND suspended_by IS NULL
            AND suspension_reason IS NULL AND suspended_until IS NULL)
        OR (status = 'SUSPENDED' AND suspended_at IS NOT NULL AND suspended_by IS NOT NULL
            AND suspension_reason IS NOT NULL)
    )
);

CREATE TABLE user_roles (
    user_id    uuid        NOT NULL,
    role       user_role   NOT NULL,
    granted_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_user_roles PRIMARY KEY (user_id, role),
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Ricerca dell'esistenza di un SUPERADMIN ed elenchi per ruolo.
CREATE INDEX ix_user_roles_role ON user_roles (role);
