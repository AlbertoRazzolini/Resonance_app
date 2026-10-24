package it.epicode.resonance.mail;

import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Logo delle email (decisione 115): il PNG del marchio sta in Resonance_FE/public, quindi finisce nell'immagine
 * Docker e il sito lo serve come /email-logo.png. Verifica che esista, sia un PNG con sfondo trasparente e abbia
 * la misura attesa (440 x 81 px, il doppio dei 220 px mostrati, per gli schermi ad alta densita').
 */
class EmailLogoTest {

    private static final Path LOGO = Path.of("..", "Resonance_FE", "public", "email-logo.png");

    @Test
    void emailLogo_existsInTheFrontendPublicFolder() {
        assertThat(LOGO).exists().isRegularFile();
    }

    @Test
    void emailLogo_isATransparentPngOfTheExpectedSize() throws IOException {
        byte[] bytes = Files.readAllBytes(LOGO);
        // Firma di un file PNG.
        assertThat(bytes).startsWith(0x89, 'P', 'N', 'G');

        BufferedImage image = ImageIO.read(LOGO.toFile());

        assertThat(image.getWidth()).isEqualTo(440);
        assertThat(image.getHeight()).isEqualTo(81);
        assertThat(image.getColorModel().hasAlpha()).isTrue();
        // L'angolo in alto a sinistra e' vuoto: il logo non porta con se' uno sfondo.
        assertThat(image.getRGB(0, 0) >>> 24).isZero();
    }

    @Test
    void emailLogo_isSmallEnoughForAnEmail() throws IOException {
        assertThat(Files.size(LOGO)).isLessThan(30_000L);
    }
}
