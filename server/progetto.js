// Il progetto Jira visto come lo usa il portale: Area (Epic) > Funzionalita' (Story) > Task (Sottotask).
// Le funzioni che leggono da Jira stanno qui; costruisciAlbero e' pura, ed e' quella che ha i test.

const CAMPI_ALBERO = ['summary', 'status', 'issuetype', 'parent', 'assignee', 'updated', 'resolutiondate', 'issuelinks'];

const numero = (key) => Number(String(key).split('-')[1]) || 0;
const perKey = (a, b) => numero(a.key) - numero(b.key);

export function sintesi(i) {
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

// issues: le issue dello sprint (o del backlog); fuori: le story fuori sprint che fanno da padre a un sottotask
export function costruisciAlbero(issues, fuori = []) {
  const tutte = issues.map(sintesi);
  const story = new Map();
  for (const x of tutte.filter((x) => !x.sottotask && x.livello === 0)) story.set(x.key, { ...x, task: [], bug: [] });
  for (const x of fuori.map(sintesi)) if (!story.has(x.key)) story.set(x.key, { ...x, task: [], bug: [], fuoriSprint: true });

  for (const t of tutte.filter((x) => x.sottotask)) {
    const s = t.padre && story.get(t.padre.key);
    if (s) s.task.push(t);
    else story.set(`orfano:${t.key}`, { ...t, task: [], bug: [], orfano: true });
  }

  // un bug collegato a una story dell'albero sta sotto quella story
  for (const [k, b] of [...story]) {
    if (!/bug/i.test(b.tipo)) continue;
    const s = b.collegate.map((c) => story.get(c)).find((s) => s && !/bug/i.test(s.tipo));
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
  return {
    aree: lista,
    numeri: {
      story: conteggio(storie.filter((s) => !/bug/i.test(s.tipo))),
      task: conteggio(storie.flatMap((s) => s.task)),
      bug: conteggio([...storie.filter((s) => /bug/i.test(s.tipo)), ...storie.flatMap((s) => s.bug)]),
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

  const [board, io, tipiLink, assegnate] = await Promise.all([
    client.get(`/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(chiave)}`).then((r) =>
      r.values.find((b) => b.type === 'scrum') || r.values[0] || null),
    client.get('/rest/api/3/myself'),
    client.get('/rest/api/3/issueLinkType').then((r) => r.issueLinkTypes || []),
    client.cerca(`project = "${chiave}" AND assignee is not EMPTY ORDER BY updated DESC`, ['assignee']),
  ]);
  const sprint = board ? (await client.tutti(`/rest/agile/1.0/board/${board.id}/sprint`)).map(sprintDi) : [];

  const team = new Map([[io.accountId, io.displayName]]);
  for (const i of assegnate) team.set(i.fields.assignee.accountId, i.fields.assignee.displayName);
  const link = tipiLink.find((t) => /^relat/i.test(t.name)) || tipiLink[0] || null;

  return {
    url,
    progetto: { key: progetto.key, nome: progetto.name, id: progetto.id },
    board: board ? { id: board.id, nome: board.name } : null,
    sprint,
    io: { accountId: io.accountId, nome: io.displayName, email: io.emailAddress || '' },
    team: [...team].map(([accountId, nome]) => ({ accountId, nome })).sort((a, b) => a.nome.localeCompare(b.nome)),
    tipi: tipiId,
    link: link ? link.name : null,
  };
}

export async function leggiSprint(client, meta, id) {
  const chiave = meta.progetto.key;
  const jql = id === 'backlog'
    ? `project = "${chiave}" AND sprint is EMPTY${meta.tipi.epic ? ` AND issuetype != ${meta.tipi.epic}` : ''} ORDER BY key`
    : `project = "${chiave}" AND sprint = ${Number(id)} ORDER BY key`;
  const issues = await client.cerca(jql, CAMPI_ALBERO);
  const presenti = new Set(issues.map((i) => i.key));
  const mancanti = [...new Set(issues.filter((i) => i.fields.issuetype?.subtask && i.fields.parent && !presenti.has(i.fields.parent.key))
    .map((i) => i.fields.parent.key))];
  const fuori = mancanti.length ? await client.cerca(`key in (${mancanti.join(',')})`, CAMPI_ALBERO) : [];
  const sprint = id === 'backlog' ? null : meta.sprint.find((s) => s.id === Number(id)) || null;
  return { sprint, ...costruisciAlbero(issues, fuori) };
}

export async function leggiDettaglio(client, meta, key) {
  const campi = 'summary,status,issuetype,parent,assignee,reporter,created,updated,resolutiondate,description,comment,issuelinks,subtasks';
  const i = await client.get(`/rest/api/3/issue/${encodeURIComponent(key)}?fields=${campi}&expand=renderedFields,transitions`);
  const f = i.fields;
  const d = sintesi(i);
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
    autore: f.reporter?.displayName || '',
    descrizioneHtml: i.renderedFields?.description || '',
    commenti: (f.comment?.comments || []).map((c, n) => ({
      id: c.id,
      autore: c.author?.displayName || '',
      quando: c.created,
      html: commentiHtml[n]?.body || '',
    })),
    transizioni: (i.transitions || []).map((t) => ({ id: t.id, nome: t.name, a: t.to?.name, categoria: t.to?.statusCategory?.key })),
    sottotaskDi: (f.subtasks || []).map(sintesi).sort(perKey),
    link: (f.issuelinks || []).map((l) => {
      const altra = l.outwardIssue || l.inwardIssue;
      return { tipo: l.outwardIssue ? l.type.outward : l.type.inward, ...sintesi(altra) };
    }),
  };
}

// Il task in Markdown, da incollare in Claude Code
export async function testoPerClaude(client, meta, key) {
  const campi = 'summary,description,status,issuetype,parent,assignee';
  const i = await client.get(`/rest/api/2/issue/${encodeURIComponent(key)}?fields=${campi}`);
  const f = i.fields;
  const righe = [`# ${i.key} - ${f.summary}`, ''];
  righe.push(`Tipo: ${f.issuetype.name} · Stato: ${f.status.name} · Assegnato a: ${f.assignee?.displayName || 'nessuno'}`);
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
  return (await client.cerca(jql, CAMPI_ALBERO)).map((i) => ({ ...sintesi(i), url: `${meta.url}/browse/${i.key}` }));
}

export async function spostaInSprint(client, key, sprint) {
  if (sprint === 'backlog') await client.post('/rest/agile/1.0/backlog/issue', { issues: [key] });
  else await client.post(`/rest/agile/1.0/sprint/${Number(sprint)}/issue`, { issues: [key] });
}

export async function creaIssue(client, meta, { tipo, padre, titolo, descrizione, assegnatario, sprint, collegaA }) {
  const idTipo = meta.tipi[tipo];
  if (!idTipo) throw new Error(`Il progetto non ha il tipo di issue "${tipo}"`);
  if (!titolo?.trim()) throw new Error('Il titolo è obbligatorio');
  const fields = {
    project: { key: meta.progetto.key },
    issuetype: { id: idTipo },
    summary: titolo.trim(),
  };
  if (descrizione?.trim()) fields.description = descrizione.trim();
  if (padre) fields.parent = { key: padre };
  if (assegnatario) fields.assignee = { accountId: assegnatario };
  const r = await client.post('/rest/api/2/issue', { fields });
  if (sprint && tipo !== 'sottotask') await spostaInSprint(client, r.key, sprint);
  if (collegaA && meta.link) {
    await client.post('/rest/api/3/issueLink', { type: { name: meta.link }, inwardIssue: { key: r.key }, outwardIssue: { key: collegaA } });
  }
  return { key: r.key, url: `${meta.url}/browse/${r.key}` };
}
