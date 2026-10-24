package it.epicode.resonance.config;

import org.springframework.beans.factory.DisposableBean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.AsyncConfigurer;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

/**
 * Attiva i metodi @Async (es. l'invio delle email dopo il commit, in EmailEventListener) e ne dichiara
 * l'esecutore (decisione 114).
 */
@Configuration
@EnableAsync
public class AsyncConfig implements AsyncConfigurer, DisposableBean {

    private final ThreadPoolTaskExecutor emailExecutor;

    /**
     * Pool delle email: piccolo per i 512 MB di Render, con coda limitata e, a coda piena, invio nel thread della
     * richiesta, cosi' l'email non si perde. Non e' un bean: un esecutore nel contesto verrebbe preso da Spring
     * Boot anche per i canali del WebSocket, che dividerebbero i thread con l'invio delle email.
     */
    public AsyncConfig() {
        this.emailExecutor = new ThreadPoolTaskExecutor();
        this.emailExecutor.setCorePoolSize(2);
        this.emailExecutor.setMaxPoolSize(4);
        this.emailExecutor.setQueueCapacity(50);
        this.emailExecutor.setThreadNamePrefix("email-");
        this.emailExecutor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        this.emailExecutor.initialize();
    }

    /**
     * Esecutore predefinito dei metodi @Async: dichiararlo qui elimina anche l'INFO "More than one TaskExecutor
     * bean found" di Spring.
     */
    @Override
    public Executor getAsyncExecutor() {
        return emailExecutor;
    }

    /**
     * Chiude il pool alla chiusura dell'applicazione, attendendo le email in coda.
     */
    @Override
    public void destroy() {
        emailExecutor.shutdown();
    }
}
