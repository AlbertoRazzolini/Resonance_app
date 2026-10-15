package it.epicode.resonance.auth;

import it.epicode.resonance.common.ErrorCode;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Esito di una rotazione (progettazione, sezione 4.8). Il service restituisce un esito invece di
 * lanciare, cosi' le revoche fatte negli esiti di errore restano salvate (la transazione non
 * va in rollback).
 */
public sealed interface RefreshOutcome {

    /**
     * Rotazione riuscita: la riga vecchia e' revocata e c'e' un token nuovo.
     */
    record Rotated(UUID userId, IssuedRefreshToken token) implements RefreshOutcome {
    }

    /**
     * Refresh concorrente entro la finestra di tolleranza: nessun token, nessuna revoca, cookie intatto.
     */
    record Conflict() implements RefreshOutcome {
    }

    /**
     * Token rifiutato; "clearCookie" dice se il cookie va cancellato, "details" porta i dati del codice
     * (es. il motivo della sospensione).
     */
    record Rejected(ErrorCode code, boolean clearCookie, Map<String, Object> details) implements RefreshOutcome {

        public Rejected {
            // Non Map.copyOf: i valori possono essere null (sospensione senza scadenza).
            details = details == null ? Map.of() : Collections.unmodifiableMap(new LinkedHashMap<>(details));
        }
    }
}
