<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import DOMPurify from 'dompurify';
import { api } from '../api.js';
import { avvisa, quando, data } from '../util.js';
import StatoPill from './StatoPill.vue';
import Persona from './Persona.vue';

const props = defineProps({ chiave: String, team: Array, url: String });
const emit = defineEmits(['chiudi', 'aggiornata', 'apri', 'nuova']);

const d = ref(null);
const errore = ref('');
const lavoro = ref(false);
const commento = ref('');
const titolo = ref(null);

async function carica(focus = false) {
  errore.value = '';
  try {
    d.value = await api.issue(props.chiave);
    if (focus) nextTick(() => titolo.value?.focus());
  } catch (e) {
    errore.value = e.message;
  }
}
watch(() => props.chiave, () => { d.value = null; carica(true); }, { immediate: true });

// l'HTML di Jira, ripulito, con i link relativi resi assoluti
const pulisci = (html) => DOMPurify.sanitize((html || '').replaceAll('href="/', `href="${props.url}/`).replaceAll('src="/', `src="${props.url}/`));
const descrizione = computed(() => pulisci(d.value?.descrizioneHtml));
const transizioni = computed(() => (d.value?.transizioni || []).filter((t) => t.a !== d.value.stato));
const eStory = computed(() => d.value && !d.value.sottotask && d.value.livello === 0 && !/bug/i.test(d.value.tipo));

async function azione(fn, messaggio) {
  lavoro.value = true;
  try {
    await fn();
    avvisa(messaggio);
    await carica();
    emit('aggiornata');
  } catch (e) {
    avvisa(e.message, 'errore');
  } finally {
    lavoro.value = false;
  }
}

function cambiaStato(ev) {
  const id = ev.target.value;
  const t = transizioni.value.find((x) => x.id === id);
  ev.target.value = '';
  if (t) azione(() => api.transizione(props.chiave, id), `${props.chiave}: ${t.a}`);
}
function assegna(ev) {
  const id = ev.target.value;
  const nome = props.team.find((p) => p.accountId === id)?.nome || 'nessuno';
  azione(() => api.assegna(props.chiave, id || null), `${props.chiave} assegnato a ${nome}`);
}
function commenta() {
  const testo = commento.value;
  azione(async () => { await api.commenta(props.chiave, testo); commento.value = ''; }, 'Commento aggiunto');
}
async function copiaPerClaude() {
  try {
    const testo = await api.perClaude(props.chiave);
    await navigator.clipboard.writeText(testo);
    avvisa('Copiato: incollalo in Claude Code');
  } catch (e) {
    avvisa(`Non riesco a copiare: ${e.message}`, 'errore');
  }
}
</script>

<template>
  <aside class="pannello" aria-labelledby="pannello-titolo" @keydown.esc="emit('chiudi')">
    <div class="testa">
      <nav class="briciole" aria-label="Percorso">
        <template v-if="d?.area">
          <button class="link" type="button" @click="emit('apri', d.area.key)">{{ d.area.titolo }}</button>
          <span aria-hidden="true">›</span>
        </template>
        <template v-if="d?.padre && d.padre.livello !== 1">
          <button class="link" type="button" @click="emit('apri', d.padre.key)">{{ d.padre.titolo }}</button>
          <span aria-hidden="true">›</span>
        </template>
        <span class="chiave">{{ chiave }}</span>
      </nav>
      <button class="btn piccolo fantasma" type="button" aria-label="Chiudi il dettaglio" @click="emit('chiudi')">✕</button>
    </div>

    <p v-if="errore" class="errore-box">{{ errore }}</p>
    <p v-else-if="!d" class="tenue">Carico {{ chiave }}…</p>
    <template v-else>
      <h2 id="pannello-titolo" ref="titolo" tabindex="-1">{{ d.titolo }}</h2>
      <p class="tenue info">
        {{ d.tipo }} · creata il {{ data(d.creata, true) }}<template v-if="d.autore"> da {{ d.autore }}</template>
        <template v-if="d.risolta"> · completata il {{ data(d.risolta, true) }}</template>
      </p>

      <div class="comandi">
        <label class="campo">
          <span>Stato</span>
          <span class="riga-stato">
            <StatoPill :stato="d.stato" :categoria="d.categoria" />
            <select class="input" :disabled="lavoro || !transizioni.length" aria-label="Cambia stato" @change="cambiaStato">
              <option value="">Sposta in…</option>
              <option v-for="t in transizioni" :key="t.id" :value="t.id">{{ t.a }}</option>
            </select>
          </span>
        </label>
        <label class="campo">
          <span>Assegnatario</span>
          <select class="input" :value="d.assegnatario?.accountId || ''" :disabled="lavoro" @change="assegna">
            <option value="">Nessuno</option>
            <option v-for="p in team" :key="p.accountId" :value="p.accountId">{{ p.nome }}</option>
            <option v-if="d.assegnatario && !team.some((p) => p.accountId === d.assegnatario.accountId)" :value="d.assegnatario.accountId">
              {{ d.assegnatario.nome }}
            </option>
          </select>
        </label>
      </div>
      <div class="bottoni">
        <button class="btn" type="button" title="Copia il task in Markdown, da incollare in Claude Code" @click="copiaPerClaude">Copia per Claude</button>
        <a class="btn" :href="d.url" target="_blank" rel="noopener">Apri in Jira ↗</a>
      </div>

      <section v-if="eStory">
        <div class="titolo-sez">
          <h3>Task</h3>
          <button class="btn piccolo" type="button" @click="emit('nuova', { tipo: 'sottotask', padre: d })">+ Task</button>
        </div>
        <ul v-if="d.sottotaskDi.length" class="lista">
          <li v-for="t in d.sottotaskDi" :key="t.key">
            <button class="voce" type="button" @click="emit('apri', t.key)">
              <span class="chiave">{{ t.key }}</span><span class="testo">{{ t.titolo }}</span>
              <StatoPill :stato="t.stato" :categoria="t.categoria" /><Persona :persona="t.assegnatario" solo-iniziali />
            </button>
          </li>
        </ul>
        <p v-else class="tenue">Nessun task.</p>
      </section>

      <section>
        <h3>Descrizione</h3>
        <div v-if="descrizione" class="html" v-html="descrizione"></div>
        <p v-else class="tenue">Nessuna descrizione.</p>
      </section>

      <section v-if="d.link.length">
        <h3>Collegate</h3>
        <ul class="lista">
          <li v-for="l in d.link" :key="l.key">
            <button class="voce" type="button" @click="emit('apri', l.key)">
              <span class="tenue">{{ l.tipo }}</span><span class="chiave">{{ l.key }}</span><span class="testo">{{ l.titolo }}</span>
              <StatoPill :stato="l.stato" :categoria="l.categoria" />
            </button>
          </li>
        </ul>
      </section>

      <section>
        <h3>Commenti</h3>
        <article v-for="c in d.commenti" :key="c.id" class="commento">
          <p class="tenue"><strong>{{ c.autore }}</strong> · {{ quando(c.quando) }}</p>
          <div class="html" v-html="pulisci(c.html)"></div>
        </article>
        <form class="nuovo-commento" @submit.prevent="commenta">
          <label class="sr" for="nuovo-commento">Nuovo commento</label>
          <textarea id="nuovo-commento" v-model="commento" class="input" rows="3" placeholder="Scrivi un commento"></textarea>
          <button class="btn" type="submit" :disabled="lavoro || !commento.trim()">Commenta</button>
        </form>
      </section>
    </template>
  </aside>
</template>

<style scoped>
.pannello {
  position: fixed; top: 0; right: 0; bottom: 0; width: min(560px, 100vw); background: var(--carta);
  border-left: 1px solid var(--linea); box-shadow: -8px 0 30px rgba(0, 0, 0, 0.12);
  overflow-y: auto; padding: 14px 20px 32px; z-index: 30; display: flex; flex-direction: column; gap: 12px;
}
.testa { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.briciole { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 13px; color: var(--tenue); min-width: 0; }
.link { border: 0; background: none; padding: 0; color: var(--accento); cursor: pointer; text-align: left; }
.link:hover { text-decoration: underline; }
h2 { margin: 0; font-size: 19px; line-height: 1.3; }
h2:focus { outline: none; }
h3 { margin: 0 0 6px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--tenue); }
.info { margin: -6px 0 0; font-size: 13px; }
.comandi { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.riga-stato { display: flex; gap: 8px; align-items: center; }
.riga-stato select { flex: 1; }
.bottoni { display: flex; gap: 8px; flex-wrap: wrap; }
.bottoni a { text-decoration: none; }
.titolo-sez { display: flex; justify-content: space-between; align-items: center; }
.lista { list-style: none; margin: 0; padding: 0; border: 1px solid var(--linea); border-radius: 6px; }
.lista li + li { border-top: 1px solid var(--linea); }
.voce {
  width: 100%; border: 0; background: none; text-align: left; cursor: pointer; padding: 6px 10px;
  display: flex; align-items: center; gap: 8px;
}
.voce:hover { background: var(--carta-2); }
.testo { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.html { overflow-wrap: anywhere; }
.html :deep(p) { margin: 0 0 8px; }
.html :deep(code), .html :deep(tt) { background: var(--carta-2); border-radius: 3px; padding: 0 3px; font-size: 12.5px; }
.html :deep(pre) { background: var(--carta-2); padding: 8px; border-radius: 6px; overflow-x: auto; }
.html :deep(img) { max-width: 100%; }
.commento { border-top: 1px solid var(--linea); padding: 8px 0; }
.commento p { margin: 0 0 4px; font-size: 13px; }
.nuovo-commento { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; margin-top: 8px; }
.nuovo-commento textarea { width: 100%; }
@media (max-width: 560px) { .comandi { grid-template-columns: 1fr; } }
</style>
