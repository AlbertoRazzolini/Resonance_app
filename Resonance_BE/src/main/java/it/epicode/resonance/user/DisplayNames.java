package it.epicode.resonance.user;

/**
 * Pulizia del nome utente prima di validarlo e salvarlo (decisione 96, progettazione, sezione 4.4).
 */
public final class DisplayNames {

    private DisplayNames() {
    }

    /**
     * Toglie gli spazi ai bordi e riduce a uno solo gli spazi ripetuti dentro il nome: "Marco   Rossi" e
     * "Marco Rossi" sono uguali a vista e devono contare come lo stesso nome. Le maiuscole restano come scritte.
     * Solo lo spazio normale: gli altri caratteri che somigliano a uno spazio sono un limite noto della decisione 96.
     */
    public static String normalize(String name) {
        return name == null ? null : name.strip().replaceAll(" {2,}", " ");
    }
}
