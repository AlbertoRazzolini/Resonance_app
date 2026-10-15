package it.epicode.resonance.mail;

import com.fasterxml.jackson.annotation.JsonInclude;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.thymeleaf.TemplateEngine;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;

/**
 * Brevo via API HTTP ({@code POST /v3/smtp/email}) per la produzione (progettazione, sezione 9): Render
 * gratuito blocca le porte SMTP, HTTPS no. La chiave sta solo nel backend ({@code BREVO_API_KEY}) e va
 * nell'header {@code api-key}; il mittente ({@code MAIL_FROM}) deve essere confermato nell'account Brevo.
 */
@Service
@Profile("prod")
public class BrevoEmailService extends HtmlEmailService {

    private static final Logger log = LoggerFactory.getLogger(BrevoEmailService.class);

    private static final String SENDER_NAME = "Resonance";

    private final RestClient restClient;
    private final String apiKey;
    private final String sender;

    @Autowired
    public BrevoEmailService(TemplateEngine templateEngine, @Value("${app.mail.brevo.url}") String url,
                             @Value("${app.mail.brevo.api-key}") String apiKey,
                             @Value("${app.mail.from}") String sender,
                             @Value("${app.mail.brevo.timeout}") Duration timeout) {
        this(templateEngine, RestClient.builder().requestFactory(requestFactory(timeout)), url, apiKey, sender);
    }

    // Per i test: un builder legato a MockRestServiceServer.
    BrevoEmailService(TemplateEngine templateEngine, RestClient.Builder builder, String url, String apiKey,
                      String sender) {
        super(templateEngine);
        this.restClient = builder.baseUrl(url).build();
        this.apiKey = apiKey;
        this.sender = sender;
    }

    // Timeout breve su connessione e risposta: se Brevo non risponde, l'invio (gia' asincrono, dopo il commit)
    // fallisce nel log invece di tenere occupato un thread.
    private static JdkClientHttpRequestFactory requestFactory(Duration timeout) {
        HttpClient httpClient = HttpClient.newBuilder().connectTimeout(timeout).build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(timeout);
        return factory;
    }

    @Override
    protected void send(String recipient, String displayName, String subject, String html) {
        if (apiKey == null || apiKey.isBlank() || sender == null || sender.isBlank()) {
            log.error("BREVO_API_KEY o MAIL_FROM non impostate: email non inviata");
            return;
        }
        Request request = new Request(new Address(SENDER_NAME, sender),
                List.of(new Address(displayName, recipient)), subject, html);
        try {
            restClient.post()
                    .uri("/smtp/email")
                    .header("api-key", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientException e) {
            // Chiave non valida, mittente non confermato, quota finita o rete. Niente rilancio. Nel log solo il tipo
            // dell'eccezione e lo stato HTTP: il messaggio puo' contenere il corpo della risposta o dell'errore di
            // rete, e la richiesta contiene il codice appena generato (progettazione, sezione 8.9).
            String status = e instanceof RestClientResponseException response
                    ? String.valueOf(response.getStatusCode().value())
                    : "nessuno";
            log.error("Invio email fallito: {}, stato HTTP {}", e.getClass().getSimpleName(), status);
        }
    }

    // --- JSON di /smtp/email (solo i campi usati; i null non vengono inviati) ---

    @JsonInclude(JsonInclude.Include.NON_NULL)
    record Request(Address sender, List<Address> to, String subject, String htmlContent) {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    record Address(String name, String email) {
    }
}
