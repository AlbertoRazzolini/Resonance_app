package it.epicode.resonance.user;

import java.util.Locale;
import java.util.Set;

/**
 * Nomi che nessun utente puo' scegliere perche' imitano l'amministrazione (decisione 96, progettazione, sezione 4.4).
 */
public final class ReservedDisplayNames {

    private static final Set<String> NAMES = Set.of(
            "admin", "superadmin", "resonance", "staff", "support", "moderator", "official", "system", "root");

    private ReservedDisplayNames() {
    }

    /**
     * Vero se il nome intero coincide con uno riservato, senza distinguere le maiuscole. Un nome che lo contiene
     * soltanto ("Admin Mario") non e' riservato: e' un limite noto, scelto per non bloccare i nomi d'arte.
     */
    public static boolean isReserved(String name) {
        return name != null && NAMES.contains(name.toLowerCase(Locale.ROOT));
    }
}
