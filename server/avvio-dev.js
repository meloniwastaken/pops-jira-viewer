// Solo per lo sviluppo: il server sulla 3000, il frontend da Vite sulla 5173 con il proxy di /api.
import { avvia } from './index.js';

const porta = Number(process.env.PORT) || 3000;
await avvia(porta);
console.log(`API su http://127.0.0.1:${porta}`);
