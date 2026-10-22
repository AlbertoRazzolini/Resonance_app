package it.epicode.resonance.user;

import it.epicode.resonance.common.AppException;
import it.epicode.resonance.common.ErrorCode;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

/**
 * Regole di disponibilita' del nome utente, uguali in registrazione e nella modifica del profilo (decisione 96,
 * progettazione, sezioni 4.4 e 6.5).
 */
@Component
public class DisplayNamePolicy {

    private final UserRepository users;

    public DisplayNamePolicy(UserRepository users) {
        this.users = users;
    }

    /**
     * Controlla un nome gia' ripulito da {@link DisplayNames#normalize}. Prima il riservato (400 sul campo), poi il
     * nome preso (409): cosi' chi prova un nome riservato non scopre se qualcuno lo usa. {@code selfId} e' l'utente
     * che tiene gia' il nome (null per un utente nuovo) e non conta come conflitto. Il controllo da' una risposta
     * chiara; a fermare due richieste insieme e' l'indice uq_users_display_name_lower.
     */
    public void requireAvailable(String name, UUID selfId) {
        if (ReservedDisplayNames.isReserved(name)) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Uno o più campi non sono validi",
                    Map.of("displayName", "Questo nome utente non è disponibile"));
        }
        boolean taken = selfId == null
                ? users.existsByDisplayNameIgnoreCase(name)
                : users.existsByDisplayNameIgnoreCaseExcluding(name, selfId);
        if (taken) {
            throw new AppException(ErrorCode.DISPLAY_NAME_TAKEN, "Nome già utilizzato");
        }
    }
}
