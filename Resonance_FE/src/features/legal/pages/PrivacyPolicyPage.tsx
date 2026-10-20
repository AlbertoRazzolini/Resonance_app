import { PRIVACY_CONTACT } from '@/config'

/**
 * Informativa sulla privacy: solo ciò che l'app fa davvero (decisione 83, testo approvato dallo studente il 20
 * ottobre). Il cookie ha la sua pagina. Se l'app cambia i dati che tratta, questo testo va riscritto.
 */
export function Component() {
  return (
    <article className="rs-legal">
      <h1>Informativa sulla privacy</h1>
      <p className="text-body-secondary">Aggiornata il 20 ottobre 2026</p>

      <h2>Chi siamo</h2>
      <p>
        Resonance è un'app per trovare concerti ed eventi musicali vicino a te e metterti in
        contatto con altri musicisti e organizzatori. È un progetto in sviluppo.
      </p>

      <h2>Quali dati raccogliamo</h2>
      <ul>
        <li>
          <strong>Account:</strong> email, nome visibile e password. La password è conservata solo
          cifrata, mai in chiaro.
        </li>
        <li>
          <strong>Profilo (facoltativo):</strong> indirizzo della foto, biografia, città e, se la
          inserisci, la tua posizione.
        </li>
        <li>
          <strong>Quello che pubblichi:</strong> eventi, annunci, post, "mi piace", richieste di
          amicizia e messaggi.
        </li>
        <li>
          <strong>Posizione del browser:</strong> se dai il permesso, serve solo a cercare gli
          eventi vicini a te. Non la salviamo nel tuo profilo.
        </li>
        <li>
          <strong>Dati tecnici:</strong> quelli necessari alla sicurezza e a limitare gli abusi,
          come il numero di richieste.
        </li>
      </ul>

      <h2>A cosa servono</h2>
      <p>
        A far funzionare il tuo account, mostrarti eventi vicini, permettere i messaggi fra utenti e
        proteggere il servizio con la moderazione.
      </p>

      <h2>Servizi esterni</h2>
      <ul>
        <li>
          <strong>Brevo:</strong> invia le email con i codici di verifica e di reset, quindi riceve
          il tuo indirizzo email.
        </li>
        <li>
          <strong>Nominatim (OpenStreetMap):</strong> riceve l'indirizzo degli eventi che pubblichi,
          per trovarne le coordinate.
        </li>
        <li>
          <strong>OpenFreeMap:</strong> fornisce le mappe, quindi vede il tuo indirizzo IP e la zona
          che guardi.
        </li>
        <li>
          <strong>Render:</strong> ospita l'app.
        </li>
      </ul>

      <h2>Link a siti esterni</h2>
      <p>
        Alcuni eventi hanno un link verso altri siti, per esempio per comprare i biglietti.
        Resonance non vende biglietti e non gestisce pagamenti: quando apri quei link lasci l'app e
        valgono le regole sulla privacy del sito che visiti.
      </p>

      <h2>Chi vede cosa</h2>
      <p>
        Eventi, annunci, post e profilo pubblico (nome, foto, biografia, città, ruoli) li vede
        chiunque, anche senza account. I messaggi li vedono solo le persone coinvolte.
      </p>

      <h2>Conservazione e moderazione</h2>
      <p>
        Quando un contenuto viene tolto, da te o da un amministratore, viene nascosto, non
        cancellato subito. Un amministratore può nascondere contenuti e sospendere un account che
        non rispetta le regole.
      </p>

      <h2>I tuoi diritti</h2>
      <p>
        Per chiedere l'accesso, la correzione o la cancellazione dei tuoi dati scrivi a{' '}
        <a href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>. Al momento l'app non ha una
        funzione per cancellare l'account da sola.
      </p>
    </article>
  )
}
