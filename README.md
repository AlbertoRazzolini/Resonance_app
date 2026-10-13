# Resonance

Resonance è una web app di community musicale locale che mette in contatto **fan**, **musicisti** e
**host** (locali e organizzatori di eventi). È il progetto capstone del bootcamp Epicode
"Master Full-Stack AI Developer" di Firenze.

Il repository contiene:

| Cartella | Contenuto |
|---|---|
| `Resonance_BE/` | Backend Spring Boot (questo documento ne descrive l'avvio). |
| `Resonance_FE/` | Frontend React: non ancora presente, si sviluppa dal 20 ottobre. |
| `docs/` | Brief, progettazione, registro delle decisioni, schema del database, mappa del riuso. |

## Backend

Il backend espone le API REST e il canale WebSocket (STOMP) di Resonance. Le sue responsabilità:

- autenticazione con due token (access token Bearer di breve durata, refresh token in cookie
  `HttpOnly`) e verifica dell'email;
- ruoli di community (fan, musicista, host) e di piattaforma (admin, superadmin), con sospensione
  degli utenti;
- eventi con geolocalizzazione: concerti ufficiali (host) e indie event (musicisti), ricerca per raggio;
- annunci di collaborazione, feed con like, chat privata e notifiche live.

Stack: Java 25, Spring Boot 4.1.1, PostgreSQL con Flyway. Il design di riferimento è in
`docs/progettazione.md`.

> Stato: setup iniziale (fase F0). Struttura del progetto e profili di configurazione sono pronti;
> il database, le API e il resto arrivano con le card successive.

## Prerequisiti

- JDK 25
- Docker (per PostgreSQL in locale, dalla card F0-02)

## Avvio in locale

> **Attenzione:** in dev l'app non parte senza `JWT_SECRET` nella configurazione di avvio di IntelliJ.

_Sezione completata con la card F0-02 (PostgreSQL in Docker sulla porta 5433, profilo `dev`, avvio dal
terminale e da IntelliJ)._

## Variabili d'ambiente

Nessun segreto è scritto nei file del repository: i valori arrivano dall'ambiente (in locale dalla
configurazione di avvio di IntelliJ, su Render dal Blueprint o dalla dashboard).

| Variabile | Obbligatoria | Scopo |
|---|---|---|
| `SPRING_PROFILES_ACTIVE` | sì | Profilo attivo: `dev` in locale, `prod` su Render. |
| `PORT` | no | Porta del server; la imposta Render, default 8080. |
| `DATABASE_URL` | prod | URL del database fornito da Render. |
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | no | Sostituiscono i valori di sviluppo del database locale. |
| `JWT_SECRET` | sì | Segreto per firmare gli access token (almeno 32 byte, nessun valore predefinito). |
| `ACCESS_TOKEN_TTL` | no | Durata dell'access token (predefinito 15 minuti). |
| `REFRESH_TOKEN_TTL` | no | Durata del refresh token (predefinito 10 giorni). |
| `ALLOWED_ORIGIN` | no | Origini esterne ammesse per CORS e WebSocket (solo sviluppo, separate da virgola). |
| `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD` | per il bootstrap | Credenziali del primo SUPERADMIN, creato all'avvio se non esiste. |
| `BREVO_API_KEY`, `MAIL_FROM` | prod | Invio delle email tramite Brevo; mittente confermato in Brevo. |
| `GEOCODING_CONTACT` | sì | Contatto inserito nello User-Agent delle richieste a Nominatim. |

## Deploy

Non ancora disponibile. Il link verrà aggiunto dopo il primo deploy su Render.
