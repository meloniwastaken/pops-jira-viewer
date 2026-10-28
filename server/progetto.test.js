import { test } from 'node:test';
import assert from 'node:assert/strict';
import { costruisciAlbero } from './progetto.js';

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
    [issue('POPS-6', { padre: A })],
  );
  assert.equal(albero.aree[0].story[0].key, 'POPS-6');
  assert.equal(albero.aree[0].story[0].fuoriSprint, true);
  assert.equal(albero.aree.at(-1).titolo, 'Senza area');
  assert.equal(albero.numeri.story.totale, 1); // la story fuori sprint non si conta
});
