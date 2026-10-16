package it.epicode.resonance.common;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifica che l'escape del LIKE renda letterali i tre caratteri speciali (\, % e _) e lasci invariato il resto.
 */
class LikePatternTest {

    @Test
    void escape_percentAndUnderscore_becomeLiteral() {
        assertThat(LikePattern.escape("50%_off")).isEqualTo("50\\%\\_off");
    }

    @Test
    void escape_backslash_isDoubledBeforeTheOthers() {
        // Il backslash va raddoppiato per primo: altrimenti si raddoppierebbero anche quelli appena aggiunti.
        assertThat(LikePattern.escape("a\\%")).isEqualTo("a\\\\\\%");
    }

    @Test
    void escape_plainText_isUnchanged() {
        assertThat(LikePattern.escape("Alice Rossi")).isEqualTo("Alice Rossi");
    }
}
