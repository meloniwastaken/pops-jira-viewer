<script setup>
import { onMounted, ref } from 'vue';
import { api } from './api.js';
import { avvisi } from './util.js';
import Configurazione from './components/Configurazione.vue';
import Board from './components/Board.vue';

const stato = ref(null);
const errore = ref('');

async function leggiStato() {
  try {
    stato.value = await api.stato();
  } catch (e) {
    errore.value = `Il server locale non risponde: ${e.message}`;
  }
}
onMounted(leggiStato);
</script>

<template>
  <p v-if="errore" class="errore-box" style="margin: 24px">{{ errore }}</p>
  <template v-else-if="stato">
    <Board v-if="stato.configurato" :stato="stato" @scollegato="leggiStato" />
    <Configurazione v-else :stato="stato" @collegato="leggiStato" />
  </template>
  <div class="avvisi" aria-live="polite">
    <div v-for="a in avvisi" :key="a.id" class="avviso" :class="a.tipo">{{ a.testo }}</div>
  </div>
</template>
