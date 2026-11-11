// Il progetto Jira visto come lo usa il portale: Area (Epic) > Funzionalita' (Story) > Task (Sottotask).
// Le funzioni che leggono da Jira stanno qui; costruisciAlbero e' pura, ed e' quella che ha i test.

const CAMPI_ALBERO = ['summary', 'status', 'issuetype', 'parent', 'assignee', 'creator', 'labels', 'updated', 'resolutiondate', 'issuelinks'];

const numero = (key) => Number(String(key).split('-')[1]) || 0;
const perKey = (a, b) => numero(a.key) - numero(b.key);

// --- impostazioni condivise: una proprieta' del progetto Jira, uguale per tutti ---
export const PROPRIETA = 'pops-jira-viewer';
export const COLORI = ['giallo', 'arancione', 'viola', 'azzurro', 'rosa', 'verde'];
// gli stati del team di LDA: si usano finche' un amministratore del progetto non sceglie i suoi
export const STATI_PREDEFINITI = [
  { etichetta: 'in-attesa', nome: 'In attesa', colore: 'giallo' },
  { etichetta: 'rilasciato-in-collaudo', nome: 'Rilasciato in collaudo', colore: 'arancione' },
  { etichetta: 'rilasciato-in-formazione', nome: 'Rilasciato in formazione', colore: 'viola' },
];

export function slug(testo) {
  return String(testo || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// valida e ripulisce le impostazioni, sia quelle lette da Jira sia quelle da salvare
export function normalizzaImpostazioni(v) {
  const persone = (lista) => (Array.isArray(lista) ? lista : [])
    .filter((p) => p && typeof p.accountId === 'string' && p.accountId)
    .map((p) => ({ accountId: p.accountId, nome: String(p.nome || p.accountId) }))
    .filter((p, i, a) => a.findIndex((x) => x.accountId === p.accountId) === i);
  const stati = Array.isArray(v?.stati) ? v.stati : STATI_PREDEFINITI;
  const visti = new Set();
  return {
    assegnatari: persone(v?.assegnatari),
    creatori: persone(v?.creatori),
    stati: stati
      .map((s) => ({ etichetta: slug(s?.etichetta || s?.nome), nome: String(s?.nome || '').trim(), colore: COLORI.includes(s?.colore) ? s.colore : 'giallo' }))
      .filter((s) => s.etichetta && s.nome && !visti.has(s.etichetta) && visti.add(s.etichetta)),
  };
}

// lo stato del team, se l'issue ha una delle etichette configurate (la prima nell'ordine delle impostazioni)
export function conStatoDelTeam(x, stati = []) {
  const s = stati.find((s) => x.etichette?.includes(s.etichetta)) || null;
  return { ...x, statoTeam: s, chiaveStato: s ? `e:${s.etichetta}` : x.categoria };
}

// lo sprint in cui l'issue e' adesso: quello aperto, se c'e', altrimenti l'ultimo chiuso
function sprintAttuale(valore) {
  const lista = Array.isArray(valore) ? valore : [];
  const s = lista.find((x) => x.state === 'active') || lista.find((x) => x.state === 'future') || lista.at(-1);
  return s ? { id: s.id, nome: s.name, stato: s.state } : null;
}

// campoSprint: l'id del campo Sprint di questo Jira (customfield_…), se si vuole sapere dov'e' l'issue
export function sintesi(i, campoSprint) {
  const f = i.fields || {};
  const p = f.parent;
  return {
    key: i.key,
    titolo: f.summary || '',
    tipo: f.issuetype?.name || '',
    livello: f.issuetype?.hierarchyLevel ?? 0,
    sottotask: Boolean(f.issuetype?.subtask),
    stato: f.status?.name || '',
    categoria: f.status?.statusCategory?.key || 'new',
    assegnatario: f.assignee ? { accountId: f.assignee.accountId, nome: f.assignee.displayName } : null,
    creatore: f.creator ? { accountId: f.creator.accountId, nome: f.creator.displayName } : null,
    etichette: f.labels || [],
    aggiornata: f.updated || null,
    risolta: f.resolutiondate || null,
    padre: p
      ? {
          key: p.key,
          titolo: p.fields?.summary || '',
          livello: p.fields?.issuetype?.hierarchyLevel ?? 0,
          stato: p.fields?.status?.name || '',
          categoria: p.fields?.status?.statusCategory?.key || 'new',
        }
      : null,
    collegate: (f.issuelinks || []).map((l) => (l.outwardIssue || l.inwardIssue)?.key).filter(Boolean),
    ...(campoSprint ? { sprint: sprintAttuale(f[campoSprint]) } : {}),
  };
}

function conteggio(lista) {
  const c = { totale: lista.length, fatte: 0, inCorso: 0, daFare: 0 };
  for (const x of lista) {
    if (x.categoria === 'done') c.fatte++;
    else if (x.categoria === 'indeterminate') c.inCorso++;
    else c.daFare++;
  }
  return c;
}

const eBug = (x) => /bug/i.test(x.tipo);

// issues: le issue dello sprint (o del backlog). Opzioni:
// - fuori: le story di altri sprint che fanno da padre a un sottotask, o sono collegate a un bug, dello sprint;
// - esterni: i bug di altri sprint (o del backlog) collegati alle story dello sprint. Il bugfixing si fa a sprint
//   chiuso: aprendo lo sprint si vedono i bug delle sue funzionalita', ovunque siano finiti;
// - stati: gli stati del team delle impostazioni; campoSprint: il campo Sprint, per dire dove sta un'issue.
export function costruisciAlbero(issues, { fuori = [], esterni = [], stati = [], campoSprint } = {}) {
  const leggi = (i) => conStatoDelTeam(sintesi(i, campoSprint), stati);
  const tutte = issues.map(leggi);
  const story = new Map();
  for (const x of tutte.filter((x) => !x.sottotask && x.livello === 0)) story.set(x.key, { ...x, task: [], bug: [] });
  for (const x of fuori.map(leggi)) if (!story.has(x.key)) story.set(x.key, { ...x, task: [], bug: [], fuoriSprint: true });
  for (const b of esterni.map(leggi)) {
    const s = b.collegate.map((c) => story.get(c)).find((s) => s && !s.fuoriSprint && !eBug(s));
    if (s && !s.bug.some((x) => x.key === b.key)) s.bug.push({ ...b, altroSprint: true });
  }

  for (const t of tutte.filter((x) => x.sottotask)) {
    const s = t.padre && story.get(t.padre.key);
    if (s) s.task.push(t);
    else story.set(`orfano:${t.key}`, { ...t, task: [], bug: [], orfano: true });
  }

  // un bug collegato a una story dell'albero sta sotto quella story
  for (const [k, b] of [...story]) {
    if (!eBug(b) || b.fuoriSprint) continue;
    const s = b.collegate.map((c) => story.get(c)).find((s) => s && !eBug(s));
    if (s) {
      s.bug.push(b);
      story.delete(k);
    }
  }

  const aree = new Map();
  for (const s of story.values()) {
    s.task.sort(perKey);
    s.bug.sort(perKey);
    const e = s.padre && s.padre.livello === 1 ? s.padre : null;
    const chiave = e ? e.key : 'senza-area';
    if (!aree.has(chiave)) {
      aree.set(chiave, e
        ? { key: e.key, titolo: e.titolo, stato: e.stato, categoria: e.categoria, story: [] }
        : { key: null, titolo: 'Senza area', stato: '', categoria: 'new', story: [] });
    }
    aree.get(chiave).story.push(s);
  }

  const lista = [...aree.values()].sort((a, b) => (a.key ? numero(a.key) : 1e9) - (b.key ? numero(b.key) : 1e9));
  for (const a of lista) {
    a.story.sort(perKey);
    // l'avanzamento conta i task; una story senza task conta per se'
    const unita = a.story.flatMap((s) => (s.task.length ? s.task : [s]));
    a.avanzamento = conteggio(unita);
    for (const s of a.story) s.avanzamento = conteggio(s.task.length ? s.task : [s]);
  }
  const storie = lista.flatMap((a) => a.story.filter((s) => !s.fuoriSprint));
  // i bug: quelli dello sprint, anche sotto una story di un altro sprint, e quelli di altri sprint sotto le sue story
  const bug = lista.flatMap((a) => a.story.flatMap((s) => [...(eBug(s) && !s.fuoriSprint ? [s] : []), ...s.bug]));
  // quante issue dello sprint sono in ciascuno stato del team
  const team = {};
  for (const x of tutte) if (x.statoTeam) team[x.statoTeam.etichetta] = (team[x.statoTeam.etichetta] || 0) + 1;
  return {
    aree: lista,
    numeri: {
      story: conteggio(storie.filter((s) => !eBug(s))),
      task: conteggio(storie.flatMap((s) => s.task)),
      bug: conteggio(bug),
      statiTeam: team,
    },
  };
}

function sprintDi(s) {
  return {
    id: s.id,
    nome: s.name,
    stato: s.state, // active, future, closed
    inizio: s.startDate || null,
    fine: s.endDate || null,
    chiuso: s.completeDate || null,
    obiettivo: s.goal || '',
  };
}

export async function leggiMeta(client, url, chiave) {
  const progetto = await client.get(`/rest/api/3/project/${encodeURIComponent(chiave)}`);
  const tipi = progetto.issueTypes || [];
  const trova = (pred) => tipi.find(pred)?.id || null;
  const tipiId = {
    epic: trova((t) => t.hierarchyLevel === 1),
    sottotask: trova((t) => t.subtask),
    story: trova((t) => !t.subtask && t.hierarchyLevel === 0 && /stor/i.test(t.name)),
    bug: trova((t) => !t.subtask && /bug/i.test(t.name)),
    task: trova((t) => !t.subtask && t.hierarchyLevel === 0 && /task|attivit/i.test(t.name)),
  };

  const [board, io, tipiLink, salvate, permessi, campi, statiProgetto] = await Promise.all([
    client.get(`/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(chiave)}`).then((r) =>
      r.values.find((b) => b.type === 'scrum') || r.values[0] || null),
    client.get('/rest/api/3/myself'),
    client.get('/rest/api/3/issueLinkType').then((r) => r.issueLinkTypes || []),
    leggiImpostazioni(client, chiave),
    client.get(`/rest/api/3/mypermissions?projectKey=${encodeURIComponent(chiave)}&permissions=ADMINISTER_PROJECTS`),
    client.get('/rest/api/3/field'),
    client.get(`/rest/api/3/project/${encodeURIComponent(chiave)}/statuses`),
  ]);
  const campoSprint = campi.find((c) => c.schema?.custom === 'com.pyxis.greenhopper.jira:gh-sprint')?.id || null;
  // gli stati di ciascun tipo di issue, per scegliere lo stato iniziale quando se ne crea una
  const ordine = ['new', 'indeterminate', 'done'];
  const statiPerTipo = Object.fromEntries(statiProgetto.map((t) => [t.id,
    t.statuses.map((s) => ({ nome: s.name, categoria: s.statusCategory?.key }))
      .sort((a, b) => ordine.indexOf(a.categoria) - ordine.indexOf(b.categoria))]));
  const sprint = board ? (await client.tutti(`/rest/agile/1.0/board/${board.id}/sprint`)).map(sprintDi) : [];
  const impostazioni = normalizzaImpostazioni(salvate);

  // il team: gli assegnatari scelti nelle impostazioni; senza impostazioni, chi ha issue assegnate nel progetto
  const team = new Map([[io.accountId, io.displayName]]);
  if (impostazioni.assegnatari.length) {
    for (const p of impostazioni.assegnatari) team.set(p.accountId, p.nome);
  } else {
    const assegnate = await client.cerca(`project = "${chiave}" AND assignee is not EMPTY ORDER BY updated DESC`, ['assignee']);
    for (const i of assegnate) team.set(i.fields.assignee.accountId, i.fields.assignee.displayName);
  }
  const link = tipiLink.find((t) => /^relat/i.test(t.name)) || tipiLink[0] || null;

  return {
    url,
    progetto: { key: progetto.key, nome: progetto.name, id: progetto.id },
    board: board ? { id: board.id, nome: board.name } : null,
    sprint,
    io: { accountId: io.accountId, nome: io.displayName, email: io.emailAddress || '' },
    team: [...team].map(([accountId, nome]) => ({ accountId, nome })).sort((a, b) => a.nome.localeCompare(b.nome)),
    impostazioni,
    impostazioniSalvate: salvate !== null,
    puoConfigurare: Boolean(permessi.permissions?.ADMINISTER_PROJECTS?.havePermission),
    colori: COLORI,
    campoSprint,
    statiPerTipo,
    tipi: tipiId,
    link: link ? link.name : null,
  };
}

export async function leggiImpostazioni(client, chiave) {
  try {
    const r = await client.get(`/rest/api/3/project/${encodeURIComponent(chiave)}/properties/${PROPRIETA}`);
    return r?.value ?? null;
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

export async function salvaImpostazioni(client, chiave, valore) {
  const pulite = normalizzaImpostazioni(valore);
  await client.put(`/rest/api/3/project/${encodeURIComponent(chiave)}/properties/${PROPRIETA}`, pulite);
  return pulite;
}

// per scegliere le persone nelle impostazioni: chi si puo' assegnare nel progetto
export async function cercaUtenti(client, chiave, testo) {
  const q = encodeURIComponent(String(testo || '').trim());
  const r = await client.get(`/rest/api/3/user/assignable/search?project=${encodeURIComponent(chiave)}&query=${q}&maxResults=20`);
  return r.filter((u) => u.accountType === 'atlassian' && u.active !== false).map((u) => ({ accountId: u.accountId, nome: u.displayName }));
}

// Cambio di stato: uno stato di Jira (una transizione) toglie le etichette degli stati del team;
// uno stato del team mette la sua etichetta e toglie le altre, senza toccare lo stato di Jira. Come in LDA.
export async function cambiaStato(client, meta, key, { transizione, etichetta }) {
  const k = encodeURIComponent(key);
  const etichetteTeam = meta.impostazioni.stati.map((s) => s.etichetta);
  if (etichetta && !etichetteTeam.includes(etichetta)) throw new Error(`"${etichetta}" non è uno stato del team`);
  if (!etichetta && !transizione) throw new Error('Manca lo stato di destinazione');
  const i = await client.get(`/rest/api/3/issue/${k}?fields=labels,status&expand=transitions`);
  const modifiche = (i.fields.labels || []).filter((l) => etichetteTeam.includes(l) && l !== etichetta).map((l) => ({ remove: l }));
  if (etichetta && !(i.fields.labels || []).includes(etichetta)) modifiche.push({ add: etichetta });
  let t = null;
  if (transizione) {
    t = (i.transitions || []).find((x) => x.id === String(transizione));
    if (!t) throw new Error('Questo cambio di stato non è disponibile dallo stato attuale');
  }
  if (modifiche.length) await client.put(`/rest/api/3/issue/${k}`, { update: { labels: modifiche } });
  // tornare allo stato di Jira in cui l'issue e' gia' vuol dire solo togliere l'etichetta
  if (t && t.to?.name !== i.fields.status?.name) await client.post(`/rest/api/3/issue/${k}/transitions`, { transition: { id: t.id } });
}

export async function leggiSprint(client, meta, id) {
  const chiave = meta.progetto.key;
  const campi = meta.campoSprint ? [...CAMPI_ALBERO, meta.campoSprint] : CAMPI_ALBERO;
  const jql = id === 'backlog'
    ? `project = "${chiave}" AND sprint is EMPTY${meta.tipi.epic ? ` AND issuetype != ${meta.tipi.epic}` : ''} ORDER BY key`
    : `project = "${chiave}" AND sprint = ${Number(id)} ORDER BY key`;
  // le issue dello sprint e, a parte, tutti i bug del progetto: sono pochi, e servono quelli collegati
  // alle funzionalita' dello sprint anche se stanno altrove
  const [issues, tuttiIBug] = await Promise.all([
    client.cerca(jql, campi),
    meta.tipi.bug ? client.cerca(`project = "${chiave}" AND issuetype = ${meta.tipi.bug} ORDER BY key`, campi) : [],
  ]);
  const eStory = (i) => !i.fields.issuetype?.subtask && i.fields.issuetype?.hierarchyLevel === 0 && !/bug/i.test(i.fields.issuetype?.name);
  const presenti = new Set(issues.map((i) => i.key));
  const storyDelloSprint = new Set(issues.filter(eStory).map((i) => i.key));
  const collegate = (i) => (i.fields.issuelinks || []).map((l) => (l.outwardIssue || l.inwardIssue)?.key).filter(Boolean);
  const esterni = tuttiIBug.filter((b) => !presenti.has(b.key) && collegate(b).some((k) => storyDelloSprint.has(k)));
  // le story che mancano: i padri dei sottotask dello sprint e le story collegate ai suoi bug
  const mancanti = new Set();
  for (const i of issues) {
    if (i.fields.issuetype?.subtask && i.fields.parent && !presenti.has(i.fields.parent.key)) mancanti.add(i.fields.parent.key);
    if (/bug/i.test(i.fields.issuetype?.name)) for (const k of collegate(i)) if (!presenti.has(k)) mancanti.add(k);
  }
  const trovate = mancanti.size ? await client.cerca(`key in (${[...mancanti].join(',')})`, campi) : [];
  const fuori = trovate.filter(eStory);
  const sprint = id === 'backlog' ? null : meta.sprint.find((s) => s.id === Number(id)) || null;
  return { sprint, ...costruisciAlbero(issues, { fuori, esterni, stati: meta.impostazioni.stati, campoSprint: meta.campoSprint }) };
}

export async function leggiDettaglio(client, meta, key) {
  const campi = 'summary,status,issuetype,parent,assignee,creator,labels,created,updated,resolutiondate,description,comment,issuelinks,subtasks'
    + (meta.campoSprint ? `,${meta.campoSprint}` : '');
  const i = await client.get(`/rest/api/3/issue/${encodeURIComponent(key)}?fields=${campi}&expand=renderedFields,transitions`);
  const f = i.fields;
  const d = conStatoDelTeam(sintesi(i, meta.campoSprint), meta.impostazioni.stati);
  // per un sottotask serve anche l'area, che e' il padre della story
  let area = null;
  if (d.padre && d.padre.livello === 1) area = { key: d.padre.key, titolo: d.padre.titolo };
  else if (d.padre) {
    const p = await client.get(`/rest/api/3/issue/${d.padre.key}?fields=parent`);
    if (p.fields.parent) area = { key: p.fields.parent.key, titolo: p.fields.parent.fields?.summary || '' };
  }
  const commentiHtml = i.renderedFields?.comment?.comments || [];
  return {
    ...d,
    url: `${meta.url}/browse/${i.key}`,
    area,
    creata: f.created,
    autore: f.creator?.displayName || '',
    descrizioneHtml: i.renderedFields?.description || '',
    commenti: (f.comment?.comments || []).map((c, n) => ({
      id: c.id,
      autore: c.author?.displayName || '',
      quando: c.created,
      html: commentiHtml[n]?.body || '',
    })),
    transizioni: (i.transitions || []).map((t) => ({ id: t.id, nome: t.name, a: t.to?.name, categoria: t.to?.statusCategory?.key })),
    // i sottotask arrivano senza etichette: lo stato del team si vede aprendoli
    sottotaskDi: (f.subtasks || []).map(sintesi).sort(perKey),
    link: (f.issuelinks || []).map((l) => {
      const altra = l.outwardIssue || l.inwardIssue;
      return { tipo: l.outwardIssue ? l.type.outward : l.type.inward, ...sintesi(altra) };
    }),
  };
}

// Il task in Markdown, da incollare in Claude Code
export async function testoPerClaude(client, meta, key) {
  const campi = 'summary,description,status,issuetype,parent,assignee,labels';
  const i = await client.get(`/rest/api/2/issue/${encodeURIComponent(key)}?fields=${campi}`);
  const f = i.fields;
  const team = meta.impostazioni.stati.find((s) => (f.labels || []).includes(s.etichetta));
  const righe = [`# ${i.key} - ${f.summary}`, ''];
  righe.push(`Tipo: ${f.issuetype.name} · Stato: ${f.status.name}${team ? ` (${team.nome})` : ''} · Assegnato a: ${f.assignee?.displayName || 'nessuno'}`);
  let storia = null;
  if (f.parent && f.issuetype.subtask) {
    storia = await client.get(`/rest/api/2/issue/${f.parent.key}?fields=summary,description,parent`);
  }
  const epic = storia ? storia.fields.parent : f.parent && !f.issuetype.subtask ? f.parent : null;
  const percorso = [epic && `Area: ${epic.fields.summary} (${epic.key})`, storia && `Funzionalita': ${storia.fields.summary} (${storia.key})`];
  if (percorso.some(Boolean)) righe.push(percorso.filter(Boolean).join(' › '));
  righe.push(`Jira: ${meta.url}/browse/${i.key}`, '', '## Descrizione', '', f.description?.trim() || '(nessuna descrizione)');
  if (storia?.fields.description?.trim()) righe.push('', `## La funzionalita' (${storia.key})`, '', storia.fields.description.trim());
  // il monospazio della wiki di Jira ({{x}}) torna Markdown
  return righe.join('\n').replace(/\{\{([^}\n]+)\}\}/g, '`$1`') + '\n';
}

export async function mieAperte(client, meta) {
  const jql = `project = "${meta.progetto.key}" AND sprint in openSprints() AND assignee = currentUser() AND statusCategory != Done ORDER BY key`;
  return (await client.cerca(jql, CAMPI_ALBERO))
    .map((i) => ({ ...conStatoDelTeam(sintesi(i), meta.impostazioni.stati), url: `${meta.url}/browse/${i.key}` }));
}

export async function spostaInSprint(client, key, sprint) {
  if (sprint === 'backlog') await client.post('/rest/agile/1.0/backlog/issue', { issues: [key] });
  else await client.post(`/rest/agile/1.0/sprint/${Number(sprint)}/issue`, { issues: [key] });
}

export async function creaIssue(client, meta, { tipo, padre, titolo, descrizione, assegnatario, sprint, collegaA, stato }) {
  const idTipo = meta.tipi[tipo];
  if (!idTipo) throw new Error(`Il progetto non ha il tipo di issue "${tipo}"`);
  if (!titolo?.trim()) throw new Error('Il titolo è obbligatorio');
  if (sprint && sprint !== 'backlog' && meta.sprint.find((s) => s.id === Number(sprint))?.stato === 'closed') {
    throw new Error('Jira non accetta issue nuove in uno sprint chiuso: scegli uno sprint aperto o il backlog');
  }
  const fields = {
    project: { key: meta.progetto.key },
    issuetype: { id: idTipo },
    summary: titolo.trim(),
  };
  if (descrizione?.trim()) fields.description = descrizione.trim();
  if (padre) fields.parent = { key: padre };
  if (assegnatario) fields.assignee = { accountId: assegnatario };
  const r = await client.post('/rest/api/2/issue', { fields });
  if (sprint && sprint !== 'backlog' && tipo !== 'sottotask') await spostaInSprint(client, r.key, sprint);
  if (collegaA && meta.link) {
    await client.post('/rest/api/3/issueLink', { type: { name: meta.link }, inwardIssue: { key: r.key }, outwardIssue: { key: collegaA } });
  }
  // lo stato iniziale, se non e' quello di partenza: per esempio un task registrato a posteriori, gia' completato
  if (stato) {
    const i = await client.get(`/rest/api/3/issue/${r.key}?fields=status&expand=transitions`);
    const t = (i.transitions || []).find((x) => x.to?.name === stato);
    if (t && stato !== i.fields.status?.name) await client.post(`/rest/api/3/issue/${r.key}/transitions`, { transition: { id: t.id } });
  }
  return { key: r.key, url: `${meta.url}/browse/${r.key}` };
}
