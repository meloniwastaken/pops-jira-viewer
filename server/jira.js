// Client minimo delle API di Jira Cloud (REST v2/v3 e Agile), con autenticazione Basic email+token.

export class JiraError extends Error {
  constructor(status, messaggio, dettaglio) {
    super(messaggio);
    this.status = status;
    this.dettaglio = dettaglio;
  }
}

function messaggioDi(status, corpo) {
  const msg = [...(corpo?.errorMessages || []), ...Object.values(corpo?.errors || {})].join('; ');
  if (msg) return msg;
  if (status === 401) return 'Credenziali non valide: controlla email e token';
  if (status === 403) return 'Il tuo utente non ha il permesso per questa operazione';
  if (status === 404) return 'Non trovato su Jira';
  return `Jira ha risposto ${status}`;
}

export function creaClient({ url, email, token }) {
  const auth = 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');

  async function chiama(metodo, percorso, corpo) {
    for (let tentativo = 0; ; tentativo++) {
      const r = await fetch(url + percorso, {
        method: metodo,
        headers: { Authorization: auth, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      });
      if (r.status === 429 && tentativo < 4) {
        await new Promise((ok) => setTimeout(ok, 1000 * Number(r.headers.get('retry-after') || 2)));
        continue;
      }
      const testo = await r.text();
      let dati = null;
      try {
        dati = testo ? JSON.parse(testo) : null;
      } catch {
        dati = testo;
      }
      if (!r.ok) throw new JiraError(r.status, messaggioDi(r.status, dati), dati);
      return dati;
    }
  }

  return {
    get: (p) => chiama('GET', p),
    post: (p, c) => chiama('POST', p, c ?? {}),
    put: (p, c) => chiama('PUT', p, c ?? {}),

    // ricerca JQL con la paginazione a token di /search/jql
    async cerca(jql, fields) {
      const tutte = [];
      let nextPageToken;
      do {
        const r = await chiama('POST', '/rest/api/3/search/jql', { jql, fields, maxResults: 100, nextPageToken });
        tutte.push(...r.issues);
        nextPageToken = r.isLast ? undefined : r.nextPageToken;
      } while (nextPageToken);
      return tutte;
    },

    // liste dell'API Agile, paginate con startAt/isLast
    async tutti(percorso) {
      const tutti = [];
      let startAt = 0;
      for (;;) {
        const sep = percorso.includes('?') ? '&' : '?';
        const r = await chiama('GET', `${percorso}${sep}startAt=${startAt}&maxResults=50`);
        tutti.push(...r.values);
        if (r.isLast || !r.values.length) return tutti;
        startAt += r.values.length;
      }
    },
  };
}
