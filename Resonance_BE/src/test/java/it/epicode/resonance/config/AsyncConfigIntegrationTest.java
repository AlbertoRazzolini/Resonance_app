package it.epicode.resonance.config;

import it.epicode.resonance.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Esecutore dei metodi @Async (decisione 114): un pool dedicato alle email, con pool e coda limitati e, a coda
 * piena, l'invio nel thread della richiesta invece della perdita dell'email. Non e' un bean: un esecutore nel
 * contesto verrebbe preso da Spring Boot anche per i canali del WebSocket.
 */
@Import(AsyncConfigIntegrationTest.AsyncProbeConfig.class)
class AsyncConfigIntegrationTest extends IntegrationTest {

    @Autowired
    private AsyncConfig asyncConfig;

    @Autowired
    private AsyncProbe asyncProbe;

    @Autowired
    @Qualifier("clientInboundChannelExecutor")
    private ThreadPoolTaskExecutor inboundChannelExecutor;

    @Autowired
    @Qualifier("clientOutboundChannelExecutor")
    private ThreadPoolTaskExecutor outboundChannelExecutor;

    @Test
    void asyncExecutor_hasTheDeclaredLimits() {
        ThreadPoolTaskExecutor executor = (ThreadPoolTaskExecutor) asyncConfig.getAsyncExecutor();

        assertThat(executor.getCorePoolSize()).isEqualTo(2);
        assertThat(executor.getMaxPoolSize()).isEqualTo(4);
        assertThat(executor.getQueueCapacity()).isEqualTo(50);
    }

    @Test
    void asyncMethod_runsOnAThreadNamedEmail() throws Exception {
        String threadName = asyncProbe.threadName().get(5, TimeUnit.SECONDS);

        assertThat(threadName).startsWith("email-");
    }

    @Test
    void asyncExecutor_whenQueueIsFull_runsTheTaskInTheCallerThread() {
        // A coda piena nessuna email va persa: il task gira nel thread di chi lo invia.
        ThreadPoolTaskExecutor executor = (ThreadPoolTaskExecutor) asyncConfig.getAsyncExecutor();

        assertThat(executor.getThreadPoolExecutor().getRejectedExecutionHandler())
                .isInstanceOf(ThreadPoolExecutor.CallerRunsPolicy.class);
    }

    @Test
    void webSocketChannels_doNotShareTheEmailPool() {
        // Se il pool delle email fosse un bean, Spring Boot lo darebbe anche ai canali del WebSocket.
        assertThat(inboundChannelExecutor.getThreadNamePrefix()).doesNotStartWith("email-");
        assertThat(outboundChannelExecutor.getThreadNamePrefix()).doesNotStartWith("email-");
    }

    @Test
    void destroy_shutsDownTheEmailPool() {
        AsyncConfig config = new AsyncConfig();
        ThreadPoolTaskExecutor executor = (ThreadPoolTaskExecutor) config.getAsyncExecutor();

        config.destroy();

        assertThat(executor.getThreadPoolExecutor().isShutdown()).isTrue();
    }

    /**
     * Metodo @Async di prova: restituisce il nome del thread su cui gira.
     */
    public static class AsyncProbe {

        @Async
        public CompletableFuture<String> threadName() {
            return CompletableFuture.completedFuture(Thread.currentThread().getName());
        }
    }

    @TestConfiguration
    static class AsyncProbeConfig {

        @Bean
        AsyncProbe asyncProbe() {
            return new AsyncProbe();
        }
    }
}
