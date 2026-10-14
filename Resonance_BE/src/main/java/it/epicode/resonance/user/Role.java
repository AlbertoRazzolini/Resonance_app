package it.epicode.resonance.user;

/**
 * Ruoli di community (FAN, MUSICIAN, HOST: additivi, senza gerarchia) e di piattaforma
 * (ADMIN, SUPERADMIN). Corrisponde all'enum PostgreSQL user_role (progettazione, sezione 3.1).
 */
public enum Role {
    FAN,
    MUSICIAN,
    HOST,
    ADMIN,
    SUPERADMIN
}
