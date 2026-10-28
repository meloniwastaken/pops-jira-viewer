// Server locale: fa da proxy verso Jira con le credenziali dell'utente e serve il frontend compilato.
// Ascolta solo su 127.0.0.1: il token non deve essere raggiungibile da altri PC della rete.
import express from 'express';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as config from './config.js';
import { creaClient, JiraError } from './jira.js';
import {
  leggiMeta, leggiSprint, leggiDettaglio, testoPerClaude, mieAperte, spostaInSprint, creaIssue,
} from './progetto.js';

const LOCALI = new Set(['localhost', '127.0.0.1', '[::1]']);
const DURATA_META = 5 * 60 * 1000;

export function creaApp() {
  const app = express();
  let cache = null; // { firma, meta, quando }

  // contro il DNS rebinding e le pagine di altri siti che chiamano il server locale
  app.use('/api', (req, res, next) => {
    const host = (req.headers.host || '').replace(/:\d+$/, '');
    const origin = req.headers.origin ? new URL(req.headers.origin).hostname : null;
    if (!LOCALI.has(host) || (origin && !LOCALI.has(origin) && origin !== '[::1]')) {
      return res.status(403).json({ errore: 'Richiesta non locale' });
    }
    next();
  });
  app.use(express.json({ limit: '1mb' }));

  function client() {
    const c = config.leggi();
    if (!c.completa) return null;
    return { c, jira: creaClient(c) };
  }

  async function meta(req, fresco = false) {
    const k = client();
    if (!k) return null;
    const firma = `${k.c.url}|${k.c.email}|${k.c.progetto}|${k.c.token.slice(-6)}`;
    if (!fresco && cache && cache.firma === firma && Date.now() - cache.quando < DURATA_META) return { ...k, meta: cache.meta };
    const m = await leggiMeta(k.jira, k.c.url, k.c.progetto);
    cache = { firma, meta: m, quando: Date.now() };
    return { ...k, meta: m };
  }

  // ogni rotta che parla con Jira passa da qui: niente configurazione = 401, errori Jira con il loro stato
  const conJira = (fn) => async (req, res) => {
    try {
      const k = await meta(req, req.query.fresco === '1');
      if (!k) return res.status(401).json({ errore: 'Viewer non configurato', configura: true });
      const r = await fn(req, k);
      if (typeof r === 'string') res.type('text/markdown; charset=utf-8').send(r);
      else res.json(r ?? { ok: true });
    } catch (e) {
      const status = e instanceof JiraError ? (e.status === 401 ? 401 : e.status >= 500 ? 502 : e.status) : 400;
      res.status(status).json({ errore: e.message, configura: e.status === 401 });
    }
  };

  app.get('/api/stato', (_req, res) => {
    const c = config.leggi();
    res.json({ configurato: c.completa, url: c.url, email: c.email, progetto: c.progetto, daAmbiente: c.daAmbiente });
  });

  app.post('/api/configura', async (req, res) => {
    try {
      const { url, email, token, progetto } = req.body || {};
      if (!url || !email || !token || !progetto) return res.status(400).json({ errore: 'Servono indirizzo, email, token e progetto' });
      const pulito = { url: config.normalizzaUrl(url), email: email.trim(), token: token.trim(), progetto: progetto.trim().toUpperCase() };
      const m = await leggiMeta(creaClient(pulito), pulito.url, pulito.progetto); // prova vera prima di salvare
      config.salva(pulito);
      cache = null;
      res.json({ ok: true, progetto: m.progetto, io: m.io });
    } catch (e) {
      res.status(e instanceof JiraError ? (e.status >= 500 ? 502 : e.status) : 400).json({ errore: e.message });
    }
  });

  app.post('/api/esci', (_req, res) => {
    config.cancella();
    cache = null;
    res.json({ ok: true });
  });

  app.get('/api/meta', conJira((_req, k) => k.meta));

  app.get('/api/sprint/:id', conJira(async (req, k) => {
    let id = req.params.id;
    if (id === 'attivo') {
      const attivo = k.meta.sprint.find((s) => s.stato === 'active');
      if (!attivo) throw new Error('Nessuno sprint attivo');
      id = attivo.id;
    }
    if (id !== 'backlog' && !k.meta.sprint.some((s) => s.id === Number(id))) throw new Error(`Sprint ${id} non trovato sulla board`);
    return leggiSprint(k.jira, k.meta, id);
  }));

  app.get('/api/issue/:key', conJira((req, k) => leggiDettaglio(k.jira, k.meta, req.params.key)));

  app.post('/api/issue/:key/transizione', conJira(async (req, k) => {
    await k.jira.post(`/rest/api/3/issue/${encodeURIComponent(req.params.key)}/transitions`, { transition: { id: String(req.body.id) } });
  }));

  app.put('/api/issue/:key/assegnatario', conJira(async (req, k) => {
    await k.jira.put(`/rest/api/3/issue/${encodeURIComponent(req.params.key)}/assignee`, { accountId: req.body.accountId || null });
  }));

  app.post('/api/issue/:key/commento', conJira(async (req, k) => {
    if (!req.body.testo?.trim()) throw new Error('Il commento è vuoto');
    await k.jira.post(`/rest/api/2/issue/${encodeURIComponent(req.params.key)}/comment`, { body: req.body.testo.trim() });
  }));

  app.post('/api/issue/:key/sprint', conJira(async (req, k) => {
    await spostaInSprint(k.jira, req.params.key, req.body.sprint);
  }));

  app.post('/api/issue', conJira((req, k) => creaIssue(k.jira, k.meta, req.body || {})));

  // per Claude Code: il task in Markdown, e i miei task aperti negli sprint aperti
  app.get('/api/claude/:key', conJira((req, k) => testoPerClaude(k.jira, k.meta, req.params.key)));
  app.get('/api/mie', conJira((_req, k) => mieAperte(k.jira, k.meta)));

  app.use('/api', (_req, res) => res.status(404).json({ errore: 'Rotta inesistente' }));

  const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get('/{*resto}', (_req, res) => res.sendFile(join(dist, 'index.html')));
  }
  return app;
}

export function avvia(porta = 3000) {
  return new Promise((ok, ko) => {
    const server = creaApp().listen(porta, '127.0.0.1', () => ok(server));
    server.on('error', ko);
  });
}
