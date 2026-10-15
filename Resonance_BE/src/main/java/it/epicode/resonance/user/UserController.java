package it.epicode.resonance.user;

import it.epicode.resonance.auth.AuthenticatedUser;
import it.epicode.resonance.user.dto.MeResponse;
import it.epicode.resonance.user.dto.PublicUserResponse;
import it.epicode.resonance.user.dto.UpdateProfileRequest;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Endpoint degli utenti (progettazione, sezione 6.5): profilo proprio e profilo pubblico.
 */
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    /**
     * Profilo dell'utente autenticato.
     */
    @GetMapping("/me")
    public MeResponse me(@AuthenticationPrincipal AuthenticatedUser user) {
        return userService.getMe(user.id());
    }

    /**
     * Modifica parziale del profilo: solo i campi inviati cambiano (progettazione, sezione 6.1).
     */
    @PatchMapping("/me")
    public MeResponse updateProfile(@AuthenticationPrincipal AuthenticatedUser user,
                                    @Valid @RequestBody UpdateProfileRequest request) {
        return userService.updateProfile(user.id(), request);
    }

    /**
     * Smette di condividere la posizione: nel PATCH null significa "invariato", quindi serve un endpoint a parte.
     */
    @DeleteMapping("/me/location")
    public MeResponse removeLocation(@AuthenticationPrincipal AuthenticatedUser user) {
        return userService.removeLocation(user.id());
    }

    /**
     * Attiva il ruolo MUSICIAN sul proprio profilo (progettazione, sezione 5.3). Idempotente.
     */
    @PostMapping("/me/roles/musician")
    public MeResponse activateMusician(@AuthenticationPrincipal AuthenticatedUser user) {
        return userService.activateRole(user.id(), Role.MUSICIAN);
    }

    /**
     * Attiva il ruolo HOST sul proprio profilo (progettazione, sezione 5.3). Idempotente.
     */
    @PostMapping("/me/roles/host")
    public MeResponse activateHost(@AuthenticationPrincipal AuthenticatedUser user) {
        return userService.activateRole(user.id(), Role.HOST);
    }

    /**
     * Profilo pubblico di un utente: senza login, senza email e senza coordinate.
     */
    @GetMapping("/{id}")
    public PublicUserResponse publicProfile(@PathVariable UUID id) {
        return userService.getPublic(id);
    }
}
