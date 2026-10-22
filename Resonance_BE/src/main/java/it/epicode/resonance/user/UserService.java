package it.epicode.resonance.user;

import it.epicode.resonance.common.AppException;
import it.epicode.resonance.common.ErrorCode;
import it.epicode.resonance.user.dto.MeResponse;
import it.epicode.resonance.user.dto.PublicUserResponse;
import it.epicode.resonance.user.dto.UpdateProfileRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Profilo dell'utente e profilo pubblico (progettazione, sezioni 5.3 e 6.5).
 */
@Service
public class UserService {

    private final UserRepository users;
    private final UserRoleRepository userRoles;
    private final DisplayNamePolicy displayNames;

    public UserService(UserRepository users, UserRoleRepository userRoles, DisplayNamePolicy displayNames) {
        this.users = users;
        this.userRoles = userRoles;
        this.displayNames = displayNames;
    }

    /**
     * Profilo dell'utente autenticato, con i ruoli letti dal database in questo momento.
     */
    @Transactional(readOnly = true)
    public MeResponse getMe(UUID userId) {
        return meOf(findUser(userId));
    }

    /**
     * Profilo pubblico: un utente inesistente o non verificato e' indistinguibile da uno che non c'e' (404).
     */
    @Transactional(readOnly = true)
    public PublicUserResponse getPublic(UUID userId) {
        User user = users.findById(userId)
                .filter(User::isEmailVerified)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Utente non trovato"));
        return PublicUserResponse.from(user, userRoles.findRolesByUserId(userId));
    }

    /**
     * Modifica parziale del profilo (progettazione, sezioni 6.1 e 6.5): cambia solo i campi inviati. Null =
     * invariato; per i testi facoltativi la stringa vuota svuota il campo e lo salva come NULL. La richiesta
     * e' gia' validata, quindi le coordinate sono entrambe presenti o entrambe assenti. Un nome nuovo deve essere
     * disponibile: riservato 400, gia' preso 409 (decisione 96).
     */
    @Transactional
    public MeResponse updateProfile(UUID userId, UpdateProfileRequest request) {
        User user = findUser(userId);
        // Un nome identico a quello di adesso non si controlla: il frontend lo rimanda a ogni salvataggio, e un
        // nome riservato gia' presente (il superadmin) non deve bloccare la modifica della bio (decisione 96).
        if (request.displayName() != null && !request.displayName().equals(user.getDisplayName())) {
            displayNames.requireAvailable(request.displayName(), userId);
            user.setDisplayName(request.displayName());
        }
        if (request.avatarUrl() != null) {
            user.setAvatarUrl(emptyToNull(request.avatarUrl()));
        }
        if (request.bio() != null) {
            user.setBio(emptyToNull(request.bio()));
        }
        if (request.city() != null) {
            user.setCity(emptyToNull(request.city()));
        }
        if (request.latitude() != null && request.longitude() != null) {
            user.setLatitude(request.latitude());
            user.setLongitude(request.longitude());
        }
        // saveAndFlush: con due modifiche insieme allo stesso nome l'indice unico scatta qui e diventa un 409,
        // non un errore al commit dopo la fine del metodo.
        return meOf(users.saveAndFlush(user));
    }

    /**
     * Smette di condividere la posizione (progettazione, sezione 6.5). Idempotente: senza coordinate non cambia nulla.
     */
    @Transactional
    public MeResponse removeLocation(UUID userId) {
        User user = findUser(userId);
        user.setLatitude(null);
        user.setLongitude(null);
        return meOf(users.save(user));
    }

    /**
     * Attiva un ruolo di community sul profilo (progettazione, sezione 5.3). Idempotente; uno dei due ruoli
     * non implica l'altro. Le richieste arrivano da un utente autenticato, quindi esiste gia'.
     */
    @Transactional
    public MeResponse activateRole(UUID userId, Role role) {
        if (role != Role.MUSICIAN && role != Role.HOST) {
            throw new IllegalArgumentException("Ruolo non attivabile da solo: " + role);
        }
        User user = findUser(userId);
        userRoles.addIfAbsent(userId, role.name());
        return meOf(user);
    }

    private static String emptyToNull(String value) {
        return value.isEmpty() ? null : value;
    }

    private User findUser(UUID userId) {
        return users.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Utente non trovato"));
    }

    private MeResponse meOf(User user) {
        return MeResponse.from(user, userRoles.findRolesByUserId(user.getId()));
    }
}
