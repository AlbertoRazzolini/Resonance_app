-- Amicizie con rifiuto silenzioso (progettazione, sezioni 3.2 e 6.14; decisione 59).

CREATE TYPE friendship_status AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'REMOVED');

CREATE TABLE friendships (
    id             uuid              NOT NULL DEFAULT gen_random_uuid(),
    requester_id   uuid              NOT NULL,                 -- chi ha inviato l'ultima richiesta
    addressee_id   uuid              NOT NULL,
    status         friendship_status NOT NULL,
    closed_by      uuid,                                       -- chi ha rifiutato o rimosso
    request_masked boolean           NOT NULL DEFAULT false,   -- rifiuto silenzioso: il richiedente vede ancora la richiesta
    created_at     timestamptz       NOT NULL DEFAULT now(),
    updated_at     timestamptz       NOT NULL,
    CONSTRAINT pk_friendships PRIMARY KEY (id),
    CONSTRAINT fk_friendships_requester FOREIGN KEY (requester_id) REFERENCES users (id),
    CONSTRAINT fk_friendships_addressee FOREIGN KEY (addressee_id) REFERENCES users (id),
    CONSTRAINT fk_friendships_closed_by FOREIGN KEY (closed_by) REFERENCES users (id),
    CONSTRAINT ck_friendships_not_self CHECK (requester_id <> addressee_id),
    -- closed_by c'e' se e solo se la riga e' stata chiusa da una delle due parti.
    CONSTRAINT ck_friendships_closed_by CHECK (
        (closed_by IS NOT NULL) = (status IN ('DECLINED', 'REMOVED'))
    ),
    -- Il rifiuto silenzioso esiste solo su una richiesta rifiutata.
    CONSTRAINT ck_friendships_masked CHECK (NOT request_masked OR status = 'DECLINED')
);

-- Una riga per coppia, qualunque dei due abbia chiesto.
CREATE UNIQUE INDEX uq_friendships_pair
    ON friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));
CREATE INDEX ix_friendships_requester ON friendships (requester_id);
CREATE INDEX ix_friendships_addressee ON friendships (addressee_id);
