package it.epicode.resonance.event;

import it.epicode.resonance.support.IntegrationTest;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Mappatura di IndieEvent sulla tabella della V5 (progettazione, sezione 3.2): campi, enum dello stato, valori
 * di default e vincoli del database (l'avvio con ddl-auto validate controlla il resto).
 */
class IndieEventPersistenceTest extends IntegrationTest {

    @Autowired
    private IndieEventRepository events;

    @Autowired
    private UserRepository users;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void saveAndReload_keepsAllFields() {
        User musician = musician();
        IndieEvent event = event(musician);
        event.setDescription("Serata di prova");
        event.setGenreTags(List.of("rock", "jazz"));
        event.setCoverImageUrl("https://example.com/cover.jpg");
        event.setFree(true);
        event.setStatus(IndieEventStatus.DRAFT);
        events.saveAndFlush(event);

        IndieEvent found = events.findById(event.getId()).orElseThrow();

        assertThat(found.getMusician().getId()).isEqualTo(musician.getId());
        assertThat(found.getTitle()).isEqualTo("Serata di prova");
        assertThat(found.getDescription()).isEqualTo("Serata di prova");
        assertThat(found.getVenueName()).isEqualTo("Locale Test");
        assertThat(found.getAddress()).isEqualTo("Piazza della Signoria, Firenze");
        assertThat(found.getLatitude()).isEqualTo(43.7696);
        assertThat(found.getLongitude()).isEqualTo(11.2558);
        assertThat(found.getEventDate()).isEqualTo(event.getEventDate());
        assertThat(found.getGenreTags()).containsExactly("rock", "jazz");
        assertThat(found.getCoverImageUrl()).isEqualTo("https://example.com/cover.jpg");
        assertThat(found.isFree()).isTrue();
        assertThat(found.getStatus()).isEqualTo(IndieEventStatus.DRAFT);
        // createdAt arriva dal DEFAULT now() del database.
        assertThat(found.getCreatedAt()).isNotNull();
    }

    @Test
    void newEvent_isPublishedPaidAndVisibleByDefault() {
        IndieEvent event = events.saveAndFlush(event(musician()));

        IndieEvent found = events.findById(event.getId()).orElseThrow();

        assertThat(found.getStatus()).isEqualTo(IndieEventStatus.PUBLISHED);
        assertThat(found.isFree()).isFalse();
        assertThat(found.getGenreTags()).isEmpty();
        assertThat(found.getModeration().isHidden()).isFalse();
    }

    @Test
    void hide_isPersisted() {
        User musician = musician();
        IndieEvent event = events.saveAndFlush(event(musician));
        Instant when = Instant.parse("2026-10-16T10:00:00Z");

        event.getModeration().hide(musician.getId(), "annullato", when);
        events.saveAndFlush(event);
        IndieEvent found = events.findById(event.getId()).orElseThrow();

        assertThat(found.getModeration().isHidden()).isTrue();
        assertThat(found.getModeration().getHiddenAt()).isEqualTo(when);
        assertThat(found.getModeration().getHiddenBy()).isEqualTo(musician.getId());
        assertThat(found.getModeration().getHiddenReason()).isEqualTo("annullato");
    }

    @Test
    void hiddenAtWithoutHiddenBy_violatesTheCheckConstraint() {
        IndieEvent event = events.saveAndFlush(event(musician()));

        assertThatThrownBy(() -> jdbc.update("update indie_events set hidden_at = now() where id = ?",
                event.getId()))
                .hasMessageContaining("ck_indie_events_hidden");
    }

    @Test
    void coordinatesOutOfRange_violateTheCheckConstraint() {
        IndieEvent event = event(musician());
        event.setLongitude(181.0);

        assertThatThrownBy(() -> events.saveAndFlush(event))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("ck_indie_events_coordinates");
    }

    @Test
    void unknownMusicianOrStatus_isRejectedByTheDatabase() {
        assertThatThrownBy(() -> jdbc.update("""
                insert into indie_events (musician_id, title, venue_name, address, latitude, longitude, event_date)
                values (?, 't', 'v', 'a', 1, 1, now())""", UUID.randomUUID()))
                .hasMessageContaining("fk_indie_events_musician");
        assertThatThrownBy(() -> jdbc.update("""
                insert into indie_events (musician_id, title, venue_name, address, latitude, longitude, event_date, status)
                values (?, 't', 'v', 'a', 1, 1, now(), 'ARCHIVED')""", musician().getId()))
                .hasMessageContaining("indie_event_status");
    }

    private User musician() {
        User musician = new User("musicista@example.com", "hash-di-prova", "Musicista");
        musician.setEmailVerified(true);
        return users.save(musician);
    }

    private IndieEvent event(User musician) {
        return new IndieEvent(musician, "Serata di prova", "Locale Test", "Piazza della Signoria, Firenze",
                43.7696, 11.2558, Instant.parse("2027-01-10T20:00:00Z"));
    }
}
