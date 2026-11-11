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
- **Filtri.** Assegnatario («Le mie», una persona, «Non assegnati»), creatore («Creati da»), area,
  tipo (Task, Bug: con uno solo dei due si vedono solo quelli, dentro le loro funzionalità), stato,
  testo (`/` per cercare), «Nascondi i completati». Sprint, filtri e issue aperta restano
  nell'indirizzo della pagina: lo puoi salvare nei preferiti.
- **Stati del team.** Oltre agli stati di Jira ci sono quelli del team, fatti con le etichette come in
  LDA: di base «In attesa», «Rilasciato in collaudo» e «Rilasciato in formazione». Scegliendone uno,
  l'issue prende l'etichetta e il suo stato su Jira non cambia; scegliendo uno stato di Jira, le
  etichette degli stati del team si tolgono. Si vedono nelle righe, nei filtri e nel riepilogo dello
  sprint, mentre l'avanzamento resta quello di Jira.
- **Dettaglio.** Il pannello a destra mostra descrizione, task, issue collegate e commenti, e permette
  di cambiare stato e assegnatario e di commentare.
- **Creazione.** «+ Task» in una funzionalità, «+ Bug» collegato a una funzionalità, «+ Funzionalità»
  in un'area. Per bug e funzionalità si sceglie dove vanno (uno sprint aperto o il backlog); per tutti si
  può scegliere lo stato iniziale, anche «Completata» per un lavoro registrato a posteriori.
- **Spostamento.** «Sposta…» porta una funzionalità, con i suoi task, in un altro sprint o nel backlog.
- **Sprint chiusi e bugfixing.** Negli sprint chiusi si aprono task e bug, ma non si sposta niente.
  - Un task resta nello sprint chiuso con la sua funzionalità: Jira mette i sottotask nello sprint del
    padre.
  - Un bug va in uno sprint aperto o nel backlog: Jira non mette issue nuove negli sprint chiusi.
  - Sotto ogni funzionalità si vedono comunque i bug collegati, ovunque siano finiti («nel backlog»,
    «in POPS Sprint 4»): il bugfixing di uno sprint si fa aprendo quello sprint.
  - Al contrario, un bug dello sprint collegato a una funzionalità di un altro sprint compare sotto quella
    funzionalità, segnata «fuori sprint».
- **Aggiornamento.** I dati si aggiornano da soli ogni 3 minuti, e quando torni sulla scheda del
  browser.

## Impostazioni del progetto

Chi amministra il progetto su Jira vede il pulsante «Impostazioni». Lì sceglie:

- gli **assegnatari rapidi**: le persone dei filtri e degli elenchi «Assegnatario». Senza, il viewer usa
  chi ha issue assegnate nel progetto;
- le persone del filtro **«Creati da»**;
- gli **stati del team**: nome, colore e ordine. L'etichetta nasce dal nome e, una volta salvata, non
  cambia più, perché è quella che le issue hanno addosso.

Le impostazioni si salvano su Jira, come proprietà `pops-jira-viewer` del progetto: valgono per tutti
quelli che usano il viewer e nel pacchetto non c'è nessun nome. Gli stati veri di Jira, invece, li può
aggiungere solo un amministratore di Jira, non del progetto: per questo il team usa le etichette.

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

Ogni issue ha `stato` e `categoria` di Jira, `statoTeam` (lo stato del team, o `null`), `assegnatario`
e `creatore`.

Il server ascolta solo su `127.0.0.1` e rifiuta le richieste che non arrivano da `localhost`.

## Sviluppo

```bash
npm install
npm run dev     # server sulla 3000 e Vite sulla 5173, con il proxy di /api
npm test        # test dell'albero, delle impostazioni e dei filtri
npm run build   # frontend in dist/
```

Struttura:

- `server/`: Express, client Jira (REST v2/v3 e Agile) e costruzione dell'albero;
- `src/`: frontend Vue 3;
- `bin/cli.js`: il comando di `npx`.

Pubblicazione: alza la versione in `package.json`, poi `npm publish --access public` (prima fa test e
build).
