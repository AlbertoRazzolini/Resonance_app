-- Nome utente unico senza distinguere le maiuscole (decisione 96, progettazione, sezioni 3.2 e 4.4).
-- Nessuna colonna nuova: l'indice e' su un'espressione. Il controllo del service e' solo una risposta
-- piu' gentile; a fermare due richieste insieme sullo stesso nome e' questo indice.

CREATE UNIQUE INDEX uq_users_display_name_lower ON users (lower(display_name));
