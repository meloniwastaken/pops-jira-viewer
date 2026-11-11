<script setup>
// Un elenco di persone da comporre: quelle scelte, con ✕ per toglierle, e una ricerca fra gli utenti del progetto.
import { ref, watch } from 'vue';
import { api } from '../api.js';

const props = defineProps({ titolo: String, aiuto: String, modelValue: Array });
const emit = defineEmits(['update:modelValue']);

const q = ref('');
const trovati = ref([]);
const cerco = ref(false);
let attesa;
watch(q, (testo) => {
  clearTimeout(attesa);
  if (testo.trim().length < 2) {
    trovati.value = [];
    return;
  }
  attesa = setTimeout(async () => {
    cerco.value = true;
    try {
      const scelti = new Set(props.modelValue.map((p) => p.accountId));
      trovati.value = (await api.utenti(testo)).filter((u) => !scelti.has(u.accountId));
    } catch {
      trovati.value = [];
    } finally {
      cerco.value = false;
    }
  }, 250);
});

function aggiungi(u) {
  emit('update:modelValue', [...props.modelValue, u]);
  q.value = '';
  trovati.value = [];
}
function togli(u) {
  emit('update:modelValue', props.modelValue.filter((p) => p.accountId !== u.accountId));
}
</script>

<template>
  <fieldset class="persone">
    <legend>{{ titolo }}</legend>
    <p v-if="aiuto" class="tenue aiuto">{{ aiuto }}</p>
    <ul class="scelti">
      <li v-for="p in modelValue" :key="p.accountId">
        {{ p.nome }}
        <button class="togli" type="button" :aria-label="'Togli ' + p.nome" @click="togli(p)">✕</button>
      </li>
      <li v-if="!modelValue.length" class="tenue vuoto">Nessuno</li>
    </ul>
    <div class="cerca">
      <input v-model="q" class="input" type="search" placeholder="Cerca una persona per aggiungerla" :aria-label="'Aggiungi a ' + titolo" />
      <ul v-if="trovati.length || cerco" class="risultati">
        <li v-if="cerco" class="tenue">Cerco…</li>
        <li v-for="u in trovati" :key="u.accountId">
          <button type="button" @click="aggiungi(u)">{{ u.nome }}</button>
        </li>
      </ul>
    </div>
  </fieldset>
</template>

<style scoped>
.persone { border: 1px solid var(--linea); border-radius: 8px; padding: 10px 12px 12px; margin: 0; }
legend { font-weight: 600; padding: 0 4px; }
.aiuto { margin: 0 0 8px; font-size: 12.5px; }
.scelti { list-style: none; margin: 0 0 8px; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.scelti li:not(.vuoto) {
  display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--linea); border-radius: 99px;
  padding: 2px 4px 2px 10px; background: var(--carta-2);
}
.togli { border: 0; background: none; cursor: pointer; color: var(--tenue); border-radius: 50%; width: 20px; height: 20px; }
.togli:hover { background: var(--bug-bg); color: var(--bug); }
.cerca { position: relative; }
.cerca .input { width: 100%; }
.risultati {
  position: absolute; left: 0; right: 0; top: 100%; z-index: 5; list-style: none; margin: 2px 0 0; padding: 4px 0;
  background: var(--carta); border: 1px solid var(--linea); border-radius: 6px; box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
  max-height: 220px; overflow-y: auto;
}
.risultati li { padding: 0; }
.risultati li.tenue { padding: 6px 10px; }
.risultati button { width: 100%; text-align: left; border: 0; background: none; padding: 6px 10px; cursor: pointer; }
.risultati button:hover { background: var(--accento-tenue); }
</style>
