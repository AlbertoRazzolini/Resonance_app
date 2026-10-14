package it.epicode.resonance.common;

import org.springframework.data.domain.Page;

import java.util.List;

/**
 * Corpo di risposta delle liste paginate (progettazione, sezione 6.1). Mai il Page di Spring
 * serializzato cosi' com'e': il suo JSON non e' garantito stabile. Fa eccezione la chat, che usa un cursore.
 */
public record PageResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages
) {

    /**
     * Converte un Page di Spring nel formato stabile dell'API.
     */
    public static <T> PageResponse<T> from(Page<T> page) {
        return new PageResponse<>(
                page.getContent(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages()
        );
    }
}
