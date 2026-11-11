<script setup>
// Lo stato di un'issue. Con uno stato del team (un'etichetta) si mostra quello, e lo stato di Jira resta nel tooltip.
defineProps({ stato: String, categoria: String, team: Object });
</script>

<template>
  <span v-if="team" class="pill team" :class="'col-' + team.colore" :title="`${team.nome} (su Jira: ${stato})`">{{ team.nome }}</span>
  <span v-else class="pill" :class="categoria">{{ stato }}</span>
</template>

<style scoped>
.pill {
  display: inline-block; justify-self: start; border-radius: 4px; padding: 1px 7px; font-size: 11.5px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.02em; white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis;
  background: var(--nuovo-bg); color: var(--nuovo);
}
.pill.indeterminate { background: var(--corso-bg); color: var(--corso); }
.pill.done { background: var(--fatto-bg); color: var(--fatto); }
.pill.team { background: var(--st-bg); color: var(--st); }
</style>
