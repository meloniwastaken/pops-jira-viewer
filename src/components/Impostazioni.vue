<script setup>
// Le impostazioni condivise del progetto: stanno su Jira, valgono per tutti, le cambia chi amministra il progetto.
import { onMounted, reactive, ref } from 'vue';
import { api } from '../api.js';
import { avvisa } from '../util.js';
import ScegliPersone from './ScegliPersone.vue';

const props = defineProps({ impostazioni: Object, colori: Array, salvate: Boolean });
const emit = defineEmits(['chiudi', 'salvate']);

const copia = (x) => JSON.parse(JSON.stringify(x));
const v = reactive({
  assegnatari: copia(props.impostazioni.assegnatari),
  creatori: copia(props.impostazioni.creatori),
  // gli stati gia' salvati tengono la loro etichetta: cambiarla toglierebbe lo stato alle issue che ce l'hanno
  stati: props.impostazioni.stati.map((s) => ({ ...s, salvato: true })),
});
const invio = ref(false);
const primo = ref(null);
onMounted(() => primo.value?.focus());

const slug = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
function nuovoStato() {
  v.stati.push({ nome: '', etichetta: '', colore: props.colori[v.stati.length % props.colori.length], salvato: false });
}
function rinomina(s) {
  if (!s.salvato) s.etichetta = slug(s.nome);
}
function sposta(i, d) {
  const [s] = v.stati.splice(i, 1);
  v.stati.splice(i + d, 0, s);
}

async function salva() {
  invio.value = true;
  try {
    const salvate = await api.salvaImpostazioni({
      assegnatari: v.assegnatari,
      creatori: v.creatori,
      stati: v.stati.filter((s) => s.nome.trim()).map(({ nome, etichetta, colore }) => ({ nome: nome.trim(), etichetta, colore })),
    });
    avvisa('Impostazioni salvate su Jira');
    emit('salvate', salvate);
  } catch (e) {
    avvisa(e.message, 'errore');
  } finally {
    invio.value = false;
  }
}
</script>

<template>
  <div class="velo" @click.self="emit('chiudi')" @keydown.esc="emit('chiudi')">
    <form class="finestra" role="dialog" aria-modal="true" aria-labelledby="imp-titolo" @submit.prevent="salva">
      <h2 id="imp-titolo" ref="primo" tabindex="-1">Impostazioni del progetto</h2>
      <p class="tenue">
        Stanno su Jira, nel progetto, e valgono per tutti quelli che usano il viewer.
        <template v-if="!salvate"> Per ora non sono mai state salvate: si vedono quelle predefinite.</template>
      </p>

      <ScegliPersone v-model="v.assegnatari" titolo="Assegnatari rapidi"
        aiuto="Le persone dei filtri in alto e degli elenchi «Assegnatario». Vuoto: chi ha issue assegnate nel progetto." />
      <ScegliPersone v-model="v.creatori" titolo="Filtro per creatore"
        aiuto="Le persone del filtro «Creati da», per vedere le issue che hanno aperto loro." />

      <fieldset class="stati">
        <legend>Stati del team</legend>
        <p class="tenue aiuto">
          Stati in più di quelli di Jira, fatti con le etichette come in LDA: lo stato di Jira non cambia, l'issue prende l'etichetta.
          Scegliendo uno stato di Jira l'etichetta si toglie.
        </p>
        <div v-for="(s, i) in v.stati" :key="i" class="stato">
          <span class="nome">
            <input v-model="s.nome" class="input" placeholder="Nome dello stato" :aria-label="'Nome dello stato ' + (i + 1)" @input="rinomina(s)" />
            <span class="tenue etichetta" title="L'etichetta su Jira">etichetta: {{ s.etichetta || '—' }}</span>
          </span>
          <select v-model="s.colore" class="input" :aria-label="'Colore di ' + (s.nome || 'questo stato')">
            <option v-for="c in colori" :key="c" :value="c">{{ c }}</option>
          </select>
          <span class="pill" :class="'col-' + s.colore">{{ s.nome || 'anteprima' }}</span>
          <span class="mosse">
            <button class="btn piccolo fantasma" type="button" :disabled="i === 0" aria-label="Sposta su" @click="sposta(i, -1)">↑</button>
            <button class="btn piccolo fantasma" type="button" :disabled="i === v.stati.length - 1" aria-label="Sposta giù" @click="sposta(i, 1)">↓</button>
            <button class="btn piccolo fantasma" type="button" :aria-label="'Togli ' + (s.nome || 'lo stato')" @click="v.stati.splice(i, 1)">✕</button>
          </span>
        </div>
        <button class="btn piccolo" type="button" @click="nuovoStato">+ Stato</button>
      </fieldset>

      <div class="bottoni">
        <button class="btn" type="button" @click="emit('chiudi')">Annulla</button>
        <button class="btn primario" type="submit" :disabled="invio">{{ invio ? 'Salvo…' : 'Salva' }}</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.velo { position: fixed; inset: 0; background: rgba(10, 14, 20, 0.45); display: grid; place-items: center; padding: 16px; z-index: 40; }
.finestra {
  width: min(680px, 100%); max-height: calc(100vh - 32px); overflow-y: auto; background: var(--carta); border-radius: 12px;
  padding: 20px; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25);
}
h2 { margin: 0; font-size: 18px; }
h2:focus { outline: none; }
p { margin: 0; }
.stati { border: 1px solid var(--linea); border-radius: 8px; padding: 10px 12px 12px; margin: 0; display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
legend { font-weight: 600; padding: 0 4px; }
.aiuto { font-size: 12.5px; }
.stato { display: grid; grid-template-columns: minmax(0, 1.4fr) 108px minmax(0, 1fr) auto; gap: 8px; align-items: start; width: 100%; }
.nome { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.stato > .pill { margin-top: 8px; }
.stato > .mosse { margin-top: 2px; }
.pill {
  justify-self: start; border-radius: 4px; padding: 1px 7px; font-size: 11.5px; font-weight: 600; text-transform: uppercase; white-space: nowrap;
  background: var(--st-bg); color: var(--st); max-width: 100%; overflow: hidden; text-overflow: ellipsis;
}
.etichetta { font-family: ui-monospace, Consolas, monospace; font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mosse { display: flex; }
.bottoni { display: flex; justify-content: flex-end; gap: 8px; }
@media (max-width: 600px) {
  .stato { grid-template-columns: minmax(0, 1fr) 100px auto; }
  .stato > .pill { display: none; }
}
</style>
