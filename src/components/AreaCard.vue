<script setup>
import StoryBlock from './StoryBlock.vue';
import Avanzamento from './Avanzamento.vue';

defineProps({
  area: Object,
  chiusa: Boolean,
  destinazioni: Array,
  corrente: [Number, String],
  selezionata: String,
  solaLettura: Boolean,
});
const emit = defineEmits(['alterna', 'apri', 'nuova', 'sposta']);
</script>

<template>
  <section class="area" :aria-label="'Area ' + area.titolo">
    <header>
      <button class="nome" type="button" :aria-expanded="!chiusa" @click="emit('alterna')">
        <span class="chev" :class="{ giu: !chiusa }" aria-hidden="true">▸</span>
        <h2>{{ area.titolo }}</h2>
      </button>
      <button v-if="area.key" class="btn piccolo fantasma chiave" type="button" @click="emit('apri', area.key)">{{ area.key }}</button>
      <span class="tenue conta">{{ area.story.length }} funzionalità</span>
      <Avanzamento :conteggio="area.avanzamento" />
      <button v-if="area.key && !solaLettura" class="btn piccolo" type="button" @click="emit('nuova', { tipo: 'story', padre: area })">+ Funzionalità</button>
    </header>
    <div v-if="!chiusa">
      <StoryBlock
        v-for="s in area.story" :key="s.key" :story="s" :area="area" :destinazioni="destinazioni" :corrente="corrente"
        :selezionata="selezionata" :sola-lettura="solaLettura"
        @apri="(k) => emit('apri', k)" @nuova="(c) => emit('nuova', c)" @sposta="(s, d) => emit('sposta', s, d)"
      />
    </div>
  </section>
</template>

<style scoped>
.area { background: var(--carta); border: 1px solid var(--linea); border-radius: var(--raggio); box-shadow: var(--ombra); overflow: hidden; }
header { display: flex; align-items: center; gap: 12px; padding: 10px 12px; flex-wrap: wrap; }
.nome { display: flex; align-items: center; gap: 6px; border: 0; background: none; cursor: pointer; padding: 0; margin-right: auto; }
h2 { margin: 0; font-size: 15.5px; }
.chev { color: var(--tenue); display: inline-block; transition: transform 0.12s; width: 18px; text-align: center; }
.chev.giu { transform: rotate(90deg); }
.conta { font-size: 12.5px; }
</style>
