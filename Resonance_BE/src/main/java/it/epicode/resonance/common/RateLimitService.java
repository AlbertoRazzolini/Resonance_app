package it.epicode.resonance.common;

import org.springframework.boot.context.properties.bind.Bindable;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.core.env.Environment;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.EnumMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * Limiti di frequenza in memoria (progettazione, sezione 8.8): per ogni limite e ogni chiave (email o
 * id utente) si tengono gli istanti degli eventi dentro la finestra, che scorre. Si azzerano a ogni
 * riavvio: accettabile con una sola istanza.
 *
 * Uso tipico: consume() nel punto in cui deve scattare il 429. Il login usa invece
 * check/record/reset, perche' contano solo i tentativi falliti.
 */
@Service
public class RateLimitService {

    private final Clock clock;
    private final Map<RateLimit, Rule> rules = new EnumMap<>(RateLimit.class);
    private final Map<RateLimit, Map<String, Deque<Instant>>> registries = new EnumMap<>(RateLimit.class);

    public RateLimitService(Clock clock, Environment environment) {
        this.clock = clock;
        Map<RateLimit, Rule> configured = Binder.get(environment)
                .bind("app.rate-limits", Bindable.mapOf(RateLimit.class, Rule.class))
                .orElse(Map.of());
        // Un limite senza configurazione valida ferma l'avvio, invece di non limitare niente.
        for (RateLimit limit : RateLimit.values()) {
            Rule rule = configured.get(limit);
            if (rule == null || rule.max() < 1 || rule.window() == null
                    || rule.window().isNegative() || rule.window().isZero()) {
                throw new IllegalStateException(
                        "Configurazione mancante o non valida per app.rate-limits." + limit.configKey());
            }
            rules.put(limit, rule);
            registries.put(limit, new ConcurrentHashMap<>());
        }
    }

    /**
     * Controlla e registra in un solo passo (atomico per chiave): 429 se il limite e' gia' raggiunto.
     */
    public void consume(RateLimit limit, String key) {
        Instant now = clock.instant();
        Rule rule = rules.get(limit);
        boolean[] exceeded = {false};
        registries.get(limit).compute(key, (k, events) -> {
            Deque<Instant> recent = recent(events, now, rule);
            if (recent.size() >= rule.max()) {
                exceeded[0] = true;
            } else {
                recent.addLast(now);
            }
            return recent.isEmpty() ? null : recent;
        });
        if (exceeded[0]) {
            throw tooManyRequests();
        }
    }

    /**
     * 429 se il limite e' gia' raggiunto, senza registrare niente.
     */
    public void check(RateLimit limit, String key) {
        Instant now = clock.instant();
        Rule rule = rules.get(limit);
        boolean[] exceeded = {false};
        registries.get(limit).computeIfPresent(key, (k, events) -> {
            Deque<Instant> recent = recent(events, now, rule);
            exceeded[0] = recent.size() >= rule.max();
            return recent.isEmpty() ? null : recent;
        });
        if (exceeded[0]) {
            throw tooManyRequests();
        }
    }

    /**
     * Registra un evento senza controllare il limite (es. un login fallito).
     */
    public void record(RateLimit limit, String key) {
        Instant now = clock.instant();
        Rule rule = rules.get(limit);
        registries.get(limit).compute(key, (k, events) -> {
            Deque<Instant> recent = recent(events, now, rule);
            recent.addLast(now);
            // Oltre il massimo non serve ricordare altro: la memoria per chiave resta limitata.
            while (recent.size() > rule.max()) {
                recent.pollFirst();
            }
            return recent;
        });
    }

    /**
     * Cancella gli eventi di una chiave (es. dopo un login riuscito).
     */
    public void reset(RateLimit limit, String key) {
        registries.get(limit).remove(key);
    }

    /**
     * Toglie le chiavi senza eventi recenti: senza, la mappa crescerebbe con ogni email provata.
     * Usa fixedDelay, che parte all'avvio, perche' il servizio gratuito puo' essere sospeso.
     */
    @Scheduled(fixedDelay = 10, timeUnit = TimeUnit.MINUTES)
    public void cleanExpired() {
        Instant now = clock.instant();
        registries.forEach((limit, perKey) -> {
            Rule rule = rules.get(limit);
            perKey.keySet().forEach(key -> perKey.computeIfPresent(key, (k, events) -> {
                Deque<Instant> recent = recent(events, now, rule);
                return recent.isEmpty() ? null : recent;
            }));
        });
    }

    /**
     * Toglie dalla coda gli eventi usciti dalla finestra. Va chiamato solo dentro compute(), che
     * rende atomiche le operazioni sulla stessa chiave.
     */
    private static Deque<Instant> recent(Deque<Instant> events, Instant now, Rule rule) {
        Deque<Instant> queue = events == null ? new ArrayDeque<>() : events;
        Instant windowStart = now.minus(rule.window());
        while (!queue.isEmpty() && !queue.peekFirst().isAfter(windowStart)) {
            queue.pollFirst();
        }
        return queue;
    }

    private static AppException tooManyRequests() {
        return new AppException(ErrorCode.TOO_MANY_REQUESTS, "Troppe richieste: riprova più tardi");
    }

    /**
     * Regola letta dalla configurazione: al massimo "max" eventi in una finestra di durata "window".
     */
    public record Rule(int max, Duration window) {
    }
}
