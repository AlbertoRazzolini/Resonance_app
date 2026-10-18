package it.epicode.resonance.geo;

/**
 * Distanza in chilometri fra due punti geografici (progettazione, sezione 10.3): fa da oracolo nei test della
 * query SQL, che usa la stessa formula e lo stesso raggio terrestre.
 */
public final class Haversine {

    // Raggio medio della Terra: precisione sufficiente per ordinare e confrontare, non per navigare.
    private static final double EARTH_RADIUS_KM = 6371.0;

    private Haversine() {
    }

    /**
     * Distanza sulla sfera fra (lat1, lng1) e (lat2, lng2), in gradi decimali.
     */
    public static double km(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_KM * c;
    }
}
