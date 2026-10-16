-- Chat privata, messaggi e sblocchi (progettazione, sezioni 3.2 e 6.9; decisione 59).

CREATE TYPE chat_unlock_source AS ENUM ('COLLAB_POST', 'OFFICIAL_CONCERT', 'INDIE_EVENT');

CREATE TABLE chat_conversations (
    id              uuid        NOT NULL DEFAULT gen_random_uuid(),
    user_a_id       uuid        NOT NULL,                       -- il minore dei due id (coppia canonica)
    user_b_id       uuid        NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    last_message_at timestamptz,                                -- NULL = nessun messaggio ancora
    CONSTRAINT pk_chat_conversations PRIMARY KEY (id),
    CONSTRAINT fk_chat_conversations_user_a FOREIGN KEY (user_a_id) REFERENCES users (id),
    CONSTRAINT fk_chat_conversations_user_b FOREIGN KEY (user_b_id) REFERENCES users (id),
    -- Coppia canonica: una sola conversazione per coppia, qualunque dei due la apra.
    CONSTRAINT ck_chat_conversations_order CHECK (user_a_id < user_b_id),
    CONSTRAINT uq_chat_conversations_pair UNIQUE (user_a_id, user_b_id)
);

-- user_a_id e' gia' coperto dal vincolo di unicita'.
CREATE INDEX ix_chat_conversations_user_b ON chat_conversations (user_b_id);

CREATE TABLE chat_messages (
    id              uuid          NOT NULL DEFAULT gen_random_uuid(),
    conversation_id uuid          NOT NULL,
    sender_id       uuid          NOT NULL,
    body            varchar(2000) NOT NULL,
    read_at         timestamptz,                                -- NULL = non letto dall'altro
    sent_at         timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT pk_chat_messages PRIMARY KEY (id),
    CONSTRAINT fk_chat_messages_conversation FOREIGN KEY (conversation_id) REFERENCES chat_conversations (id),
    CONSTRAINT fk_chat_messages_sender FOREIGN KEY (sender_id) REFERENCES users (id)
);

-- Paginazione a cursore dello storico: dal piu' recente, a parita' di istante per id.
CREATE INDEX ix_chat_messages_cursor ON chat_messages (conversation_id, sent_at DESC, id DESC);

-- Origini che permettono di scrivere senza amicizia: candidatura a un annuncio, contatto di un evento.
CREATE TABLE chat_unlocks (
    conversation_id uuid               NOT NULL,
    source_type     chat_unlock_source NOT NULL,
    source_id       uuid               NOT NULL,                -- id dell'annuncio o dell'evento: senza FK, punta a tre tabelle
    created_at      timestamptz        NOT NULL DEFAULT now(),
    CONSTRAINT pk_chat_unlocks PRIMARY KEY (conversation_id, source_type, source_id),
    CONSTRAINT fk_chat_unlocks_conversation FOREIGN KEY (conversation_id) REFERENCES chat_conversations (id)
);
