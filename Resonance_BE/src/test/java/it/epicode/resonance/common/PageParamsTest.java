package it.epicode.resonance.common;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Regole comuni di paginazione: default 0/20, page almeno 0, size fra 1 e 100 (progettazione, sezione 6.1).
 */
class PageParamsTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void missingValues_useDefaults() {
        PageParams params = new PageParams(null, null);

        assertThat(params.page()).isEqualTo(0);
        assertThat(params.size()).isEqualTo(20);
        assertThat(validator.validate(params)).isEmpty();
    }

    @Test
    void negativePage_isRejected() {
        assertThat(violatedProperties(new PageParams(-1, 20))).containsExactly("page");
    }

    @Test
    void zeroSize_isRejected() {
        assertThat(violatedProperties(new PageParams(0, 0))).containsExactly("size");
    }

    @Test
    void sizeOverTheMaximum_isRejected() {
        assertThat(violatedProperties(new PageParams(0, 1000))).containsExactly("size");
    }

    @Test
    void boundaryValues_areAccepted() {
        assertThat(validator.validate(new PageParams(0, 1))).isEmpty();
        assertThat(validator.validate(new PageParams(5, 100))).isEmpty();
    }

    @Test
    void toPageable_keepsPageSizeAndSort() {
        Pageable pageable = new PageParams(2, 10).toPageable(Sort.by("createdAt").descending());

        assertThat(pageable.getPageNumber()).isEqualTo(2);
        assertThat(pageable.getPageSize()).isEqualTo(10);
        assertThat(pageable.getSort()).isEqualTo(Sort.by("createdAt").descending());
    }

    private Set<String> violatedProperties(PageParams params) {
        return validator.validate(params).stream()
                .map(ConstraintViolation::getPropertyPath)
                .map(Object::toString)
                .collect(Collectors.toSet());
    }
}
