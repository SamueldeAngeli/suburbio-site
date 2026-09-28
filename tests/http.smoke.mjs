// HTTP integration tests against a dedicated production Next.js process, never the real API.
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { encode } from 'next-auth/jwt';
const require = createRequire(import.meta.url);
const port = process.env.SITE_TEST_PORT ?? '3107';
if (!/^\d{4,5}$/.test(port)) throw new Error('SITE_TEST_PORT inválida');
const origin = `http://127.0.0.1:${port}`;
const secret = 'isolated-http-test-key-not-for-production-'.repeat(2);
let processHandle;
let cookie;
before(async () => {
  processHandle = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', port], {
    windowsHide: true, stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'development', AUTH_ENABLED: 'true', AUTH_URL: origin, AUTH_SECRET: secret, AUTH_SECRET_PREVIOUS: '', DISCORD_CLIENT_ID: '123456789012345678', DISCORD_CLIENT_SECRET: 'isolated-discord-test-secret-not-real', DISCORD_REDIRECT_URI: `${origin}/api/auth/callback/discord`, SUBURBIO_API_ENABLED: 'false' },
  });
  let ready = false;
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw new Error('Servidor HTTP isolado encerrou antes de ficar pronto.');
    try { const response = await fetch(`${origin}/login`, { signal: AbortSignal.timeout(1000) }); if (response.ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready, 'Servidor isolado não ficou pronto');
  cookie = `authjs.session-token=${await encode({ token: { discordId: '123456789012345678', authenticatedAt: Date.now(), name: 'Sessão de teste' }, secret, salt: 'authjs.session-token', maxAge: 3600 })}`;
});
after(async () => { if (processHandle && processHandle.exitCode === null) { const exited = once(processHandle, 'exit'); processHandle.kill(); await exited; } });
const get = (path, headers = {}) => fetch(origin + path, { redirect: 'manual', headers, signal: AbortSignal.timeout(5000) });
test('homepage pública original permanece disponível', async () => { const response = await get('/'); assert.equal(response.status, 200); const body = await response.text(); assert.match(body,/A RUA É NOSSA/); assert.match(body,/CARREGANDO CATÁLOGO/); });
test('login contém formulário Discord e metadados noindex', async () => {const r=await get('/login');assert.equal(r.status,200);const body=await r.text();assert.match(body,/Entrar com Discord/);assert.match(body,/noindex/);});
for (const path of ['/admin','/admin/services','/admin/players','/admin/admins','/admin/permissions','/admin/allowlist','/admin/punishments','/admin/orders','/admin/payments','/admin/refunds','/admin/chargebacks','/admin/audit','/admin/discord','/admin/settings','/admin/products','/admin/products/new','/admin/admins/c7f96a10-8207-4235-a43e-5e73cbd066a1','/admin/players/c7f96a10-8207-4235-a43e-5e73cbd066a1','/admin/orders/c7f96a10-8207-4235-a43e-5e73cbd066a1','/admin/coupons','/admin/coupons/new','/minha-conta/beneficios','/minha-conta/pedidos','/minha-conta/pedidos/c7f96a10-8207-4235-a43e-5e73cbd066a1','/minha-conta']) {
  test(`${path} sem sessão redireciona ao login`, async () => {const r=await get(path);assert.equal(r.status,307);assert.match(r.headers.get('location')??'',/^\/login\?/);});
}
test('sessão JWT real criptografada abre somente a área do cidadão',async()=>{const r=await get('/minha-conta',{Cookie:cookie});assert.equal(r.status,200);assert.match(await r.text(),/Sessão de teste/);});
test('sessão válida não contorna API sem configuração',async()=>{const r=await get('/admin',{Cookie:cookie});const body=await r.text();assert.match(body,/Aguardando autorização da API/);assert.doesNotMatch(body,/href="\/admin\/payments"/);});
test('cookie adulterado é rejeitado no servidor',async()=>{const r=await get('/minha-conta',{Cookie:cookie.slice(0,-8)+'tampered'});assert.equal(r.status,307);});
test('BFF health sem sessão retorna HTTP 401',async()=>{const r=await get('/api/admin/services');assert.equal(r.status,401);assert.match(r.headers.get('cache-control')??'',/no-store/);});
test('BFF health com sessão e sem API configurada retorna HTTP 503 API_NOT_CONFIGURED',async()=>{const r=await get('/api/admin/services',{Cookie:cookie});assert.equal(r.status,503);assert.equal((await r.json()).error.code,'API_NOT_CONFIGURED');});
test('BFF allowlist não expõe dado a visitante',async()=>{const r=await get('/api/admin/allowlist/c7f96a10-8207-4235-a43e-5e73cbd066a1');assert.equal(r.status,401);});
test('BFF revoke bloqueia origem externa antes da mutação',async()=>{const r=await fetch(origin+'/api/admin/allowlist/revoke',{method:'POST',headers:{Cookie:cookie,Origin:'https://evil.example','Content-Type':'application/json','X-Suburbio-Intent':'allowlist.revoke'},body:'{}'});assert.equal(r.status,403);});
test('sessão HTTP não expõe secret nem token OAuth',async()=>{const r=await get('/api/auth/session',{Cookie:cookie});const body=await r.text();assert.match(body,/123456789012345678/);assert.doesNotMatch(body,/access_token|refresh_token|isolated-http-test-key|capabilities/);});
test('callback sem state não autentica',async()=>{const r=await get('/api/auth/callback/discord?code=invalid');assert.ok([302,303,307].includes(r.status));assert.match(r.headers.get('location')??'',/error=/);assert.doesNotMatch(r.headers.get('set-cookie')??'',/authjs\.session-token=[^;]/);});
