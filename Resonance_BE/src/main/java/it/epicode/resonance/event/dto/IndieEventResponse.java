package it.epicode.resonance.event.dto;

import it.epicode.resonance.event.IndieEvent;
import it.epicode.resonance.event.IndieEventStatus;
import it.epicode.resonance.user.dto.AuthorSummary;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Indie event nelle risposte (progettazione, sezione 6.6). {@code distanceKm} e' valorizzato solo nelle ricerche
 * nelle vicinanze; l'autore e' ridotto ai dati pubblici.
 */
public record IndieEventResponse(
        UUID id,
        AuthorSummary musician,
        String title,
        String description,
        String venueName,
        String address,
        double latitude,
        double longitude,
        Instant eventDate,
        List<String> genreTags,
        String coverImageUrl,
        boolean isFree,
        IndieEventStatus status,
        Instant createdAt,
        Double distanceKm
) {

    /**
     * Converte l'evento; l'autore deve essere gia' caricato. {@code distanceKm} e' null fuori dalle ricerche
     * nelle vicinanze.
     */
    public static IndieEventResponse from(IndieEvent event, Double distanceKm) {
        return new IndieEventResponse(
                event.getId(),
                AuthorSummary.from(event.getMusician()),
                event.getTitle(),
                event.getDescription(),
                event.getVenueName(),
                event.getAddress(),
                event.getLatitude(),
                event.getLongitude(),
                event.getEventDate(),
                List.copyOf(event.getGenreTags()),
                event.getCoverImageUrl(),
                event.isFree(),
                event.getStatus(),
                event.getCreatedAt(),
                distanceKm);
    }
}
