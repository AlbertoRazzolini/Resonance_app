/**
 * Informativa sui cookie: l'unico cookie dell'app è quello del refresh token (progettazione, sezione 4.4; testo
 * approvato dallo studente il 20 ottobre). Se ne nasce un altro, questo testo va riscritto.
 */
export function Component() {
  return (
    <article className="rs-legal">
      <h1>Informativa sui cookie</h1>
      <p className="text-body-secondary">Aggiornata il 20 ottobre 2026</p>
      <p className="text-body-secondary">
        Questo testo è dimostrativo: non è stato scritto da un avvocato e non ha valore legale.
      </p>

      <h2>Un solo cookie, tecnico</h2>
      <p>
        Resonance usa un solo cookie, che serve a tenerti collegato senza chiederti l'accesso a ogni
        visita.
      </p>
      <ul>
        <li>
          <strong>Nome:</strong> <code>resonance_refresh</code>
        </li>
        <li>
          <strong>Durata:</strong> 10 giorni. Si cancella quando esci.
        </li>
        <li>
          <strong>Protezione:</strong> il browser lo invia solo al servizio di accesso e gli script
          della pagina non possono leggerlo.
        </li>
      </ul>

      <h2>Cosa non usiamo</h2>
      <p>
        Nessun cookie di pubblicità, di statistiche o di tracciamento. Per questo non c'è un banner
        da accettare.
      </p>

      <h2>Come toglierlo</h2>
      <p>
        Esci dall'app, oppure cancellalo dalle impostazioni del browser: dovrai solo accedere di
        nuovo.
      </p>
    </article>
  )
}
