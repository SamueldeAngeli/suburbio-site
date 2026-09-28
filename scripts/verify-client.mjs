import fs from 'node:fs';
import path from 'node:path';
const root = '.next/static';
if (!fs.existsSync(root)) throw new Error('Execute npm run build antes da verificação.');
const forbidden = ['SITE_SERVICE_SECRET', 'DISCORD_CLIENT_SECRET', 'AUTH_SECRET_PREVIOUS', 'BOOTSTRAP_OWNER_DISCORD_ID'];
let checked = 0;
function walk(directory) {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) walk(file);
    else if (/\.(?:js|json|map)$/.test(file)) {
      checked++;
      const text = fs.readFileSync(file, 'utf8');
      for (const key of forbidden) if (text.includes(key)) throw new Error(`Fronteira client/server violada: ${key}`);
      for (const key of forbidden) if (process.env[key]?.length >= 16 && text.includes(process.env[key])) throw new Error('Valor secreto encontrado no bundle cliente.');
    }
  }
}
walk(root);
console.log(`Fronteira client/server verificada: ${checked} arquivos públicos, nenhum segredo identificado.`);
