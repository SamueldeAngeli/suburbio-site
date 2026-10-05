import fs from 'node:fs';
import path from 'node:path';
const root = '.next/static';
// Load the same env files next build reads so secret values (not only names) are checked.
for (const file of ['.env.production.local', '.env.local', '.env.production', '.env'])
  if (fs.existsSync(file)) process.loadEnvFile(file);
if (!fs.existsSync(root)) throw new Error('Execute npm run build antes da verificação.');
const forbidden = [
  'SITE_SERVICE_SECRET',
  'DISCORD_CLIENT_SECRET',
  'AUTH_SECRET',
  'AUTH_SECRET_PREVIOUS',
  'BOOTSTRAP_OWNER_DISCORD_ID',
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
  'LIVEKIT_INTERNAL_URL',
  'REDIS_URL',
];
let checked = 0;
function walk(directory) {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) walk(file);
    else if (/\.(?:js|json|map)$/.test(file)) {
      checked++;
      const text = fs.readFileSync(file, 'utf8');
      for (const key of forbidden) if (text.includes(key)) throw new Error(`Fronteira client/server violada: ${key}`);
      for (const key of forbidden)
        if (process.env[key]?.length >= 12 && text.includes(process.env[key]))
          throw new Error('Valor secreto encontrado no bundle cliente.');
    }
  }
}
walk(root);
console.log(`Fronteira client/server verificada: ${checked} arquivos públicos, nenhum segredo identificado.`);
