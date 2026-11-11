import { test } from 'node:test';
import assert from 'node:assert/strict';
import { costruisciAlbero, normalizzaImpostazioni, STATI_PREDEFINITI, slug } from './progetto.js';

const stato = (cat) => ({ name: cat === 'done' ? 'Completata' : cat === 'indeterminate' ? 'In corso' : 'Da completare', statusCategory: { key: cat } });
const tipo = (name, livello, subtask = false) => ({ name, hierarchyLevel: livello, subtask });
const epic = (key, summary) => ({ key, fields: { summary, issuetype: tipo('Epic', 1), status: stato('indeterminate') } });

function issue(key, { t = 'Story', livello = 0, subtask = false, cat = 'new', padre, link = [] } = {}) {
  return {
    key,
    fields: {
      summary: `titolo ${key}`,
      issuetype: tipo(t, livello, subtask),
      status: stato(cat),
      parent: padre,
      issuelinks: link.map((k) => ({ type: { outward: 'relates to' }, outwardIssue: { key: k } })),
    },
  };
}

test('raggruppa le story per area e i sottotask per story, in ordine di chiave', () => {
  const A = epic('POPS-1', 'Accesso');
  const B = epic('POPS-20', 'Assistiti');
  const albero = costruisciAlbero([
    issue('POPS-21', { padre: B }),
    issue('POPS-2', { padre: A, cat: 'done' }),
    issue('POPS-4', { t: 'Sottotask', livello: -1, subtask: true, cat: 'done', padre: { key: 'POPS-2', fields: { issuetype: tipo('Story', 0) } } }),
    issue('POPS-3', { t: 'Sottotask', livello: -1, subtask: true, cat: 'indeterminate', padre: { key: 'POPS-2', fields: { issuetype: tipo('Story', 0) } } }),
  ]);
  assert.deepEqual(albero.aree.map((a) => a.titolo), ['Accesso', 'Assistiti']);
  assert.deepEqual(albero.aree[0].story[0].task.map((t) => t.key), ['POPS-3', 'POPS-4']);
  assert.deepEqual(albero.aree[0].avanzamento, { totale: 2, fatte: 1, inCorso: 1, daFare: 0 });
  // la story senza task conta per se'
  assert.deepEqual(albero.aree[1].avanzamento, { totale: 1, fatte: 0, inCorso: 0, daFare: 1 });
  assert.deepEqual(albero.numeri.story, { totale: 2, fatte: 1, inCorso: 0, daFare: 1 });
  assert.equal(albero.numeri.task.totale, 2);
});

test('un bug collegato a una story sta sotto la story; uno slegato resta nell\'area', () => {
  const A = epic('POPS-1', 'Accesso');
  const albero = costruisciAlbero([
    issue('POPS-2', { padre: A }),
    issue('POPS-9', { t: 'Bug', padre: A, link: ['POPS-2'] }),
    issue('POPS-10', { t: 'Bug', padre: A }),
  ]);
  const area = albero.aree[0];
  assert.deepEqual(area.story.map((s) => s.key), ['POPS-2', 'POPS-10']);
  assert.deepEqual(area.story[0].bug.map((b) => b.key), ['POPS-9']);
  assert.equal(albero.numeri.bug.totale, 2);
  assert.equal(albero.numeri.story.totale, 1);
});

test('un sottotask con la story fuori sprint la porta con se\', segnata; senza area finisce in "Senza area"', () => {
  const A = epic('POPS-1', 'Accesso');
  const albero = costruisciAlbero(
    [issue('POPS-7', { t: 'Sottotask', livello: -1, subtask: true, padre: { key: 'POPS-6', fields: { issuetype: tipo('Story', 0) } } }),
     issue('POPS-30')],
    { fuori: [issue('POPS-6', { padre: A })] },
  );
  assert.equal(albero.aree[0].story[0].key, 'POPS-6');
  assert.equal(albero.aree[0].story[0].fuoriSprint, true);
  assert.equal(albero.aree.at(-1).titolo, 'Senza area');
  assert.equal(albero.numeri.story.totale, 1); // la story fuori sprint non si conta
});


test('senza impostazioni salvate valgono gli stati di LDA e nessuna persona', () => {
  const v = normalizzaImpostazioni(null);
  assert.deepEqual(v.stati, STATI_PREDEFINITI);
  assert.deepEqual(v.assegnatari, []);
  assert.deepEqual(v.creatori, []);
});

test('le impostazioni si ripuliscono: persone doppie, stati senza nome o con etichetta ripetuta, colori ignoti', () => {
  const v = normalizzaImpostazioni({
    assegnatari: [{ accountId: 'a', nome: 'Aurora' }, { accountId: 'a', nome: 'Aurora' }, { nome: 'senza id' }],
    stati: [
      { nome: 'Pronto per il test', colore: 'fucsia' },
      { nome: 'Già in collaudo', etichetta: 'gia-in-collaudo', colore: 'arancione' },
      { nome: 'Doppione', etichetta: 'gia-in-collaudo' },
      { nome: '   ' },
    ],
  });
  assert.deepEqual(v.assegnatari, [{ accountId: 'a', nome: 'Aurora' }]);
  assert.deepEqual(v.stati, [
    { etichetta: 'pronto-per-il-test', nome: 'Pronto per il test', colore: 'giallo' },
    { etichetta: 'gia-in-collaudo', nome: 'Già in collaudo', colore: 'arancione' },
  ]);
  // una lista vuota resta vuota: niente stati del team
  assert.deepEqual(normalizzaImpostazioni({ stati: [] }).stati, []);
  assert.equal(slug('  Rilasciato in Formazione! '), 'rilasciato-in-formazione');
});

test('l\'etichetta di uno stato del team diventa lo stato mostrato, e si contano le issue per stato', () => {
  const A = epic('POPS-1', 'Accesso');
  const s = issue('POPS-2', { padre: A, cat: 'indeterminate' });
  s.fields.labels = ['altro', 'in-attesa'];
  s.fields.creator = { accountId: 'n', displayName: "D'Ambrosio, Nadia" };
  const t = issue('POPS-3', { t: 'Sottotask', livello: -1, subtask: true, cat: 'done', padre: { key: 'POPS-2', fields: { issuetype: tipo('Story', 0) } } });
  t.fields.labels = ['rilasciato-in-collaudo'];
  const albero = costruisciAlbero([s, t], { stati: STATI_PREDEFINITI });
  const story = albero.aree[0].story[0];
  assert.equal(story.statoTeam.nome, 'In attesa');
  assert.equal(story.chiaveStato, 'e:in-attesa');
  assert.equal(story.creatore.nome, "D'Ambrosio, Nadia");
  assert.equal(story.task[0].chiaveStato, 'e:rilasciato-in-collaudo');
  // l'avanzamento resta quello di Jira: il task e' completato
  assert.equal(story.avanzamento.fatte, 1);
  assert.deepEqual(albero.numeri.statiTeam, { 'in-attesa': 1, 'rilasciato-in-collaudo': 1 });
  // senza stati del team le etichette non contano
  assert.equal(costruisciAlbero([s]).aree[0].story[0].chiaveStato, 'indeterminate');
});

test('bugfixing a sprint chiuso: i bug di altri sprint stanno sotto le story dello sprint, e dicono dove sono', () => {
  const A = epic('POPS-1', 'Accesso');
  const sprintCampo = 'customfield_10020';
  const bugAltrove = issue('POPS-40', { t: 'Bug', padre: A, link: ['POPS-2'] });
  bugAltrove.fields[sprintCampo] = [{ id: 709, name: 'POPS Sprint 3', state: 'closed' }, { id: 712, name: 'POPS Sprint 4', state: 'active' }];
  const bugBacklog = issue('POPS-41', { t: 'Bug', padre: A, link: ['POPS-2'] });
  const albero = costruisciAlbero([issue('POPS-2', { padre: A })], { esterni: [bugAltrove, bugBacklog], campoSprint: sprintCampo });
  const story = albero.aree[0].story[0];
  assert.deepEqual(story.bug.map((b) => [b.key, b.altroSprint, b.sprint?.nome ?? null]),
    [['POPS-40', true, 'POPS Sprint 4'], ['POPS-41', true, null]]);
  assert.equal(albero.numeri.bug.totale, 2);
});

test('un bug dello sprint collegato a una story di un altro sprint sta sotto quella story, segnata fuori sprint, e si conta', () => {
  const A = epic('POPS-1', 'Accesso');
  const albero = costruisciAlbero([issue('POPS-50', { t: 'Bug', padre: A, link: ['POPS-2'] })], { fuori: [issue('POPS-2', { padre: A })] });
  const story = albero.aree[0].story[0];
  assert.equal(story.key, 'POPS-2');
  assert.equal(story.fuoriSprint, true);
  assert.deepEqual(story.bug.map((b) => b.key), ['POPS-50']);
  assert.equal(albero.numeri.bug.totale, 1);
  assert.equal(albero.numeri.story.totale, 0);
});
