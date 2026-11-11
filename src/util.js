import { reactive } from 'vue';

// --- avvisi in basso a destra ---
export const avvisi = reactive([]);
let n = 0;
export function avvisa(testo, tipo = 'ok') {
  const id = ++n;
  avvisi.push({ id, testo, tipo });
  setTimeout(() => {
    const i = avvisi.findIndex((a) => a.id === id);
    if (i >= 0) avvisi.splice(i, 1);
  }, tipo === 'errore' ? 7000 : 3500);
}

// --- date ---
const UN_GIORNO = 864e5;
export function data(iso, conAnno = false) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', conAnno ? { day: '2-digit', month: '2-digit', year: 'numeric' } : { day: '2-digit', month: '2-digit' });
}
export function quando(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export function descriviSprint(s) {
  if (!s) return '';
  const periodo = s.inizio ? `${data(s.inizio)} – ${data(s.fine, true)}` : 'senza date';
  if (s.stato === 'closed') return `${periodo} · chiuso`;
  if (s.stato === 'future') return s.inizio ? `${periodo} · non ancora avviato` : 'Non ancora avviato, senza date';
  const giorni = Math.ceil((new Date(s.fine) - Date.now()) / UN_GIORNO);
  if (giorni < 0) return `${periodo} · scaduto da ${-giorni} ${-giorni === 1 ? 'giorno' : 'giorni'}`;
  if (giorni === 0) return `${periodo} · finisce oggi`;
  return `${periodo} · ${giorni === 1 ? 'manca 1 giorno' : `mancano ${giorni} giorni`}`;
}

// Jira ha nomi «Nome Cognome» e «Cognome, Nome»: si riportano tutti a nome e cognome
function parti(nome) {
  const n = String(nome || '').trim();
  const [cognome, resto] = n.includes(',') ? n.split(/,\s*/, 2) : [null, null];
  return resto ? [...resto.split(/\s+/), ...cognome.split(/\s+/)] : n.split(/\s+/);
}
export function nomeBreve(nome) {
  return parti(nome)[0] || '';
}
export function iniziali(nome) {
  const p = parti(nome || '?');
  return ((p[0]?.[0] || '') + (p.at(-1)?.[0] || '')).toUpperCase();
}
export const percentuale = (c) => (c?.totale ? Math.round((100 * c.fatte) / c.totale) : 0);
