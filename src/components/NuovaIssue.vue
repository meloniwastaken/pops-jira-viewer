<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { api } from '../api.js';
import { avvisa } from '../util.js';

const props = defineProps({
  contesto: Object, // { tipo: 'sottotask'|'bug'|'story', padre, collegaA }
  team: Array,
  io: Object,
  sprint: [Number, String], // lo sprint che si sta guardando
  sprintAperti: { type: Array, default: () => [] }, // attivo e futuri: le destinazioni possibili di bug e funzionalita'
  sprintChiuso: Boolean,
  statiPerTipo: { type: Object, default: () => ({}) },
  tipi: { type: Object, default: () => ({}) },
});
const emit = defineEmits(['chiudi', 'creata']);

const titoli = { sottotask: 'Nuovo task', bug: 'Nuovo bug', story: 'Nuova funzionalità' };
const dove = computed(() => {
  const c = props.contesto;
  if (c.tipo === 'sottotask') return `nella funzionalità ${c.padre.key} «${c.padre.titolo}»`;
  if (c.tipo === 'bug') return `collegato a ${c.collegaA.key} «${c.collegaA.titolo}»`;
  return `nell'area «${c.padre.titolo}»`;
});

// un sottotask sta sempre nello sprint della sua funzionalita'; bug e funzionalita' vanno dove si sceglie.
// Da uno sprint chiuso il bug va di base nel backlog: Jira non mette issue nuove negli sprint chiusi.
const conDestinazione = computed(() => props.contesto.tipo !== 'sottotask');
const stati = computed(() => props.statiPerTipo[props.tipi[props.contesto.tipo]] || []);
const f = reactive({
  titolo: '',
  descrizione: '',
  assegnatario: props.contesto.tipo === 'story' ? '' : props.io.accountId,
  destinazione: !props.sprintChiuso && props.sprint !== 'backlog' ? props.sprint : 'backlog',
  stato: '',
});
const invio = ref(false);
const primo = ref(null);
onMounted(() => primo.value?.focus());

async function crea() {
  invio.value = true;
  try {
    const c = props.contesto;
    const r = await api.crea({
      tipo: c.tipo,
      padre: c.padre?.key || null,
      collegaA: c.collegaA?.key || null,
      titolo: f.titolo,
      descrizione: f.descrizione,
      assegnatario: f.assegnatario || null,
      sprint: conDestinazione.value ? f.destinazione : null,
      stato: f.stato || null,
    });
    avvisa(`Creata ${r.key}`);
    emit('creata', r.key);
  } catch (e) {
    avvisa(e.message, 'errore');
  } finally {
    invio.value = false;
  }
}
</script>

<template>
  <div class="velo" @click.self="emit('chiudi')" @keydown.esc="emit('chiudi')">
    <form class="finestra" role="dialog" aria-modal="true" aria-labelledby="nuova-titolo" @submit.prevent="crea">
      <h2 id="nuova-titolo">{{ titoli[contesto.tipo] }}</h2>
      <p class="tenue">{{ dove }}</p>
      <p v-if="sprintChiuso && contesto.tipo === 'sottotask'" class="nota">
        Il task resta in questo sprint chiuso, con la sua funzionalità: va bene per registrare un lavoro fatto allora.
      </p>
      <label class="campo">
        <span>Titolo</span>
        <input ref="primo" v-model="f.titolo" class="input" required maxlength="250" />
      </label>
      <label class="campo">
        <span>Descrizione</span>
        <textarea v-model="f.descrizione" class="input" rows="6" placeholder="Facoltativa. Se il lavoro nasce da una DEC, scrivi qui il suo ID."></textarea>
      </label>
      <label class="campo">
        <span>Assegnatario</span>
        <select v-model="f.assegnatario" class="input">
          <option value="">Nessuno</option>
          <option v-for="p in team" :key="p.accountId" :value="p.accountId">{{ p.nome }}</option>
        </select>
      </label>
      <div class="riga">
        <label v-if="conDestinazione" class="campo">
          <span>Dove va</span>
          <select v-model="f.destinazione" class="input">
            <option v-for="s in sprintAperti" :key="s.id" :value="s.id">{{ s.nome }}{{ s.stato === 'active' ? ' (attivo)' : '' }}</option>
            <option value="backlog">Backlog</option>
          </select>
        </label>
        <label v-if="stati.length" class="campo">
          <span>Stato iniziale</span>
          <select v-model="f.stato" class="input">
            <option value="">{{ stati[0].nome }}</option>
            <option v-for="s in stati.slice(1)" :key="s.nome" :value="s.nome">{{ s.nome }}</option>
          </select>
        </label>
      </div>
      <p v-if="sprintChiuso && contesto.tipo === 'bug'" class="tenue piccola">
        Jira non mette issue nuove negli sprint chiusi. Il bug resta collegato alla funzionalità, e lo vedi anche qui.
      </p>
      <div class="bottoni">
        <button class="btn" type="button" @click="emit('chiudi')">Annulla</button>
        <button class="btn primario" type="submit" :disabled="invio || !f.titolo.trim()">{{ invio ? 'Creo…' : 'Crea' }}</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.velo { position: fixed; inset: 0; background: rgba(10, 14, 20, 0.45); display: grid; place-items: center; padding: 16px; z-index: 40; }
.finestra {
  width: min(520px, 100%); background: var(--carta); border-radius: 12px; padding: 20px;
  display: flex; flex-direction: column; gap: 12px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25);
}
h2 { margin: 0; font-size: 18px; }
p { margin: 0; }
.bottoni { display: flex; justify-content: flex-end; gap: 8px; }
.riga { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.riga:has(> :only-child) { grid-template-columns: 1fr; }
.nota { background: var(--avviso-bg); color: var(--avviso); border-radius: 6px; padding: 6px 10px; font-size: 13px; }
.piccola { font-size: 12.5px; }
</style>
