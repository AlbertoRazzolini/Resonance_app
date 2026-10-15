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
 * Mappatura di OfficialConcert sulla tabella della V4 (progettazione, sezione 3.2): campi, array dei generi,
 * moderazione incorporata e vincoli del database (l'avvio con ddl-auto validate controlla il resto).
 */
class OfficialConcertPersistenceTest extends IntegrationTest {

    @Autowired
    private OfficialConcertRepository concerts;

    @Autowired
    private UserRepository users;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void saveAndReload_keepsAllFields() {
        User host = host();
        OfficialConcert concert = concert(host);
        concert.setDescription("Serata di prova");
        concert.setGenreTags(List.of("rock", "jazz"));
        concert.setCoverImageUrl("https://example.com/cover.jpg");
        concert.setExternalTicketUrl("https://example.com/biglietti");
        concerts.saveAndFlush(concert);

        OfficialConcert found = concerts.findById(concert.getId()).orElseThrow();

        assertThat(found.getHost().getId()).isEqualTo(host.getId());
        assertThat(found.getTitle()).isEqualTo("Concerto di prova");
        assertThat(found.getDescription()).isEqualTo("Serata di prova");
        assertThat(found.getVenueName()).isEqualTo("Teatro Test");
        assertThat(found.getAddress()).isEqualTo("Piazza della Signoria, Firenze");
        assertThat(found.getLatitude()).isEqualTo(43.7696);
        assertThat(found.getLongitude()).isEqualTo(11.2558);
        assertThat(found.getEventDate()).isEqualTo(concert.getEventDate());
        assertThat(found.getGenreTags()).containsExactly("rock", "jazz");
        assertThat(found.getCoverImageUrl()).isEqualTo("https://example.com/cover.jpg");
        assertThat(found.getExternalTicketUrl()).isEqualTo("https://example.com/biglietti");
        // createdAt arriva dal DEFAULT now() del database.
        assertThat(found.getCreatedAt()).isNotNull();
    }

    @Test
    void newConcert_isNotHiddenAfterReload() {
        // Tutte le colonne di moderazione sono nulle: l'embeddable deve comunque esistere (non null).
        OfficialConcert concert = concerts.saveAndFlush(concert(host()));

        OfficialConcert found = concerts.findById(concert.getId()).orElseThrow();

        assertThat(found.getModeration()).isNotNull();
        assertThat(found.getModeration().isHidden()).isFalse();
    }

    @Test
    void hide_isPersisted() {
        User host = host();
        OfficialConcert concert = concerts.saveAndFlush(concert(host));
        Instant when = Instant.parse("2026-10-16T10:00:00Z");

        concert.getModeration().hide(host.getId(), "annullato", when);
        concerts.saveAndFlush(concert);
        OfficialConcert found = concerts.findById(concert.getId()).orElseThrow();

        assertThat(found.getModeration().isHidden()).isTrue();
        assertThat(found.getModeration().getHiddenAt()).isEqualTo(when);
        assertThat(found.getModeration().getHiddenBy()).isEqualTo(host.getId());
        assertThat(found.getModeration().getHiddenReason()).isEqualTo("annullato");
    }

    @Test
    void emptyGenreTags_areStoredAsEmptyArray() {
        OfficialConcert concert = concerts.saveAndFlush(concert(host()));

        assertThat(concerts.findById(concert.getId()).orElseThrow().getGenreTags()).isEmpty();
    }

    @Test
    void hiddenAtWithoutHiddenBy_violatesTheCheckConstraint() {
        OfficialConcert concert = concerts.saveAndFlush(concert(host()));

        // ck_official_concerts_hidden: hidden_at e hidden_by vanno insieme (sezione 3.2).
        assertThatThrownBy(() -> jdbc.update("update official_concerts set hidden_at = now() where id = ?",
                concert.getId()))
                .hasMessageContaining("ck_official_concerts_hidden");
    }

    @Test
    void reasonWithoutHiddenAt_violatesTheCheckConstraint() {
        OfficialConcert concert = concerts.saveAndFlush(concert(host()));

        assertThatThrownBy(() -> jdbc.update("update official_concerts set hidden_reason = 'x' where id = ?",
                concert.getId()))
                .hasMessageContaining("ck_official_concerts_hidden");
    }

    @Test
    void coordinatesOutOfRange_violateTheCheckConstraint() {
        OfficialConcert concert = concert(host());
        concert.setLatitude(91.0);

        assertThatThrownBy(() -> concerts.saveAndFlush(concert))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("ck_official_concerts_coordinates");
    }

    @Test
    void unknownHost_violatesTheForeignKey() {
        assertThatThrownBy(() -> jdbc.update("""
                insert into official_concerts (host_id, title, venue_name, address, latitude, longitude, event_date)
                values (?, 't', 'v', 'a', 1, 1, now())""", UUID.randomUUID()))
                .hasMessageContaining("fk_official_concerts_host");
    }

    private User host() {
        User host = new User("host@example.com", "hash-di-prova", "Host");
        host.setEmailVerified(true);
        return users.save(host);
    }

    private OfficialConcert concert(User host) {
        return new OfficialConcert(host, "Concerto di prova", "Teatro Test", "Piazza della Signoria, Firenze",
                43.7696, 11.2558, Instant.parse("2027-01-10T20:00:00Z"));
    }
}
