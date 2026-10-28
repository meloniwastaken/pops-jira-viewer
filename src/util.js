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

export function nomeBreve(nome) {
  return (nome || '').split(/[ ,]+/)[0];
}
export function iniziali(nome) {
  const p = (nome || '?').split(/[ ,]+/).filter(Boolean);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase();
}
export const percentuale = (c) => (c?.totale ? Math.round((100 * c.fatte) / c.totale) : 0);

// --- filtri sull'albero dello sprint ---
// f: { persona: 'tutti'|'mie'|'nessuno'|accountId, area: key|'', stati: {new, indeterminate, done}, nascondiFatte, q }
export function filtra(aree, f, io) {
  const q = f.q.trim().toLowerCase();
  const testo = (x) => !q || x.key?.toLowerCase().includes(q) || x.titolo.toLowerCase().includes(q);
  const persona = (x) =>
    f.persona === 'tutti' ||
    (f.persona === 'mie' && x.assegnatario?.accountId === io) ||
    (f.persona === 'nessuno' && !x.assegnatario) ||
    x.assegnatario?.accountId === f.persona;
  const stato = (x) => f.stati[x.categoria] && !(f.nascondiFatte && x.categoria === 'done');

  const risultato = [];
  for (const a of aree) {
    if (f.area && a.key !== f.area) continue;
    const areaTrovata = q && testo(a);
    const story = [];
    for (const s of a.story) {
      const libero = areaTrovata || (q && testo(s)); // la ricerca ha trovato il contenitore: si vede tutto quello che c'e' dentro
      const ok = (x) => persona(x) && stato(x) && (libero || testo(x));
      const task = s.task.filter(ok);
      const bug = s.bug.filter(ok);
      const daSola = stato(s) && (libero || testo(s)) && (f.persona === 'tutti' || persona(s));
      if (task.length || bug.length || daSola) story.push({ ...s, task, bug });
    }
    if (story.length) risultato.push({ ...a, story });
  }
  return risultato;
}
