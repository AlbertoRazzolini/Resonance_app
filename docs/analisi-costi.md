# Analisi dei costi operativi

Proiezione di quanto costerebbe tenere Resonance attiva nel tempo, anche oltre i piani gratuiti usati oggi per la demo.
È una **stima**, non un preventivo: le cifre vengono da fonti terze (nessuna pagina dei prezzi ufficiale era leggibile
dal mio strumento di ricerca, salvo la documentazione di Render sui database) e vanno verificate prima di decidere.
Nessuna modifica al codice: il documento descrive come è fatta l'applicazione oggi e come cambierebbero i costi con
più utenti.

Redatto il 23 ottobre 2026.

## 1. Cambio usato

Tutte le cifre sono in **euro**. Le fonti danno i prezzi in dollari, convertiti con il tasso di riferimento della BCE
del **23 ottobre 2026: 1 € = 1,1193 $**, cioè **1 $ = 0,8934 €**
([BCE, tassi del giorno](https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml)). Le cifre sono arrotondate al
centesimo; il cambio reale varia ogni giorno.

## 2. Come è fatta l'applicazione (da cui nascono i costi)

- **Un solo servizio web** su Render (Docker) con API e frontend, più **un database PostgreSQL** su Render. Oggi tutti e
  due sono sul piano gratuito (`render.yaml`, decisione 1).
- **Email** (codici di verifica e di reset password) tramite **Brevo**, via HTTP.
- **Geocodifica** degli indirizzi degli eventi (solo quando un evento viene pubblicato) tramite **Nominatim**, al
  massimo una richiesta al secondo.
- **Mappe** da **OpenFreeMap** (tile vettoriali, nessuna chiave).
- **Nessun dominio personalizzato** (decisione 1): l'indirizzo è quello di `onrender.com`.
- **Nessun upload di immagini** (progettazione, sezione 1.1, D2): le immagini sono solo link, quindi non c'è un servizio
  di archiviazione da pagare.
- **Chat in tempo reale** con il broker in memoria di Spring (`enableSimpleBroker` in `WebSocketConfig`): funziona con
  **una sola istanza** del servizio. Per questo, crescendo, nelle stime si ingrandisce l'istanza e non se ne aggiungono
  altre. Con più istanze servirebbe un broker esterno (non previsto, non stimato qui).

## 3. Servizi e prezzi

### Render: servizio web

| Piano | Prezzo | Risorse | Note |
|---|---|---|---|
| Free | 0 € | 512 MB | Si spegne dopo 15 minuti senza traffico: la prima richiesta dopo la pausa è lenta |
| Starter | 7 $ ≈ **6,25 €/mese** | 512 MB, 0,5 CPU | Sempre acceso |
| Standard | 25 $ ≈ **22,34 €/mese** | 2 GB, 1 CPU | |
| Pro (4 GB) | 85 $ ≈ **75,94 €/mese** | 4 GB, 2 CPU | Una fonte indica 85 $ anche per 2 GB: dato incerto |

Oltre al servizio c'è il piano dell'area di lavoro (Hobby 0 $, Pro 25 $ ≈ 22,34 €/mese): l'Hobby basta finché si lavora da
soli; il Pro serve per più persone o per limiti più larghi. **Non è incluso nei totali.**

### Render: database PostgreSQL

| Piano | Prezzo | Note |
|---|---|---|
| Free | 0 € | 1 GB, **scade dopo 30 giorni** dalla creazione (documentazione ufficiale di Render); una fonte parla di 14 giorni di tolleranza |
| Basic 256 MB | circa 6–7 $ ≈ **6,25 €/mese** (uso 7 $) | Le fonti non concordano sul prezzo |
| Basic 1 GB | circa 20 $ ≈ **17,87 €/mese** | |
| Pro 4 GB | circa 55 $ ≈ **49,14 €/mese** | |
| Spazio | 0,30 $/GB/mese ≈ **0,27 €/GB/mese** | Si può aumentare, non ridurre (documentazione di Render) |

**Attenzione per la demo:** il database gratuito di oggi scade 30 giorni dopo la creazione. Dopo, o si passa a un piano a
pagamento o si ricrea il database (perdendo i dati).

### Email: Brevo

| Piano | Prezzo | Limiti |
|---|---|---|
| Free | 0 € | 300 email al giorno; email con il marchio di Brevo |
| Starter | 9 $ ≈ **8,04 €/mese** | Da 5.000 email al mese |
| Standard | 18 $ ≈ 16,08 €/mese | Non serve: aggiunge funzioni di marketing |

Resonance manda solo email di servizio (codici di verifica e di reset).

### Geocodifica: Nominatim

Il server pubblico è **gratuito**, ma ha regole: al massimo una richiesta al secondo, uno User-Agent che identifica
l'app e nessun uso massivo. Una fonte aggiunge che vieta l'uso commerciale (da verificare nella policy ufficiale).
Per un uso serio si passa a un servizio a pagamento o a un'istanza propria. **Non ho trovato prezzi verificabili:
nei totali non è incluso.**

### Mappe: OpenFreeMap

**Gratuito**, senza limiti di visualizzazioni né chiavi; l'uso commerciale è ammesso (FAQ del progetto). Vive di donazioni
(GitHub Sponsors): chi ne fa uso intenso è invitato a sostenerlo. **Non incluso nei totali.**

### Dominio

Oggi non c'è. Un dominio proprio costa circa 10–15 € all'anno (ordine di grandezza **non verificato** in questa
sessione), cioè circa 1 €/mese. **Non incluso nei totali.**

## 4. Ipotesi dei quattro scenari

"Utenti" vuol dire **utenti attivi al mese**. Le ipotesi sono mie e vanno cambiate se i dati reali dicono altro.

- Ogni mese si registra circa il **20%** degli utenti attivi. Ognuno riceve circa 1,5 email (codice più un eventuale
  reinvio), più qualche reset password.
- Circa il **10%** degli utenti pubblica **un evento** al mese (una geocodifica per evento).
- Il database cresce di circa **1 GB ogni 1.000 utenti** (solo testo: niente immagini).
- L'istanza web si sceglie per la memoria che serve alla JVM e alle connessioni WebSocket aperte: Starter per poche
  decine di connessioni, Standard per qualche centinaio, Pro per migliaia. Sono **ipotesi non misurate**: la
  dimensione giusta si vede solo con una prova di carico, che non è stata fatta.

| Scenario | Email al mese | Eventi geocodificati al mese | Spazio del database |
|---|---|---|---|
| Demo | poche decine | pochi | meno di 1 GB |
| 100 utenti | circa 35 | circa 10 | circa 1 GB |
| 1.000 utenti | circa 350 | circa 100 | circa 2 GB |
| 10.000 utenti | circa 3.500 | circa 1.000 | circa 10 GB |

## 5. Costi per scenario

| Voce | Demo | 100 utenti | 1.000 utenti | 10.000 utenti |
|---|---|---|---|---|
| Servizio web | Free · 0 € | Starter · 6,25 € | Standard · 22,34 € | Pro 4 GB · 75,94 € |
| Database | Free · 0 € | Basic 256 MB · 6,25 € | Basic 1 GB · 17,87 € | Pro 4 GB · 49,14 € |
| Spazio database | incluso | 1 GB · 0,27 € | 2 GB · 0,54 € | 10 GB · 2,68 € |
| Email (Brevo) | Free · 0 € | Free · 0 € | Free · 0 € | Starter · 8,04 € |
| Geocodifica | 0 € | 0 € | 0 € | da definire |
| Mappe | 0 € | 0 € | 0 € | 0 € |
| **Totale al mese** | **0 €** | **12,77 €** | **40,75 €** | **135,80 €** |
| **Totale in 12 mesi** | **0 €** | **153 €** | **489 €** | **1.630 €** |

Note sui totali:

- **Demo:** 0 € solo finché il database gratuito non scade (30 giorni) e accettando che il servizio si spenga dopo 15
  minuti di inattività. Per tenerla accesa davvero servirebbero almeno Starter e Basic 256 MB, cioè circa **12,5 € al
  mese**.
- **10.000 utenti:** con le email in media (circa 3.500 al mese, 115 al giorno) il piano Free di Brevo basterebbe; ho
  messo lo Starter per avere margine nei picchi (300 al giorno).
- **Non inclusi in nessuna colonna:** dominio proprio, piano Pro dell'area di lavoro, donazioni a OpenFreeMap, prezzo di
  una geocodifica a pagamento, IVA e imposte, traffico oltre il limite dei piani, backup oltre quelli inclusi, strumenti
  di monitoraggio.

## 6. Cosa non so (limiti della stima)

- I prezzi vengono da articoli di terzi e da calcolatori: le fonti si contraddicono su alcune cifre (database Basic,
  piano Pro del servizio web). Vanno controllati sulle pagine ufficiali prima di spendere.
- Le dimensioni delle istanze non sono misurate (vedi sezione 4).
- La policy di Nominatim sull'uso commerciale non è stata letta direttamente.
- Il costo di un dominio e delle donazioni è solo un ordine di grandezza.

## 7. Fonti

- [Render, piani dei database PostgreSQL (ufficiale)](https://render.com/docs/postgresql-refresh)
- [Render, prezzi 2026 (Temps)](https://temps.sh/blog/render-pricing-2026) e [Render, prezzi 2026 (Costbench)](https://costbench.com/software/developer-tools/render/)
- [Render Postgres 2026 (Kuberns)](https://kuberns.com/blogs/render-postgres-pricing-setup-limits/)
- [Brevo, prezzi (EmailToolTester)](https://www.emailtooltester.com/en/reviews/brevo/pricing/) e [Brevo, prezzi (Sender)](https://www.sender.net/reviews/brevo/pricing/)
- [Nominatim, OpenStreetMap Wiki](https://wiki.openstreetmap.org/wiki/Nominatim)
- [OpenFreeMap](https://openfreemap.org)
- [BCE, tassi di cambio di riferimento](https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml)
