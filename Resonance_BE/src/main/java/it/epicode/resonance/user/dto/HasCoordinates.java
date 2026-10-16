package it.epicode.resonance.user.dto;

/**
 * Richiesta con una coppia facoltativa di coordinate in gradi, controllabile con {@link CoordinatesTogether}.
 */
public interface HasCoordinates {

    Double latitude();

    Double longitude();
}
