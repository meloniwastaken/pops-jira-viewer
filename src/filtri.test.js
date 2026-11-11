import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filtra, chiaviStati } from './filtri.js';

const persona = (accountId) => ({ accountId, nome: accountId });
const task = (key, { cat = 'new', chiaveStato, assegnatario, creatore } = {}) => ({
  key, titolo: `titolo ${key}`, categoria: cat, chiaveStato: chiaveStato || cat,
  assegnatario: assegnatario ? persona(assegnatario) : null, creatore: creatore ? persona(creatore) : null,
});
const albero = () => [{
  key: 'POPS-1', titolo: 'Accesso',
  story: [
    { ...task('POPS-2', { creatore: 'marco' }), task: [
      task('POPS-3', { assegnatario: 'aurora', creatore: 'nadia' }),
      task('POPS-4', { cat: 'indeterminate', chiaveStato: 'e:in-attesa', assegnatario: 'samuele', creatore: 'marco' }),
      task('POPS-5', { cat: 'done', assegnatario: 'aurora', creatore: 'giulio' }),
    ], bug: [] },
    { ...task('POPS-6', { creatore: 'nadia' }), task: [], bug: [] },
  ],
}];
const base = { persona: 'tutti', creatore: 'tutti', area: '', stati: {}, nascondiFatte: false, q: '' };
const chiavi = (aree) => aree.flatMap((a) => a.story.flatMap((s) => [s.key, ...s.task.map((t) => t.key)]));

test('il filtro per creatore tiene le issue create da quella persona e le funzionalità che le contengono', () => {
  assert.deepEqual(chiavi(filtra(albero(), { ...base, creatore: 'nadia' }, 'marco')), ['POPS-2', 'POPS-3', 'POPS-6']);
  assert.deepEqual(chiavi(filtra(albero(), { ...base, creatore: 'giulio' }, 'marco')), ['POPS-2', 'POPS-5']);
});

test('creatore e assegnatario si sommano', () => {
  assert.deepEqual(chiavi(filtra(albero(), { ...base, creatore: 'nadia', persona: 'aurora' }, 'marco')), ['POPS-2', 'POPS-3']);
  assert.deepEqual(chiavi(filtra(albero(), { ...base, creatore: 'giulio', persona: 'samuele' }, 'marco')), []);
});

test('gli stati del team si filtrano come gli altri, e «nascondi i completati» non li tocca', () => {
  const soloAttesa = { new: false, indeterminate: false, 'e:in-attesa': true, done: false };
  assert.deepEqual(chiavi(filtra(albero(), { ...base, stati: soloAttesa }, 'marco')), ['POPS-2', 'POPS-4']);
  assert.deepEqual(chiavi(filtra(albero(), { ...base, nascondiFatte: true }, 'marco')), ['POPS-2', 'POPS-3', 'POPS-4', 'POPS-6']);
});

test('gli stati dei filtri: quelli di Jira con in mezzo quelli del team', () => {
  assert.deepEqual(chiaviStati([{ etichetta: 'in-attesa', nome: 'In attesa', colore: 'giallo' }]).map((s) => s.chiave),
    ['new', 'indeterminate', 'e:in-attesa', 'done']);
});
