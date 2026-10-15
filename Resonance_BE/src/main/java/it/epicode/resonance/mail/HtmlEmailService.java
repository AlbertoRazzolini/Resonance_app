package it.epicode.resonance.mail;

import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

/**
 * Parte comune delle implementazioni che inviano davvero: oggetto e corpo HTML delle tre email, dai template
 * Thymeleaf in templates/mail/ (progettazione, sezione 9). Le sottoclassi implementano solo il trasporto in
 * {@link #send}, che non deve lanciare eccezioni.
 */
abstract class HtmlEmailService implements EmailService {

    private final TemplateEngine templateEngine;

    HtmlEmailService(TemplateEngine templateEngine) {
        this.templateEngine = templateEngine;
    }

    @Override
    public void sendVerificationCode(String recipient, String displayName, String code) {
        send(recipient, displayName, "Resonance - Conferma la tua email",
                render("mail/verification-code", displayName, code));
    }

    @Override
    public void sendPasswordResetCode(String recipient, String displayName, String code) {
        send(recipient, displayName, "Resonance - Reimposta la tua password",
                render("mail/password-reset-code", displayName, code));
    }

    @Override
    public void sendPasswordChanged(String recipient, String displayName) {
        send(recipient, displayName, "Resonance - Password cambiata",
                render("mail/password-changed", displayName, null));
    }

    // th:text nei template fa l'escape: un displayName con HTML non diventa markup (progettazione, sezione 8.6).
    private String render(String template, String displayName, String code) {
        Context context = new Context();
        context.setVariable("displayName", displayName);
        context.setVariable("code", code);
        return templateEngine.process(template, context);
    }

    /**
     * Spedisce l'email gia' pronta. Gli errori vanno nel log, non si rilanciano.
     */
    protected abstract void send(String recipient, String displayName, String subject, String html);
}
