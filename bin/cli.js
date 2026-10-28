#!/usr/bin/env node
// npx @meloniwastaken/pops-jira-viewer [--port 3000] [--no-open]
import { avvia } from '../server/index.js';

const arg = process.argv.slice(2);
const i = arg.indexOf('--port');
const porta = Number(i >= 0 ? arg[i + 1] : process.env.PORT) || 3000;

try {
  await avvia(porta);
} catch (e) {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n  La porta ${porta} è occupata: forse il viewer è già aperto. Prova con --port ${porta + 1}\n`);
    process.exit(1);
  }
  throw e;
}

const indirizzo = `http://localhost:${porta}`;
console.log(`\n  POPS Jira Viewer su ${indirizzo}`);
console.log('  Ctrl+C per chiudere\n');
if (!arg.includes('--no-open')) {
  const open = (await import('open')).default;
  open(indirizzo).catch(() => {});
}
