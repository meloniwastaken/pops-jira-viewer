# POPS Jira Viewer

Il viewer degli sprint Jira del Portale Operatori Sanitari. Mostra il lavoro come lo organizziamo:
**Sprint › Area › Funzionalità › Task**, con l'avanzamento, i filtri per persona e le azioni di tutti
i giorni, senza passare dall'interfaccia di Jira.

Gira sul tuo PC, con il tuo token Jira. Nel pacchetto non ci sono indirizzi né credenziali: li
inserisci tu al primo avvio.

## Avvio

```bash
npx @meloniwastaken/pops-jira-viewer
```

Si apre il browser su `http://localhost:3000`. Al primo avvio chiede:

| Campo | Valore |
|---|---|
| Indirizzo di Jira | l'indirizzo del vostro Jira Cloud, anche un link qualsiasi del sito |
| Chiave del progetto | `POPS` |
| Email | la tua email Jira |
| API token | da [id.atlassian.com → Sicurezza → Token API](https://id.atlassian.com/manage-profile/security/api-tokens) |

Il viewer prova le credenziali su Jira prima di salvarle. Le salva in `~/.pops-jira-viewer/config.json`,
nella cartella del tuo utente. «Esci» le cancella.

Opzioni:

```bash
npx @meloniwastaken/pops-jira-viewer --port 4000     # un'altra porta
npx @meloniwastaken/pops-jira-viewer --no-open       # senza aprire il browser
```

Al posto del file si possono usare le variabili d'ambiente `JIRA_URL`, `JIRA_EMAIL`, `JIRA_TOKEN` e
`JIRA_PROJECT`, che vincono sul file.

## Cosa fa

- **Sprint senza niente di fisso.** Legge gli sprint della board Scrum del progetto: attivo, futuri,
  chiusi e il backlog. Apre lo sprint attivo; uno sprint nuovo compare da solo.
- **Riepilogo dello sprint.** Date, giorni che mancano, percentuale dei task completati, funzionalità
  completate, task in corso e da fare, bug aperti.
- **Albero.** Ogni area (Epic) con le sue funzionalità (Story), e sotto i task (Sottotask) e i bug
  collegati, con stato, assegnatario e barra di avanzamento.
- **Filtri.** Persona («Le mie», una persona, «Non assegnati»), area, stato, testo (`/` per cercare),
  «Nascondi i completati». Sprint, filtri e issue aperta restano nell'indirizzo della pagina: lo puoi
  salvare nei preferiti.
- **Dettaglio.** Il pannello a destra mostra descrizione, task, issue collegate e commenti, e permette
  di cambiare stato e assegnatario e di commentare.
- **Creazione.** «+ Task» in una funzionalità, «+ Bug» collegato a una funzionalità, «+ Funzionalità»
  in un'area, nello sprint che stai guardando.
- **Spostamento.** «Sposta…» porta una funzionalità, con i suoi task, in un altro sprint o nel backlog.
- **Sprint chiusi.** Sono in sola lettura.
- **Aggiornamento.** I dati si aggiornano da soli ogni 3 minuti, e quando torni sulla scheda del
  browser.

## Per Claude Code

«Copia per Claude», nel dettaglio di un task, copia il task in Markdown: chiave, titolo, stato,
assegnatario, area, funzionalità, descrizione del task e della funzionalità. Lo incolli in Claude Code
e parti da lì.

Con il viewer aperto, Claude può leggere anche le API locali:

| Chiamata | Risposta |
|---|---|
| `GET /api/claude/POPS-123` | il task in Markdown, come «Copia per Claude» |
| `GET /api/mie` | i miei task non completati negli sprint aperti (JSON) |
| `GET /api/sprint/attivo` | l'albero dello sprint attivo (JSON); anche `/api/sprint/{id}` e `/api/sprint/backlog` |
| `GET /api/issue/POPS-123` | il dettaglio di un'issue (JSON) |

Il server ascolta solo su `127.0.0.1` e rifiuta le richieste che non arrivano da `localhost`.

## Sviluppo

```bash
npm install
npm run dev     # server sulla 3000 e Vite sulla 5173, con il proxy di /api
npm test        # test della costruzione dell'albero
npm run build   # frontend in dist/
```

Struttura:

- `server/`: Express, client Jira (REST v2/v3 e Agile) e costruzione dell'albero;
- `src/`: frontend Vue 3;
- `bin/cli.js`: il comando di `npx`.

Pubblicazione: alza la versione in `package.json`, poi `npm publish --access public` (prima fa test e
build).
