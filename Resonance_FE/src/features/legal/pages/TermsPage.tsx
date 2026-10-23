import { APPEAL_CONTACT, PRIVACY_CONTACT } from '@/config'

/**
 * Termini di servizio: solo regole che l'app applica davvero (messaggi, moderazione, sospensione; progettazione,
 * sezioni 5.5 e 6.9). Testo approvato dallo studente il 23 ottobre (decisione 85); è dimostrativo, non scritto da un
 * avvocato, e la pagina lo dice.
 */
export function Component() {
  return (
    <article className="rs-legal">
      <h1>Termini di servizio</h1>
      <p className="text-body-secondary">Aggiornata il 23 ottobre 2026</p>
      <p className="text-body-secondary">
        Questo testo è dimostrativo: non è stato scritto da un avvocato e non ha valore legale.
      </p>

      <h2>Cos'è questo servizio</h2>
      <p>
        Resonance è un progetto in sviluppo: serve a trovare concerti ed eventi musicali vicini e a
        mettersi in contatto con musicisti e organizzatori. Lo offriamo così com'è, senza garanzie:
        può cambiare o fermarsi.
      </p>

      <h2>Il tuo account</h2>
      <p>
        Dai dati veri, tieni al sicuro la password e rispondi di ciò che si fa con il tuo account.
      </p>

      <h2>Cosa pubblichi</h2>
      <p>
        Sei responsabile di eventi, annunci, post e messaggi che scrivi. Non pubblicare contenuti
        illegali, offensivi, molesti o che violano i diritti di altri. Le informazioni degli eventi
        vanno controllate presso chi li organizza.
      </p>

      <h2>Messaggi</h2>
      <p>
        Si può scrivere solo ad amici, o dopo una candidatura o un contatto di un evento.
      </p>

      <h2>Moderazione</h2>
      <p>
        Un amministratore può nascondere contenuti e sospendere un account che non rispetta queste
        regole. Se vieni sospeso, l'app ti dice il motivo e, se c'è, fino a quando.
      </p>

      <h2>Ricorsi</h2>
      <p>
        Per contestare una sospensione scrivi a{' '}
        <a href={`mailto:${APPEAL_CONTACT}`}>{APPEAL_CONTACT}</a>.
      </p>

      <h2>Link esterni</h2>
      <p>
        I link ad altri siti, per esempio per i biglietti, portano fuori dall'app: Resonance non
        vende biglietti e non risponde di quei siti.
      </p>

      <h2>Cancellazione</h2>
      <p>
        L'app non ha ancora una funzione per cancellare l'account: per farlo scrivi a{' '}
        <a href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>.
      </p>
    </article>
  )
}
