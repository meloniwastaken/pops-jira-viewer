<script setup>
import { reactive, ref } from 'vue';
import { api } from '../api.js';

const props = defineProps({ stato: Object });
const emit = defineEmits(['collegato']);

const f = reactive({
  url: props.stato?.url || '',
  progetto: props.stato?.progetto || 'POPS',
  email: props.stato?.email || '',
  token: '',
});
const invio = ref(false);
const errore = ref('');

async function collega() {
  invio.value = true;
  errore.value = '';
  try {
    await api.configura(f);
    emit('collegato');
  } catch (e) {
    errore.value = e.message;
  } finally {
    invio.value = false;
  }
}
</script>

<template>
  <main class="config">
    <form class="scheda" @submit.prevent="collega">
      <h1>POPS Jira Viewer</h1>
      <p class="tenue">Collega il viewer al tuo Jira. Le credenziali restano su questo PC, nella cartella <code>.pops-jira-viewer</code> del tuo utente.</p>
      <label class="campo">
        <span>Indirizzo di Jira</span>
        <input v-model="f.url" class="input" type="url" required placeholder="https://nomeazienda.atlassian.net" autocomplete="url" />
      </label>
      <label class="campo">
        <span>Chiave del progetto</span>
        <input v-model="f.progetto" class="input" required placeholder="POPS" />
      </label>
      <label class="campo">
        <span>La tua email Jira</span>
        <input v-model="f.email" class="input" type="email" required autocomplete="email" />
      </label>
      <label class="campo">
        <span>API token
          (<a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener">crealo qui</a>)</span>
        <input v-model="f.token" class="input" type="password" required autocomplete="off" />
      </label>
      <p v-if="errore" class="errore-box" role="alert">{{ errore }}</p>
      <button class="btn primario" type="submit" :disabled="invio">{{ invio ? 'Verifico…' : 'Collega' }}</button>
    </form>
  </main>
</template>

<style scoped>
.config { min-height: 100vh; display: grid; place-items: center; padding: 16px; }
.scheda {
  width: min(440px, 100%); background: var(--carta); border: 1px solid var(--linea); border-radius: 12px;
  padding: 24px; display: flex; flex-direction: column; gap: 14px; box-shadow: var(--ombra);
}
h1 { margin: 0; font-size: 20px; }
p { margin: 0; }
.btn.primario { justify-content: center; padding: 8px; }
</style>
