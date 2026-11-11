// I filtri sull'albero dello sprint. Funzioni pure, senza Vue: hanno i loro test.
//
// f: {
//   persona: 'tutti'|'mie'|'nessuno'|accountId,   l'assegnatario
//   creatore: 'tutti'|accountId,                    chi ha creato l'issue
//   area: key|'',
//   stati: { [chiaveStato]: boolean },              'new', 'indeterminate', 'done' o 'e:<etichetta>' per gli stati del team
//   nascondiFatte: boolean,                         nasconde chi e' completato su Jira e non ha uno stato del team
//   q: string,
// }
// io: l'accountId di chi guarda
export function filtra(aree, f, io) {
  const q = f.q.trim().toLowerCase();
  const testo = (x) => !q || x.key?.toLowerCase().includes(q) || x.titolo.toLowerCase().includes(q);
  const persona = (x) =>
    f.persona === 'tutti' ||
    (f.persona === 'mie' && x.assegnatario?.accountId === io) ||
    (f.persona === 'nessuno' && !x.assegnatario) ||
    x.assegnatario?.accountId === f.persona;
  const creatore = (x) => !f.creatore || f.creatore === 'tutti' || x.creatore?.accountId === f.creatore;
  const chi = (x) => persona(x) && creatore(x);
  const chiave = (x) => x.chiaveStato || x.categoria;
  const stato = (x) => f.stati[chiave(x)] !== false && !(f.nascondiFatte && chiave(x) === 'done');

  const risultato = [];
  for (const a of aree) {
    if (f.area && a.key !== f.area) continue;
    const areaTrovata = q && testo(a);
    const story = [];
    for (const s of a.story) {
      const libero = areaTrovata || (q && testo(s)); // la ricerca ha trovato il contenitore: si vede tutto quello che c'e' dentro
      const ok = (x) => chi(x) && stato(x) && (libero || testo(x));
      const task = s.task.filter(ok);
      const bug = s.bug.filter(ok);
      // la funzionalita' si vede da sola se passa lei stessa i filtri, anche senza task che li passano
      const daSola = stato(s) && (libero || testo(s)) && chi(s);
      if (task.length || bug.length || daSola) story.push({ ...s, task, bug });
    }
    if (story.length) risultato.push({ ...a, story });
  }
  return risultato;
}

// le chiavi degli stati per i filtri, nell'ordine in cui si mostrano
export function chiaviStati(statiTeam = []) {
  return [
    { chiave: 'new', nome: 'Da fare' },
    { chiave: 'indeterminate', nome: 'In corso' },
    ...statiTeam.map((s) => ({ chiave: `e:${s.etichetta}`, nome: s.nome, colore: s.colore })),
    { chiave: 'done', nome: 'Completati' },
  ];
}
