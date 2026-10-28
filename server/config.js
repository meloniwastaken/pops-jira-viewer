// Configurazione locale: indirizzo Jira, chiave del progetto, email e token.
// Sta nella cartella dell'utente, mai nel pacchetto: il pacchetto e' pubblico.
// Le variabili d'ambiente JIRA_URL, JIRA_EMAIL, JIRA_TOKEN e JIRA_PROJECT vincono sul file.
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const CARTELLA = process.env.POPS_VIEWER_HOME || join(homedir(), '.pops-jira-viewer');
const FILE = join(CARTELLA, 'config.json');

function daFile() {
  if (!existsSync(FILE)) return {};
  try {
    return JSON.parse(readFileSync(FILE, 'utf8'));
  } catch {
    return {};
  }
}

export function normalizzaUrl(url) {
  // accetta anche un link qualsiasi del sito, per esempio .../jira/for-you
  const u = new URL(String(url).trim());
  return `${u.protocol}//${u.host}`;
}

export function leggi() {
  const f = daFile();
  const c = {
    url: process.env.JIRA_URL || f.url || '',
    email: process.env.JIRA_EMAIL || f.email || '',
    token: process.env.JIRA_TOKEN || f.token || '',
    progetto: (process.env.JIRA_PROJECT || f.progetto || '').toUpperCase(),
  };
  c.completa = Boolean(c.url && c.email && c.token && c.progetto);
  c.daAmbiente = Boolean(process.env.JIRA_TOKEN);
  return c;
}

export function salva({ url, email, token, progetto }) {
  mkdirSync(CARTELLA, { recursive: true });
  writeFileSync(FILE, JSON.stringify({ url, email, token, progetto }, null, 2), { mode: 0o600 });
}

export function cancella() {
  rmSync(FILE, { force: true });
}
