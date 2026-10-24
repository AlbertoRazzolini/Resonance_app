package it.epicode.resonance.mail;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.spring6.SpringTemplateEngine;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Le tre email nello stile di Resonance (decisione 115): oggetto, testi di sempre, logo dall'indirizzo pubblico,
 * colori e carattere scelti, e solo cio' che un client email accetta (stili in linea, nessuno script, nessun CSS o
 * font esterno). Usa i template veri; un servizio finto raccoglie oggetto e HTML invece di inviarli.
 */
class EmailTemplatesTest {

    // Con la barra finale: il logo non deve avere una doppia barra.
    private static final String PUBLIC_URL = "https://sito.test/";

    private CapturingEmailService service;

    @BeforeEach
    void setUp() {
        ClassLoaderTemplateResolver resolver = new ClassLoaderTemplateResolver();
        resolver.setPrefix("templates/");
        resolver.setSuffix(".html");
        resolver.setTemplateMode(TemplateMode.HTML);
        resolver.setCharacterEncoding("UTF-8");
        SpringTemplateEngine engine = new SpringTemplateEngine();
        engine.setTemplateResolver(resolver);
        service = new CapturingEmailService(engine, PUBLIC_URL);
    }

    @Test
    void verificationEmail_hasSubjectTextsAndCode() {
        service.sendVerificationCode("mario@example.com", "Mario", "123456");

        assertThat(service.subject).isEqualTo("Resonance · Conferma la tua email");
        assertThat(service.html)
                .contains("Conferma la tua email")
                .contains("Ciao <strong>Mario</strong>")
                .contains("Benvenuto/a su Resonance!")
                .contains(">123456<")
                .contains("Il codice scade tra 15 minuti.")
                .contains("Se non sei stato tu a registrarti, ignora questa email.");
    }

    @Test
    void passwordResetEmail_hasSubjectTextsAndCode() {
        service.sendPasswordResetCode("mario@example.com", "Mario", "654321");

        assertThat(service.subject).isEqualTo("Resonance · Reimposta la tua password");
        assertThat(service.html)
                .contains("Reimposta la tua password")
                .contains("Hai chiesto di reimpostare la password.")
                .contains(">654321<")
                .contains("Il codice scade tra 15 minuti.")
                .contains("Se non l'hai chiesto tu, ignora questa email: la tua password non cambia.");
    }

    @Test
    void passwordChangedEmail_hasSubjectAndTextsWithoutACode() {
        service.sendPasswordChanged("mario@example.com", "Mario");

        assertThat(service.subject).isEqualTo("Resonance · Password cambiata");
        assertThat(service.html)
                .contains("Password cambiata")
                .contains("La password del tuo account Resonance è stata cambiata.")
                .contains("Per sicurezza sei uscito/a da tutti i dispositivi")
                .contains("Se non sei stato tu, reimposta subito la password dalla pagina di accesso.")
                .doesNotContain("null");
    }

    @Test
    void everyEmail_showsTheLogoFromThePublicUrlWithAnAlternativeText() {
        for (String html : allEmails()) {
            assertThat(html)
                    .contains("src=\"https://sito.test/email-logo.png\"")
                    .contains("alt=\"RESONANCE\"")
                    .doesNotContain("sito.test//");
        }
    }

    @Test
    void everyEmail_usesTheAppColorsAndNotTheOldOnes() {
        for (String html : allEmails()) {
            assertThat(html)
                    .contains("#0a0a0a").contains("#121212").contains("#ffd60a")
                    .contains("#f5f5f5").contains("#a3a3a3")
                    .doesNotContain("#0f131d").doesNotContain("#111827").doesNotContain("Inter");
        }
    }

    @Test
    void everyEmail_usesTheCondensedFontStackWithFallbacks() {
        for (String html : allEmails()) {
            assertThat(html)
                    .contains("'Arial Narrow','Roboto Condensed','Helvetica Neue Condensed','Arial'")
                    .contains("text-transform:uppercase");
        }
    }

    @Test
    void everyEmail_hasTheSecurityNoticeWithTheYellowBarAndTheFooter() {
        for (String html : allEmails()) {
            assertThat(html)
                    .contains("border-left:3px solid #ffd60a")
                    .contains("Resonance")
                    .contains("Musica dal vivo e scena indie");
        }
    }

    @Test
    void everyEmail_isSafeForEmailClients() {
        // Solo stili in linea e tabelle: niente script, CSS o font esterni, niente blocco <style>.
        for (String html : allEmails()) {
            assertThat(html)
                    .contains("lang=\"it\"")
                    .contains("role=\"presentation\"")
                    .doesNotContain("<script").doesNotContain("<link").doesNotContain("@import")
                    .doesNotContain("@font-face").doesNotContain("<style");
            assertThat(html.split("<h1", -1)).as("un solo titolo <h1>").hasSize(2);
        }
    }

    private List<String> allEmails() {
        List<String> emails = new ArrayList<>();
        service.sendVerificationCode("mario@example.com", "Mario", "123456");
        emails.add(service.html);
        service.sendPasswordResetCode("mario@example.com", "Mario", "654321");
        emails.add(service.html);
        service.sendPasswordChanged("mario@example.com", "Mario");
        emails.add(service.html);
        return emails;
    }

    /**
     * Raccoglie oggetto e HTML dell'ultima email invece di spedirla.
     */
    private static class CapturingEmailService extends HtmlEmailService {

        String subject;
        String html;

        CapturingEmailService(TemplateEngine engine, String publicUrl) {
            super(engine, publicUrl);
        }

        @Override
        protected void send(String recipient, String displayName, String subject, String html) {
            this.subject = subject;
            this.html = html;
        }
    }
}
