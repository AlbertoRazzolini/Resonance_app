package it.epicode.resonance.auth;

import it.epicode.resonance.user.Role;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import it.epicode.resonance.user.UserRole;
import it.epicode.resonance.user.UserRoleRepository;
import it.epicode.resonance.user.UserStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Set;

/**
 * Crea all'avvio il primo SUPERADMIN dalle variabili SUPERADMIN_EMAIL e SUPERADMIN_PASSWORD (progettazione,
 * sezione 4.12). E' idempotente: se esiste gia' un SUPERADMIN non fa nulla. Le credenziali non compaiono mai
 * in migrazioni, file versionati o log.
 */
@Component
public class SuperadminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SuperadminBootstrap.class);

    private static final int MIN_PASSWORD_LENGTH = 8;

    private final UserRepository users;
    private final UserRoleRepository roles;
    private final PasswordEncoder passwordEncoder;
    private final String email;
    private final String password;

    public SuperadminBootstrap(UserRepository users, UserRoleRepository roles, PasswordEncoder passwordEncoder,
                               @Value("${app.bootstrap.superadmin.email:}") String email,
                               @Value("${app.bootstrap.superadmin.password:}") String password) {
        this.users = users;
        this.roles = roles;
        this.passwordEncoder = passwordEncoder;
        this.email = email == null ? "" : email.strip().toLowerCase(Locale.ROOT);
        this.password = password == null ? "" : password;
    }

    /**
     * Esegue i passi della sezione 4.12. Una sola transazione: o l'utente e i suoi ruoli sono tutti scritti
     * o nessuno, cosi' un errore a meta' non lascia un SUPERADMIN senza password valida.
     */
    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (roles.existsByIdRole(Role.SUPERADMIN)) {
            return;
        }
        if (email.isEmpty() || password.isEmpty()) {
            log.warn("Nessun SUPERADMIN e variabili SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD mancanti: "
                    + "il primo SUPERADMIN non viene creato");
            return;
        }
        // Una password debole su un account con tutti i poteri non e' accettabile: meglio non avviare.
        // Il messaggio non riporta il valore. Stessa regola di registrazione e reset (decisione 113).
        if (password.length() < MIN_PASSWORD_LENGTH || PasswordMax72BytesValidator.exceedsLimit(password)
                || !PasswordHasLetterAndDigitValidator.hasLetterAndDigit(password)) {
            throw new IllegalStateException("SUPERADMIN_PASSWORD non valida: servono almeno "
                    + MIN_PASSWORD_LENGTH + " caratteri, al massimo 72 byte in UTF-8, almeno una lettera e un numero");
        }

        String passwordHash = passwordEncoder.encode(password);
        User user = users.findByEmail(email).map(existing -> promote(existing, passwordHash))
                .orElseGet(() -> create(passwordHash));
        grantMissingRoles(user);
        log.info("Primo SUPERADMIN pronto: {}", user.getEmail());
    }

    /**
     * Un utente con quell'email esiste gia': diventa verificato e ACTIVE, con la password delle variabili
     * d'ambiente. I campi di sospensione si azzerano insieme allo stato (vincolo ck_users_suspension).
     */
    private User promote(User existing, String passwordHash) {
        existing.setPasswordHash(passwordHash);
        existing.setEmailVerified(true);
        existing.clearSuspension();
        return users.save(existing);
    }

    private User create(String passwordHash) {
        User created = new User(email, passwordHash, "Superadmin");
        created.setEmailVerified(true);
        return users.saveAndFlush(created);
    }

    /** FAN c'e' sempre (non rimovibile); SUPERADMIN e' il motivo del bootstrap. Gli altri ruoli restano. */
    private void grantMissingRoles(User user) {
        Set<Role> current = roles.findRolesByUserId(user.getId());
        for (Role role : new Role[]{Role.FAN, Role.SUPERADMIN}) {
            if (!current.contains(role)) {
                roles.save(new UserRole(user.getId(), role));
            }
        }
    }
}
