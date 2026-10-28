<script setup>
import { computed } from 'vue';

const props = defineProps({ conteggio: Object, etichetta: { type: Boolean, default: true } });
const pct = (n) => (props.conteggio?.totale ? (100 * n) / props.conteggio.totale : 0);
const testo = computed(() => {
  const c = props.conteggio || {};
  return `${c.fatte || 0} su ${c.totale || 0} completati${c.inCorso ? `, ${c.inCorso} in corso` : ''}`;
});
</script>

<template>
  <span class="avanzamento" :title="testo">
    <span class="barra" role="img" :aria-label="testo">
      <span class="f" :style="{ width: pct(conteggio?.fatte) + '%' }"></span>
      <span class="c" :style="{ width: pct(conteggio?.inCorso) + '%' }"></span>
    </span>
    <span v-if="etichetta" class="num">{{ conteggio?.fatte || 0 }}/{{ conteggio?.totale || 0 }}</span>
  </span>
</template>

<style scoped>
.avanzamento { display: inline-flex; align-items: center; gap: 8px; }
.barra { width: 90px; }
.num { font-size: 12.5px; color: var(--tenue); font-variant-numeric: tabular-nums; min-width: 34px; }
</style>
