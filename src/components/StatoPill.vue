<script setup>
defineProps({ stato: String, categoria: String });
</script>

<template>
  <span class="pill" :class="categoria">{{ stato }}</span>
</template>

<style scoped>
.pill {
  display: inline-block; justify-self: start; border-radius: 4px; padding: 1px 7px; font-size: 11.5px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.02em; white-space: nowrap;
  background: var(--nuovo-bg); color: var(--nuovo);
}
.pill.indeterminate { background: var(--corso-bg); color: var(--corso); }
.pill.done { background: var(--fatto-bg); color: var(--fatto); }
</style>
