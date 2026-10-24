package it.epicode.resonance.mail;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.spring6.SpringTemplateEngine;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

import java.io.IOException;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.client.ExpectedCount.never;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/**
 * Invio via Brevo (progettazione, sezione 9) con un server HTTP finto: header api-key, mittente, destinatario
 * e corpo reso dal template vero; chiave o mittente mancanti e risposte d'errore non devono lanciare, e il log
 * degli errori non deve mai contenere il codice, il corpo della richiesta o la chiave.
 */
class BrevoEmailServiceTest {

    private static final String URL = "https://api.brevo.test/v3";

    private MockRestServiceServer server;
    private RestClient.Builder builder;
    private TemplateEngine engine;
    private ListAppender<ILoggingEvent> appender;

    @BeforeEach
    void setUp() {
        builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        // Motore Thymeleaf con i template veri di src/main/resources/templates.
        ClassLoaderTemplateResolver resolver = new ClassLoaderTemplateResolver();
        resolver.setPrefix("templates/");
        resolver.setSuffix(".html");
        resolver.setTemplateMode(TemplateMode.HTML);
        resolver.setCharacterEncoding("UTF-8");
        engine = new SpringTemplateEngine();
        ((SpringTemplateEngine) engine).setTemplateResolver(resolver);

        // Si ascoltano i log del service per controllare cosa viene scritto in caso di errore.
        appender = new ListAppender<>();
        appender.start();
        brevoLogger().addAppender(appender);
    }

    @AfterEach
    void detachAppender() {
        brevoLogger().detachAppender(appender);
    }

    private static Logger brevoLogger() {
        return (Logger) LoggerFactory.getLogger(BrevoEmailService.class);
    }

    @Test
    void sendVerificationCode_postsToBrevoWithApiKeySenderRecipientAndCode() {
        server.expect(requestTo(URL + "/smtp/email"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("api-key", "chiave-di-prova"))
                .andExpect(header("Content-Type", MediaType.APPLICATION_JSON_VALUE))
                .andExpect(jsonPath("$.sender.email").value("no-reply@resonance.test"))
                .andExpect(jsonPath("$.sender.name").value("Resonance"))
                .andExpect(jsonPath("$.to[0].email").value("mario@example.com"))
                .andExpect(jsonPath("$.to[0].name").value("Mario"))
                .andExpect(jsonPath("$.subject").value("Resonance · Conferma la tua email"))
                .andExpect(jsonPath("$.htmlContent").value(containsString("123456")))
                .andRespond(withSuccess("{\"messageId\":\"x\"}", MediaType.APPLICATION_JSON));

        service("chiave-di-prova", "no-reply@resonance.test")
                .sendVerificationCode("mario@example.com", "Mario", "123456");

        server.verify();
    }

    @Test
    void sendVerificationCode_escapesHtmlInTheDisplayName() {
        // Un displayName con markup non deve diventare HTML nell'email (progettazione, sezione 8.6).
        server.expect(requestTo(URL + "/smtp/email"))
                .andExpect(jsonPath("$.htmlContent").value(allOf(
                        containsString("&lt;script&gt;"),
                        not(containsString("<script>")))))
                .andRespond(withSuccess());

        service("chiave-di-prova", "no-reply@resonance.test")
                .sendVerificationCode("mario@example.com", "<script>alert(1)</script>", "123456");

        server.verify();
    }

    @Test
    void sendPasswordResetCodeAndPasswordChanged_renderTheirOwnTemplates() {
        server.expect(requestTo(URL + "/smtp/email"))
                .andExpect(jsonPath("$.subject").value("Resonance · Reimposta la tua password"))
                .andExpect(jsonPath("$.htmlContent").value(containsString("654321")))
                .andRespond(withSuccess());
        server.expect(requestTo(URL + "/smtp/email"))
                .andExpect(jsonPath("$.subject").value("Resonance · Password cambiata"))
                .andRespond(withSuccess());

        BrevoEmailService service = service("chiave-di-prova", "no-reply@resonance.test");
        service.sendPasswordResetCode("mario@example.com", "Mario", "654321");
        service.sendPasswordChanged("mario@example.com", "Mario");

        server.verify();
    }

    @Test
    void send_withoutApiKey_makesNoRequestAndDoesNotThrow() {
        server.expect(never(), requestTo(URL + "/smtp/email")).andRespond(withSuccess());

        assertThatCode(() -> service("", "no-reply@resonance.test")
                .sendVerificationCode("mario@example.com", "Mario", "123456")).doesNotThrowAnyException();

        server.verify();
    }

    @Test
    void send_withoutSender_makesNoRequestAndDoesNotThrow() {
        server.expect(never(), requestTo(URL + "/smtp/email")).andRespond(withSuccess());

        assertThatCode(() -> service("chiave-di-prova", "")
                .sendVerificationCode("mario@example.com", "Mario", "123456")).doesNotThrowAnyException();

        server.verify();
    }

    @Test
    void send_whenBrevoAnswersWithAnError_doesNotThrow() {
        // La richiesta dell'utente e' gia' andata a buon fine: un errore di Brevo finisce solo nel log.
        server.expect(requestTo(URL + "/smtp/email"))
                .andExpect(content().string(containsString("123456")))
                .andRespond(withStatus(HttpStatus.UNAUTHORIZED));

        assertThatCode(() -> service("chiave-sbagliata", "no-reply@resonance.test")
                .sendVerificationCode("mario@example.com", "Mario", "123456")).doesNotThrowAnyException();

        server.verify();
    }

    @Test
    void send_whenBrevoAnswersWithAnError_logsOnlyTheExceptionTypeAndTheStatus() {
        // Brevo risponde con un corpo che contiene il codice: il messaggio dell'eccezione lo riporterebbe.
        server.expect(requestTo(URL + "/smtp/email"))
                .andRespond(withStatus(HttpStatus.BAD_REQUEST)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"message\":\"codice 123456 rifiutato\",\"htmlContent\":\"<p>123456</p>\"}"));

        service("chiave-di-prova", "no-reply@resonance.test")
                .sendVerificationCode("mario@example.com", "Mario", "123456");

        String logged = loggedText();
        assertThat(logged).contains("BadRequest").contains("400");
        assertNoSecretIn(logged);
    }

    @Test
    void send_whenTheNetworkFails_logsOnlyTheExceptionTypeAndNeverTheCode() {
        server.expect(requestTo(URL + "/smtp/email"))
                .andRespond(request -> {
                    throw new IOException("connessione caduta con codice 123456 e htmlContent");
                });

        service("chiave-di-prova", "no-reply@resonance.test")
                .sendVerificationCode("mario@example.com", "Mario", "123456");

        String logged = loggedText();
        assertThat(logged).contains("ResourceAccessException").contains("nessuno");
        assertNoSecretIn(logged);
    }

    private String loggedText() {
        return appender.list.stream().map(ILoggingEvent::getFormattedMessage).collect(Collectors.joining("\n"));
    }

    // Nel log non devono finire ne' il codice, ne' il corpo della richiesta (HTML e JSON), ne' la chiave.
    private static void assertNoSecretIn(String logged) {
        assertThat(logged).doesNotContain("123456").doesNotContain("htmlContent").doesNotContain("<p>")
                .doesNotContain("mario@example.com").doesNotContain("chiave-di-prova");
    }

    private BrevoEmailService service(String apiKey, String sender) {
        return new BrevoEmailService(engine, builder, URL, apiKey, sender, "https://sito.test");
    }
}
