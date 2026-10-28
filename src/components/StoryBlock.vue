<script setup>
import { computed, ref } from 'vue';
import StatoPill from './StatoPill.vue';
import Persona from './Persona.vue';
import Avanzamento from './Avanzamento.vue';

const props = defineProps({
  story: Object,
  area: Object,
  destinazioni: Array, // sprint in cui si puo' spostare (attivo e futuri), senza quello corrente
  corrente: [Number, String],
  selezionata: String,
  solaLettura: Boolean, // sprint chiuso
});
const emit = defineEmits(['apri', 'nuova', 'sposta']);

const aperta = ref(true);
const eBug = computed(() => /bug/i.test(props.story.tipo));
const figli = computed(() => props.story.task.length + props.story.bug.length);

function sposta(ev) {
  const v = ev.target.value;
  ev.target.value = '';
  if (v) emit('sposta', props.story, v === 'backlog' ? 'backlog' : Number(v));
}
</script>

<template>
  <div class="story">
    <div class="riga" :class="{ sel: selezionata === story.key }">
      <button
        class="chev" type="button" :disabled="!figli" :aria-expanded="aperta"
        :aria-label="(aperta ? 'Chiudi ' : 'Apri ') + story.titolo" @click="aperta = !aperta"
      >
        <span :class="{ giu: aperta && figli }">▸</span>
      </button>
      <button class="titolo" type="button" @click="emit('apri', story.key)">
        <span class="chiave">{{ story.key }}</span>
        <span v-if="eBug" class="segno-bug">Bug</span>
        <span class="testo">{{ story.titolo }}</span>
        <span v-if="story.fuoriSprint" class="segno" title="La funzionalità è in un altro sprint: qui ci sono solo i suoi task di questo sprint">fuori sprint</span>
      </button>
      <StatoPill :stato="story.stato" :categoria="story.categoria" />
      <Avanzamento :conteggio="story.avanzamento" />
      <span v-if="!solaLettura" class="azioni">
        <template v-if="!eBug">
          <button class="btn piccolo fantasma" type="button" title="Nuovo task in questa funzionalità"
            @click="emit('nuova', { tipo: 'sottotask', padre: story })">+ Task</button>
          <button class="btn piccolo fantasma" type="button" title="Nuovo bug collegato a questa funzionalità"
            @click="emit('nuova', { tipo: 'bug', padre: area, collegaA: story })">+ Bug</button>
        </template>
        <select v-if="!story.fuoriSprint" class="input sposta" aria-label="Sposta la funzionalità in un altro sprint" @change="sposta">
          <option value="">Sposta…</option>
          <option v-for="s in destinazioni" :key="s.id" :value="s.id">{{ s.nome }}</option>
          <option v-if="corrente !== 'backlog'" value="backlog">Backlog</option>
        </select>
      </span>
    </div>
    <ul v-if="aperta && figli" class="figli">
      <li v-for="t in [...story.task, ...story.bug]" :key="t.key">
        <button class="figlio" :class="{ sel: selezionata === t.key }" type="button" @click="emit('apri', t.key)">
          <span class="chiave">{{ t.key }}</span>
          <span v-if="/bug/i.test(t.tipo)" class="segno-bug">Bug</span>
          <span class="testo">{{ t.titolo }}</span>
          <StatoPill :stato="t.stato" :categoria="t.categoria" />
          <Persona :persona="t.assegnatario" />
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.story { border-top: 1px solid var(--linea); }
.riga {
  display: grid; grid-template-columns: 24px minmax(0, 1fr) 118px 136px auto; align-items: center;
  gap: 10px; padding: 7px 12px 7px 6px;
}
.riga.sel, .figlio.sel { background: var(--accento-tenue); }
.chev { border: 0; background: none; cursor: pointer; color: var(--tenue); width: 24px; height: 24px; border-radius: 4px; }
.chev:disabled { visibility: hidden; }
.chev span { display: inline-block; transition: transform 0.12s; }
.chev .giu { transform: rotate(90deg); }
.titolo {
  border: 0; background: none; text-align: left; cursor: pointer; padding: 0; min-width: 0;
  display: flex; gap: 8px; align-items: baseline; font-weight: 600;
}
.titolo:hover .testo, .figlio:hover .testo { text-decoration: underline; }
.testo { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.segno { font-size: 11.5px; color: var(--avviso); background: var(--avviso-bg); border-radius: 4px; padding: 1px 6px; white-space: nowrap; }
.segno-bug { font-size: 11px; font-weight: 700; color: var(--bug); background: var(--bug-bg); border-radius: 4px; padding: 0 5px; }
.azioni { display: flex; gap: 2px; align-items: center; justify-content: flex-end; width: 236px; }
.sposta { padding: 2px 4px; font-size: 12.5px; width: 92px; }
.figli { list-style: none; margin: 0; padding: 0 0 6px; }
.figlio {
  width: 100%; border: 0; background: none; cursor: pointer; text-align: left;
  display: grid; grid-template-columns: auto minmax(0, 1fr) 118px 110px; align-items: center; gap: 10px;
  padding: 5px 12px 5px 40px;
}
.figlio:has(.segno-bug) { grid-template-columns: auto auto minmax(0, 1fr) 118px 110px; }
.figlio:hover { background: var(--carta-2); }
@media (max-width: 760px) {
  .riga { grid-template-columns: 24px minmax(0, 1fr) auto; }
  .azioni { width: auto; }
  .riga > :nth-child(n + 4) { grid-column: 2 / -1; justify-self: start; }
  .figlio { grid-template-columns: minmax(0, 1fr) auto; padding-left: 30px; }
  .figlio .chiave { display: none; }
}
</style>
