-- Notifiche persistenti con stato di lettura (decisione 97, progettazione, sezioni 3.2 e 7.6).
-- NEW_MESSAGE non c'e': i messaggi restano solo live e hanno il badge dei non letti della chat.

CREATE TYPE notification_type AS ENUM ('NEW_LIKE', 'COLLAB_APPLICATION', 'FRIEND_REQUEST', 'FRIEND_ACCEPTED');

CREATE TABLE notifications (
    id           uuid              NOT NULL DEFAULT gen_random_uuid(),
    recipient_id uuid              NOT NULL,
    actor_id     uuid              NOT NULL,                 -- chi ha compiuto l'azione
    type         notification_type NOT NULL,
    target_id    uuid              NOT NULL,                 -- post, annuncio o amicizia: nessuna FK, dipende dal tipo
    created_at   timestamptz       NOT NULL,
    read_at      timestamptz,                                -- vuoto = non letta
    CONSTRAINT pk_notifications PRIMARY KEY (id),
    CONSTRAINT fk_notifications_recipient FOREIGN KEY (recipient_id) REFERENCES users (id),
    CONSTRAINT fk_notifications_actor FOREIGN KEY (actor_id) REFERENCES users (id),
    CONSTRAINT ck_notifications_not_self CHECK (recipient_id <> actor_id)
);

-- Elenco di un utente, dalla piu' recente.
CREATE INDEX ix_notifications_recipient_created ON notifications (recipient_id, created_at DESC, id DESC);
-- Conteggio delle non lette.
CREATE INDEX ix_notifications_unread ON notifications (recipient_id) WHERE read_at IS NULL;
-- Pulizia giornaliera delle notifiche scadute.
CREATE INDEX ix_notifications_created ON notifications (created_at);
-- Una sola notifica di like per coppia autore-post, anche con due richieste insieme.
CREATE UNIQUE INDEX uq_notifications_like ON notifications (recipient_id, actor_id, target_id) WHERE type = 'NEW_LIKE';
