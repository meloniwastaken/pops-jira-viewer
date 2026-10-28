// Le chiamate al server locale. Un errore porta il messaggio del server e, se le credenziali
// non vanno, il flag configura: l'app torna alla schermata di collegamento.
async function chiama(metodo, percorso, corpo) {
  const r = await fetch('/api' + percorso, {
    method: metodo,
    headers: corpo === undefined ? {} : { 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const json = (r.headers.get('content-type') || '').includes('json');
  const dati = json ? await r.json() : await r.text();
  if (!r.ok) {
    const e = new Error((json && dati?.errore) || `Errore ${r.status}`);
    e.configura = Boolean(json && dati?.configura);
    throw e;
  }
  return dati;
}

const k = (key) => encodeURIComponent(key);

export const api = {
  stato: () => chiama('GET', '/stato'),
  configura: (dati) => chiama('POST', '/configura', dati),
  esci: () => chiama('POST', '/esci', {}),
  meta: (fresco) => chiama('GET', `/meta${fresco ? '?fresco=1' : ''}`),
  sprint: (id, fresco) => chiama('GET', `/sprint/${id}${fresco ? '?fresco=1' : ''}`),
  issue: (key) => chiama('GET', `/issue/${k(key)}`),
  transizione: (key, id) => chiama('POST', `/issue/${k(key)}/transizione`, { id }),
  assegna: (key, accountId) => chiama('PUT', `/issue/${k(key)}/assegnatario`, { accountId }),
  commenta: (key, testo) => chiama('POST', `/issue/${k(key)}/commento`, { testo }),
  sposta: (key, sprint) => chiama('POST', `/issue/${k(key)}/sprint`, { sprint }),
  crea: (dati) => chiama('POST', '/issue', dati),
  perClaude: (key) => chiama('GET', `/claude/${k(key)}`),
};
