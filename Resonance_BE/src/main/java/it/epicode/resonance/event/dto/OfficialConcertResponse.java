package it.epicode.resonance.event.dto;

import it.epicode.resonance.event.OfficialConcert;
import it.epicode.resonance.user.dto.AuthorSummary;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Concerto ufficiale nelle risposte (progettazione, sezione 6.6). {@code distanceKm} e' valorizzato solo
 * nelle ricerche nelle vicinanze; l'autore e' ridotto ai dati pubblici.
 */
public record OfficialConcertResponse(
        UUID id,
        AuthorSummary host,
        String title,
        String description,
        String venueName,
        String address,
        double latitude,
        double longitude,
        Instant eventDate,
        List<String> genreTags,
        String coverImageUrl,
        String externalTicketUrl,
        Instant createdAt,
        Double distanceKm
) {

    /**
     * Converte il concerto; l'autore deve essere gia' caricato. {@code distanceKm} e' null fuori dalle ricerche
     * nelle vicinanze.
     */
    public static OfficialConcertResponse from(OfficialConcert concert, Double distanceKm) {
        return new OfficialConcertResponse(
                concert.getId(),
                AuthorSummary.from(concert.getHost()),
                concert.getTitle(),
                concert.getDescription(),
                concert.getVenueName(),
                concert.getAddress(),
                concert.getLatitude(),
                concert.getLongitude(),
                concert.getEventDate(),
                List.copyOf(concert.getGenreTags()),
                concert.getCoverImageUrl(),
                concert.getExternalTicketUrl(),
                concert.getCreatedAt(),
                distanceKm);
    }
}
