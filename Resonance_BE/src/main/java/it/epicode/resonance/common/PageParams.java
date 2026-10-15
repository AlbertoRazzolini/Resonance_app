package it.epicode.resonance.common;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

/**
 * Parametri di paginazione comuni a tutte le liste: page da 0 (default 0), size da 1 a 100
 * (default 20). Fuori range e' un 400 VALIDATION_ERROR (progettazione, sezione 6.1).
 * I componenti sono Integer e non int per distinguere "parametro assente" (si usa il default) da
 * "parametro a 0" (size=0 deve essere rifiutato).
 */
public record PageParams(
        @Min(0) Integer page,
        @Min(1) @Max(100) Integer size
) {

    public static final int DEFAULT_PAGE = 0;
    public static final int DEFAULT_SIZE = 20;

    public PageParams {
        page = page == null ? DEFAULT_PAGE : page;
        size = size == null ? DEFAULT_SIZE : size;
    }

    /**
     * Pageable con l'ordinamento fisso dell'endpoint (non c'e' un parametro sort libero).
     * Va usato dopo la validazione: page negativo o size zero qui farebbero eccezione.
     */
    public Pageable toPageable(Sort sort) {
        return PageRequest.of(page, size, sort);
    }
}
