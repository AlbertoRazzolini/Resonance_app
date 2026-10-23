/**
 * Copyright: titolare e uso dei contenuti (testo approvato dallo studente il 23 ottobre, decisione 85). È un testo
 * dimostrativo, non scritto da un avvocato: lo dice la pagina stessa.
 */
export function Component() {
  return (
    <article className="rs-legal">
      <h1>Copyright</h1>
      <p className="text-body-secondary">Aggiornata il 23 ottobre 2026</p>
      <p className="text-body-secondary">
        Questo testo è dimostrativo: non è stato scritto da un avvocato e non ha valore legale.
      </p>

      <h2>Chi ha i diritti</h2>
      <p>
        © 2026 Alberto Razzolini. Il nome Resonance, il logo, il codice e i testi dell'app sono
        dell'autore. Tutti i diritti sono riservati.
      </p>

      <h2>Quello che pubblichi tu</h2>
      <p>
        Eventi, annunci, post, foto (indicate con un link) e messaggi restano tuoi. Pubblicandoli ci
        permetti di mostrarli nell'app agli altri utenti, nei modi descritti nell'informativa sulla
        privacy.
      </p>

      <h2>Immagini</h2>
      <p>
        Resonance non carica immagini: mostra quelle a cui punta un link. Inserisci solo link a
        immagini che puoi usare.
      </p>

      <h2>Mappe</h2>
      <p>
        Le mappe usano dati © OpenStreetMap contributors e © OpenMapTiles, forniti da OpenFreeMap.
      </p>
    </article>
  )
}
