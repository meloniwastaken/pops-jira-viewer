<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { api } from '../api.js';
import { avvisa, descriviSprint, filtra, nomeBreve, percentuale } from '../util.js';
import AreaCard from './AreaCard.vue';
import Avanzamento from './Avanzamento.vue';
import PannelloIssue from './PannelloIssue.vue';
import NuovaIssue from './NuovaIssue.vue';

defineProps({ stato: Object });
const emit = defineEmits(['scollegato']);

const meta = ref(null);
const scelto = ref(null); // id dello sprint, o 'backlog'
const dati = ref(null);
const caricando = ref(false);
const errore = ref('');
const aperta = ref(null); // chiave dell'issue nel pannello
const nuova = ref(null); // contesto della finestra di creazione
const chiuse = reactive(new Set()); // aree chiuse
const cerca = ref(null);
const f = reactive({ persona: 'tutti', area: '', stati: { new: true, indeterminate: true, done: true }, nascondiFatte: true, q: '' });

// --- sprint ---
const gruppi = computed(() => {
  const s = meta.value?.sprint || [];
  const perInizio = (a, b) => (a.inizio || '9').localeCompare(b.inizio || '9') || a.id - b.id;
  return {
    attivi: s.filter((x) => x.stato === 'active'),
    futuri: s.filter((x) => x.stato === 'future').sort(perInizio),
    chiusi: s.filter((x) => x.stato === 'closed').sort((a, b) => -perInizio(a, b)),
  };
});
const sprint = computed(() => dati.value?.sprint || null);
const destinazioni = computed(() => [...gruppi.value.attivi, ...gruppi.value.futuri].filter((s) => s.id !== scelto.value));

// --- filtri ---
const vista = computed(() => (dati.value ? filtra(dati.value.aree, f, meta.value.io.accountId) : []));
const filtriAttivi = computed(() => f.persona !== 'tutti' || f.area || f.q || !f.stati.new || !f.stati.indeterminate || !f.stati.done);
function azzera() {
  Object.assign(f, { persona: 'tutti', area: '', q: '' });
  Object.assign(f.stati, { new: true, indeterminate: true, done: true });
}
const persone = computed(() => (meta.value?.team || []).filter((p) => p.accountId !== meta.value.io.accountId));

// --- caricamento ---
let ultimo = 0;
async function carica({ silenzioso = false, fresco = false } = {}) {
  if (scelto.value == null) return;
  if (!silenzioso) caricando.value = true;
  errore.value = '';
  try {
    dati.value = await api.sprint(scelto.value, fresco);
    ultimo = Date.now();
  } catch (e) {
    if (e.configura) return emit('scollegato');
    errore.value = e.message;
  } finally {
    caricando.value = false;
  }
}
async function aggiorna() {
  try {
    meta.value = await api.meta(true);
  } catch (e) {
    if (e.configura) return emit('scollegato');
  }
  await carica({ fresco: true });
  avvisa('Aggiornato');
}

watch(scelto, (id, prima) => {
  const s = meta.value.sprint.find((x) => x.id === id);
  // negli sprint chiusi si vuole vedere tutto, negli altri il lavoro che resta
  if (prima !== null) f.nascondiFatte = !(s?.stato === 'closed');
  dati.value = null;
  carica();
});

// --- indirizzo della pagina: sprint e filtri restano dopo un ricarica ---
function scriviUrl() {
  const p = new URLSearchParams();
  if (scelto.value != null) p.set('sprint', scelto.value);
  if (f.persona !== 'tutti') p.set('persona', f.persona);
  if (f.area) p.set('area', f.area);
  if (f.q) p.set('q', f.q);
  if (!f.nascondiFatte) p.set('fatte', '1');
  if (aperta.value) p.set('issue', aperta.value);
  history.replaceState(null, '', `${location.pathname}${p.size ? '?' + p : ''}`);
}
watch([scelto, aperta, () => ({ ...f })], scriviUrl, { deep: true });

function tastiera(ev) {
  if (ev.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName)) {
    ev.preventDefault();
    cerca.value?.focus();
  } else if (ev.key === 'Escape' && !nuova.value && aperta.value) {
    aperta.value = null;
  }
}
function visibile() {
  if (document.visibilityState === 'visible' && Date.now() - ultimo > 60_000) carica({ silenzioso: true });
}
let timer;
onMounted(async () => {
  try {
    meta.value = await api.meta();
  } catch (e) {
    if (e.configura) return emit('scollegato');
    errore.value = e.message;
    return;
  }
  const p = new URLSearchParams(location.search);
  const daUrl = p.get('sprint');
  const valido = daUrl === 'backlog' || meta.value.sprint.some((s) => String(s.id) === daUrl);
  f.persona = p.get('persona') || 'tutti';
  f.area = p.get('area') || '';
  f.q = p.get('q') || '';
  aperta.value = p.get('issue');
  const iniziale = valido ? (daUrl === 'backlog' ? 'backlog' : Number(daUrl))
    : (gruppi.value.attivi[0] || gruppi.value.futuri[0])?.id ?? 'backlog';
  const s = meta.value.sprint.find((x) => x.id === iniziale);
  f.nascondiFatte = p.get('fatte') === '1' ? false : s?.stato !== 'closed';
  scelto.value = iniziale;
  document.addEventListener('keydown', tastiera);
  document.addEventListener('visibilitychange', visibile);
  timer = setInterval(() => document.visibilityState === 'visible' && carica({ silenzioso: true }), 3 * 60_000);
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', tastiera);
  document.removeEventListener('visibilitychange', visibile);
  clearInterval(timer);
});

// --- azioni ---
async function sposta(story, destinazione) {
  const nome = destinazione === 'backlog' ? 'Backlog' : meta.value.sprint.find((s) => s.id === destinazione)?.nome;
  try {
    await api.sposta(story.key, destinazione);
    avvisa(`${story.key} spostata in ${nome}`);
    carica({ silenzioso: true });
  } catch (e) {
    avvisa(e.message, 'errore');
  }
}
function creata(key) {
  nuova.value = null;
  aperta.value = key;
  carica({ silenzioso: true });
}
async function esci() {
  if (!confirm('Scollego il viewer da Jira e cancello le credenziali salvate su questo PC?')) return;
  await api.esci();
  emit('scollegato');
}
</script>

<template>
  <div class="board" :class="{ conpannello: aperta }">
    <header class="barra-alta">
      <div class="progetto">
        <strong>{{ meta?.progetto.key || stato.progetto }}</strong>
        <span class="tenue nome-progetto">{{ meta?.progetto.nome }}</span>
      </div>
      <label class="scelta-sprint">
        <span class="sr">Sprint</span>
        <select v-model="scelto" class="input" :disabled="!meta">
          <optgroup v-if="gruppi.attivi.length" label="Attivo">
            <option v-for="s in gruppi.attivi" :key="s.id" :value="s.id">{{ s.nome }}</option>
          </optgroup>
          <optgroup v-if="gruppi.futuri.length" label="Futuri">
            <option v-for="s in gruppi.futuri" :key="s.id" :value="s.id">{{ s.nome }}</option>
          </optgroup>
          <optgroup v-if="gruppi.chiusi.length" label="Chiusi">
            <option v-for="s in gruppi.chiusi" :key="s.id" :value="s.id">{{ s.nome }}</option>
          </optgroup>
          <option value="backlog">Backlog</option>
        </select>
      </label>
      <div class="destra">
        <button class="btn" type="button" :disabled="caricando" @click="aggiorna">{{ caricando ? 'Carico…' : 'Aggiorna' }}</button>
        <span v-if="meta" class="tenue io">{{ meta.io.nome }}</span>
        <button v-if="!stato.daAmbiente" class="btn fantasma piccolo" type="button" @click="esci">Esci</button>
      </div>
    </header>

    <main class="contenuto">
      <p v-if="errore" class="errore-box">{{ errore }}</p>

      <section v-if="dati" class="riepilogo">
        <div class="titolo-sprint">
          <h1>{{ sprint ? sprint.nome : 'Backlog' }}</h1>
          <p class="tenue">{{ sprint ? descriviSprint(sprint) : 'Le funzionalità che non sono in nessuno sprint' }}</p>
          <p v-if="sprint?.obiettivo" class="obiettivo">{{ sprint.obiettivo }}</p>
        </div>
        <div class="numeri">
          <div class="numero">
            <span class="grande">{{ percentuale(dati.numeri.task) }}%</span>
            <span class="tenue">task completati</span>
            <Avanzamento :conteggio="dati.numeri.task" />
          </div>
          <div class="numero">
            <span class="grande">{{ dati.numeri.story.fatte }}<small>/{{ dati.numeri.story.totale }}</small></span>
            <span class="tenue">funzionalità completate</span>
          </div>
          <div class="numero">
            <span class="grande">{{ dati.numeri.task.inCorso }}</span>
            <span class="tenue">task in corso</span>
          </div>
          <div class="numero">
            <span class="grande">{{ dati.numeri.task.daFare }}</span>
            <span class="tenue">task da fare</span>
          </div>
          <div v-if="dati.numeri.bug.totale" class="numero bug">
            <span class="grande">{{ dati.numeri.bug.totale - dati.numeri.bug.fatte }}</span>
            <span class="tenue">bug aperti</span>
          </div>
        </div>
      </section>

      <section v-if="meta" class="filtri" aria-label="Filtri">
        <div class="persone" role="group" aria-label="Persona">
          <button type="button" class="chip" :aria-pressed="f.persona === 'tutti'" @click="f.persona = 'tutti'">Tutti</button>
          <button type="button" class="chip" :aria-pressed="f.persona === 'mie'" @click="f.persona = 'mie'">Le mie</button>
          <button v-for="p in persone" :key="p.accountId" type="button" class="chip" :aria-pressed="f.persona === p.accountId"
            @click="f.persona = p.accountId">{{ nomeBreve(p.nome) }}</button>
          <button type="button" class="chip" :aria-pressed="f.persona === 'nessuno'" @click="f.persona = 'nessuno'">Non assegnati</button>
        </div>
        <div class="altri">
          <select v-model="f.area" class="input" aria-label="Area">
            <option value="">Tutte le aree</option>
            <option v-for="a in dati?.aree.filter((a) => a.key) || []" :key="a.key" :value="a.key">{{ a.titolo }}</option>
          </select>
          <span class="stati" role="group" aria-label="Stati">
            <label><input v-model="f.stati.new" type="checkbox" /> Da fare</label>
            <label><input v-model="f.stati.indeterminate" type="checkbox" /> In corso</label>
            <label><input v-model="f.stati.done" type="checkbox" :disabled="f.nascondiFatte" /> Completati</label>
          </span>
          <label class="nascondi"><input v-model="f.nascondiFatte" type="checkbox" /> Nascondi i completati</label>
          <input ref="cerca" v-model="f.q" class="input ricerca" type="search" placeholder="Cerca per chiave o titolo  ( / )" aria-label="Cerca" />
          <button v-if="filtriAttivi" class="btn piccolo fantasma" type="button" @click="azzera">Azzera filtri</button>
        </div>
      </section>

      <p v-if="caricando && !dati" class="tenue">Carico lo sprint…</p>
      <div v-else-if="dati" class="aree">
        <AreaCard
          v-for="a in vista" :key="a.key || 'senza'" :area="a" :chiusa="chiuse.has(a.key)" :destinazioni="destinazioni"
          :corrente="scelto" :selezionata="aperta" :sola-lettura="sprint?.stato === 'closed'"
          @alterna="chiuse.has(a.key) ? chiuse.delete(a.key) : chiuse.add(a.key)"
          @apri="(k) => (aperta = k)" @nuova="(c) => (nuova = c)" @sposta="sposta"
        />
        <p v-if="!vista.length" class="vuoto tenue">
          <template v-if="!dati.aree.length">In questo sprint non c'è niente.</template>
          <template v-else>Nessuna issue con questi filtri.
            <button class="btn piccolo" type="button" @click="azzera(); f.nascondiFatte = false">Mostra tutto</button>
          </template>
        </p>
      </div>
    </main>

    <PannelloIssue
      v-if="aperta && meta" :chiave="aperta" :team="meta.team" :url="meta.url"
      @chiudi="aperta = null" @aggiornata="carica({ silenzioso: true })" @apri="(k) => (aperta = k)" @nuova="(c) => (nuova = c)"
    />
    <NuovaIssue
      v-if="nuova" :contesto="nuova" :team="meta.team" :io="meta.io" :sprint="scelto"
      @chiudi="nuova = null" @creata="creata"
    />
  </div>
</template>

<style scoped>
.barra-alta {
  position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
  padding: 10px 20px; background: var(--carta); border-bottom: 1px solid var(--linea);
}
.progetto { display: flex; gap: 8px; align-items: baseline; }
.scelta-sprint select { font-weight: 600; min-width: 180px; }
.destra { margin-left: auto; display: flex; align-items: center; gap: 10px; }
.contenuto { max-width: 1180px; margin: 0 auto; padding: 18px 20px 60px; display: flex; flex-direction: column; gap: 14px; }
@media (min-width: 1500px) { .board.conpannello .contenuto { margin-right: 580px; margin-left: 20px; } }

.riepilogo { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; flex-wrap: wrap; }
h1 { margin: 0; font-size: 24px; }
.titolo-sprint p { margin: 2px 0 0; }
.obiettivo { font-style: italic; }
.numeri { display: flex; gap: 10px; flex-wrap: wrap; }
.numero {
  background: var(--carta); border: 1px solid var(--linea); border-radius: var(--raggio); padding: 8px 14px;
  display: flex; flex-direction: column; gap: 2px; min-width: 120px; box-shadow: var(--ombra);
}
.numero .tenue { font-size: 12.5px; }
.grande { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
.grande small { font-size: 14px; color: var(--tenue); font-weight: 600; }
.numero.bug .grande { color: var(--bug); }

.filtri { display: flex; flex-direction: column; gap: 8px; }
.persone { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { border: 1px solid var(--linea); background: var(--carta); border-radius: 99px; padding: 3px 12px; cursor: pointer; }
.chip[aria-pressed='true'] { background: var(--accento); border-color: var(--accento); color: var(--su-accento); }
.altri { display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: center; }
.stati { display: flex; gap: 10px; }
.stati label, .nascondi { display: inline-flex; gap: 5px; align-items: center; cursor: pointer; white-space: nowrap; }
.ricerca { flex: 1; min-width: 200px; }
.aree { display: flex; flex-direction: column; gap: 12px; }
.vuoto { text-align: center; padding: 30px; }
@media (max-width: 640px) {
  .barra-alta { padding: 8px 16px; }
  .nome-progetto, .io { display: none; }
  .contenuto { padding: 14px 16px 60px; }
}
</style>
