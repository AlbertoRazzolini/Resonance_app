package it.epicode.resonance.auth;

import it.epicode.resonance.support.TestClockConfig;
import it.epicode.resonance.user.Role;
import it.epicode.resonance.user.User;
import it.epicode.resonance.user.UserRepository;
import it.epicode.resonance.user.UserRole;
import it.epicode.resonance.user.UserRoleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Prova su un server vero (porta casuale, profili test + prod) di cio' che fa Render: il TLS termina nel proxy,
 * che inoltra in HTTP con Host e X-Forwarded-Proto https, e il browser invia Origin https. Con
 * forward-headers-strategy=native del profilo prod login, refresh e logout passano e un Origin esterno
 * resta bloccato (progettazione, sezione 8.5; decisione 47). Le richieste si scrivono su un socket perche'
 * i client HTTP di Java non lasciano impostare l'header Host.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles({"test", "prod"})
@Import(TestClockConfig.class)
class ForwardedHeadersRealServerTest {

    private static final String HOST = "resonance.example.test";
    private static final String PASSWORD = "password-corretta";

    @Value("${local.server.port}")
    private int port;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private UserRepository users;

    @Autowired
    private UserRoleRepository roles;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private String email;

    @BeforeEach
    void createUser() {
        List<String> tables = jdbc.queryForList(
                "select tablename from pg_tables where schemaname = 'public' and tablename <> 'flyway_schema_history'",
                String.class);
        jdbc.execute("TRUNCATE TABLE " + String.join(", ", tables) + " CASCADE");
        // Email diversa a ogni test: il limite dei login falliti e' in memoria e sopravvive fra i test.
        email = "proxy-" + UUID.randomUUID() + "@example.com";
        User user = new User(email, passwordEncoder.encode(PASSWORD), "Mario");
        user.setEmailVerified(true);
        user = users.save(user);
        roles.save(new UserRole(user.getId(), Role.FAN));
    }

    @Test
    void behindProxy_loginWithHttpsOrigin_passesAndCookieIsSecure() throws IOException {
        Response response = login(proxyHeaders("https://" + HOST));

        assertThat(response.status()).isEqualTo(200);
        assertThat(response.header("Set-Cookie")).contains("resonance_refresh=").contains("Secure").contains("HttpOnly");
    }

    @Test
    void behindProxy_refreshAndLogoutWithHttpsOrigin_pass() throws IOException {
        Map<String, String> headers = proxyHeaders("https://" + HOST);
        String cookie = cookieValue(login(headers));
        headers.put("X-Requested-With", "XMLHttpRequest");

        headers.put("Cookie", "resonance_refresh=" + cookie);
        Response refreshed = send("POST", "/api/auth/refresh", headers, null);
        assertThat(refreshed.status()).isEqualTo(200);

        headers.put("Cookie", "resonance_refresh=" + cookieValue(refreshed));
        Response loggedOut = send("DELETE", "/api/auth/refresh", headers, null);
        assertThat(loggedOut.status()).isEqualTo(204);
        assertThat(loggedOut.header("Set-Cookie")).contains("Max-Age=0");
    }

    @Test
    void behindProxy_externalOrigin_isStillBlocked() throws IOException {
        Map<String, String> headers = proxyHeaders("https://evil.example");

        assertThat(login(headers).status()).isEqualTo(403);

        headers.put("X-Requested-With", "XMLHttpRequest");
        headers.put("Cookie", "resonance_refresh=valore-mai-emesso");
        assertThat(send("POST", "/api/auth/refresh", headers, null).status()).isEqualTo(403);
        assertThat(send("DELETE", "/api/auth/refresh", headers, null).status()).isEqualTo(403);
    }

    @Test
    void behindProxy_originNullAndForeignHostWithSamePrefix_areBlocked() throws IOException {
        assertThat(login(proxyHeaders("null")).status()).isEqualTo(403);
        assertThat(login(proxyHeaders("https://" + HOST + ".evil.example")).status()).isEqualTo(403);
    }

    @Test
    void withoutForwardedProto_httpsOrigin_isBlocked() throws IOException {
        // Documenta che serve l'header del proxy: senza, il server vede http e un Origin https e' cross-origin.
        Map<String, String> headers = proxyHeaders("https://" + HOST);
        headers.remove("X-Forwarded-Proto");

        assertThat(login(headers).status()).isEqualTo(403);
    }

    @Test
    void withoutProxy_httpOriginOfTheSameHost_passes() throws IOException {
        Map<String, String> headers = proxyHeaders("http://" + HOST);
        headers.remove("X-Forwarded-Proto");

        assertThat(login(headers).status()).isEqualTo(200);
    }

    // -------------------------------------------------------------- helper

    private Map<String, String> proxyHeaders(String origin) {
        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("Host", HOST);
        headers.put("X-Forwarded-Proto", "https");
        headers.put("Origin", origin);
        return headers;
    }

    private Response login(Map<String, String> headers) throws IOException {
        Map<String, String> withType = new LinkedHashMap<>(headers);
        withType.put("Content-Type", "application/json");
        return send("POST", "/api/auth/login", withType,
                "{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}");
    }

    private static String cookieValue(Response response) {
        String setCookie = response.header("Set-Cookie");
        assertThat(setCookie).startsWith("resonance_refresh=");
        return setCookie.substring("resonance_refresh=".length(), setCookie.indexOf(';'));
    }

    /**
     * Invia una richiesta HTTP/1.1 su un socket verso 127.0.0.1 (un indirizzo di loopback, quindi un proxy
     * interno per Tomcat) e legge la risposta fino alla chiusura della connessione.
     */
    private Response send(String method, String path, Map<String, String> headers, String body) throws IOException {
        try (Socket socket = new Socket("127.0.0.1", port)) {
            socket.setSoTimeout(15000);
            StringBuilder request = new StringBuilder(method + " " + path + " HTTP/1.1\r\n");
            headers.forEach((name, value) -> request.append(name).append(": ").append(value).append("\r\n"));
            byte[] payload = body == null ? new byte[0] : body.getBytes(StandardCharsets.UTF_8);
            request.append("Content-Length: ").append(payload.length).append("\r\n");
            request.append("Connection: close\r\n\r\n");
            socket.getOutputStream().write(request.toString().getBytes(StandardCharsets.UTF_8));
            socket.getOutputStream().write(payload);
            socket.getOutputStream().flush();
            return parse(socket.getInputStream());
        }
    }

    private static Response parse(InputStream in) throws IOException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        in.transferTo(buffer);
        String raw = buffer.toString(StandardCharsets.UTF_8);
        int split = raw.indexOf("\r\n\r\n");
        String head = split < 0 ? raw : raw.substring(0, split);
        String[] lines = head.split("\r\n");
        int status = Integer.parseInt(lines[0].split(" ")[1]);
        Map<String, String> headers = new LinkedHashMap<>();
        for (int i = 1; i < lines.length; i++) {
            int colon = lines[i].indexOf(':');
            if (colon > 0) {
                headers.putIfAbsent(lines[i].substring(0, colon).toLowerCase(), lines[i].substring(colon + 1).strip());
            }
        }
        return new Response(status, headers);
    }

    /**
     * Stato e header della risposta; il corpo non serve a queste prove. Il primo valore di ogni header.
     */
    private record Response(int status, Map<String, String> headers) {

        String header(String name) {
            return headers.get(name.toLowerCase());
        }
    }
}
