package it.epicode.resonance.auth;

import it.epicode.resonance.support.IntegrationTest;
import it.epicode.resonance.user.Role;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import it.epicode.resonance.user.UserRole;
import it.epicode.resonance.user.UserRoleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Duration;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pulizia degli account mai verificati (decisione 96): dopo 24 ore dall'ultimo invio del codice di verifica l'account
 * sparisce con le sue righe collegate e il nome torna libero; verificati e account recenti non si toccano.
 */
class UnverifiedAccountCleanerTest extends IntegrationTest {

    @Autowired
    private UnverifiedAccountCleaner cleaner;

    @Autowired
    private UserRepository users;

    @Autowired
    private UserRoleRepository roles;

    @Autowired
    private EmailCodeService emailCodes;

    @Autowired
    private EmailCodeRepository codes;

    @Autowired
    private RefreshTokenRepository tokens;

    @Autowired
    private RefreshTokenService refreshTokens;

    @BeforeEach
    void truncateClock() {
        // Come in RefreshTokenServiceTest: PostgreSQL arrotonda i microsecondi, i test al bordo vogliono secondi esatti.
        clock.setInstant(clock.instant().truncatedTo(ChronoUnit.SECONDS));
    }

    @Test
    void deleteStale_removesAnUnverifiedAccountWhoseCodeWasSentMoreThan24HoursAgo() {
        User stale = unverifiedUser("vecchio@example.com", "Vecchio");
        emailCodes.issue(stale.getId(), EmailCodePurpose.EMAIL_VERIFICATION);
        clock.advance(Duration.ofHours(24).plusSeconds(1));

        cleaner.deleteStale();

        assertThat(users.findById(stale.getId())).isEmpty();
    }

    @Test
    void deleteStale_removesTheLinkedRowsAndFreesTheName() {
        User stale = unverifiedUser("vecchio@example.com", "Luca88");
        roles.save(new UserRole(stale.getId(), Role.FAN));
        emailCodes.issue(stale.getId(), EmailCodePurpose.EMAIL_VERIFICATION);
        clock.advance(Duration.ofHours(25));

        cleaner.deleteStale();

        // ON DELETE CASCADE: ruolo e codice spariscono con l'utente, senza errori di chiave esterna.
        assertThat(roles.findRolesByUserId(stale.getId())).isEmpty();
        assertThat(codes.count()).isZero();
        // Il nome e' di nuovo disponibile.
        users.saveAndFlush(new User("nuovo@example.com", "hash-di-prova", "luca88"));
        assertThat(users.count()).isEqualTo(1);
    }

    @Test
    void deleteStale_keepsAnAccountWhoseCodeWasSentLessThan24HoursAgo() {
        User recent = unverifiedUser("recente@example.com", "Recente");
        emailCodes.issue(recent.getId(), EmailCodePurpose.EMAIL_VERIFICATION);
        clock.advance(Duration.ofHours(23).plusMinutes(59));

        cleaner.deleteStale();

        assertThat(users.findById(recent.getId())).isPresent();
    }

    @Test
    void deleteStale_countsFromTheLastSend_notFromTheFirstRegistration() {
        // Chi si registra di nuovo dopo 25 ore riceve un codice nuovo: l'account riparte da li' e non va cancellato.
        User user = unverifiedUser("torna@example.com", "Torna");
        emailCodes.issue(user.getId(), EmailCodePurpose.EMAIL_VERIFICATION);
        clock.advance(Duration.ofHours(25));
        emailCodes.issue(user.getId(), EmailCodePurpose.EMAIL_VERIFICATION);

        cleaner.deleteStale();

        assertThat(users.findById(user.getId())).isPresent();
    }

    @Test
    void deleteStale_neverRemovesAVerifiedAccount() {
        User verified = unverifiedUser("verificato@example.com", "Verificato");
        emailCodes.issue(verified.getId(), EmailCodePurpose.EMAIL_VERIFICATION);
        verified.setEmailVerified(true);
        users.save(verified);
        clock.advance(Duration.ofDays(30));

        cleaner.deleteStale();

        assertThat(users.findById(verified.getId())).isPresent();
    }

    @Test
    void deleteStale_withoutAnyCode_countsFromTheCreationOfTheAccount() {
        User noCode = unverifiedUser("senzacodice@example.com", "Senza Codice");

        cleaner.deleteStale();
        assertThat(users.findById(noCode.getId())).isPresent();

        clock.advance(Duration.ofHours(25));
        cleaner.deleteStale();
        assertThat(users.findById(noCode.getId())).isEmpty();
    }

    @Test
    void deleteStale_removesTheRefreshTokensOfTheDeletedAccountsToo() {
        // Un account non verificato non fa login, ma se un token esistesse la chiave esterna non deve bloccare la pulizia.
        User stale = unverifiedUser("vecchio@example.com", "Vecchio");
        emailCodes.issue(stale.getId(), EmailCodePurpose.EMAIL_VERIFICATION);
        refreshTokens.create(stale.getId());
        assertThat(tokens.count()).isEqualTo(1);
        clock.advance(Duration.ofHours(25));

        cleaner.deleteStale();

        assertThat(tokens.count()).isZero();
        assertThat(users.count()).isZero();
    }

    private User unverifiedUser(String email, String displayName) {
        return users.saveAndFlush(new User(email, "hash-di-prova", displayName));
    }
}
