<script setup>
import { computed } from 'vue';
import { iniziali, nomeBreve } from '../util.js';

const props = defineProps({ persona: Object, soloIniziali: Boolean });
// un colore stabile per persona
const tinta = computed(() => {
  const s = props.persona?.accountId || '';
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
});
</script>

<template>
  <span v-if="persona" class="persona" :title="persona.nome">
    <span class="tondo" :style="{ '--h': tinta }" aria-hidden="true">{{ iniziali(persona.nome) }}</span>
    <span v-if="!soloIniziali" class="nome">{{ nomeBreve(persona.nome) }}</span>
    <span v-else class="sr">{{ persona.nome }}</span>
  </span>
  <span v-else class="persona tenue" title="Nessun assegnatario">
    <span class="tondo vuoto" aria-hidden="true">–</span>
    <span v-if="!soloIniziali" class="nome">nessuno</span>
    <span v-else class="sr">Nessun assegnatario</span>
  </span>
</template>

<style scoped>
.persona { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.tondo {
  width: 22px; height: 22px; border-radius: 50%; display: inline-grid; place-items: center;
  font-size: 10px; font-weight: 700; color: hsl(var(--h) 55% 30%); background: hsl(var(--h) 60% 88%);
}
@media (prefers-color-scheme: dark) {
  .tondo { color: hsl(var(--h) 60% 85%); background: hsl(var(--h) 35% 28%); }
}
.tondo.vuoto { background: var(--nuovo-bg); color: var(--tenue); }
.nome { font-size: 13px; }
</style>
