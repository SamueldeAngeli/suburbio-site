// Isolated local fixture server only. Never connects to real accounts or payment providers.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { encode } from 'next-auth/jwt';
const require = createRequire(import.meta.url),
  fixture = JSON.parse(await readFile(new URL('./fixtures/affiliate.json', import.meta.url), 'utf8')),
  origin = 'http://localhost:3110',
  secret = 'isolated-affiliate-fixture-only-'.repeat(3),
  out = 'docs/screenshots/affiliates';
await mkdir(out, { recursive: true });
let state = { affiliate: false, admin: false },
  empty = false;
const periods = [];
const mock = createServer(async (req, res) => {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const url = new URL(req.url, 'http://localhost'),
    path = url.pathname;
  res.setHeader('Content-Type', 'application/json');
  let body;
  if (path === '/internal/site/me/affiliate/access') body = { affiliate: state.affiliate };
  else if (path === '/internal/site/admin/resolve' && state.admin)
    body = {
      adminAccountId: '33333333-3333-4333-8333-333333333333',
      discordId: JSON.parse(raw).discordId,
      status: 'active',
      isSystemOwner: false,
      capabilities: ['DASHBOARD_READ'],
      readOnly: false,
    };
  else if (path === '/internal/site/me/crypto') body = { balance: '1250', currency: 'CRYPTO', asOf: fixture.asOf };
  else if (path === '/internal/site/me/affiliate' && state.affiliate) {
    const period = url.searchParams.get('period');
    periods.push(period);
    body = structuredClone(fixture);
    body.period = period;
    if (empty) {
      body.chart = [];
      body.sales = [];
      body.total = 0;
      for (const k of Object.keys(body.summary)) body.summary[k] = typeof body.summary[k] === 'number' ? 0 : '0';
    }
  } else {
    res.statusCode = path.includes('admin/resolve') ? 403 : 404;
    body = { error: { code: path.includes('admin/resolve') ? 'ADMIN_ACCESS_DENIED' : 'AFFILIATE_NOT_FOUND' } };
  }
  res.end(JSON.stringify(body));
});
await new Promise((r) => mock.listen(3112, '127.0.0.1', r));
const server = spawn(
  process.execPath,
  [require.resolve('next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '3110'],
  {
    windowsHide: true,
    stdio: 'pipe',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      AUTH_ENABLED: 'true',
      AUTH_URL: origin,
      AUTH_SECRET: secret,
      AUTH_SECRET_PREVIOUS: '',
      DISCORD_CLIENT_ID: '123456789012345678',
      DISCORD_CLIENT_SECRET: 'isolated-ui-test-secret-only',
      DISCORD_REDIRECT_URI: origin + '/api/auth/callback/discord',
      SUBURBIO_API_ENABLED: 'true',
      SUBURBIO_API_URL: 'http://127.0.0.1:3112',
      SITE_SERVICE_SECRET: 'isolated-hmac-fixture-only-'.repeat(3),
      DISCORD_ROLE_AUTH_ENABLED: 'false',
    },
  },
);
server.stdout.resume();
server.stderr.resume();
let browser,
  checks = 0;
const pass = (label) => {
  checks++;
  console.log('PASS ' + label);
};
async function shot(page, name) {
  await page.evaluate(() => {
    if (!document.getElementById('fixture-label')) {
      const e = document.createElement('div');
      e.id = 'fixture-label';
      e.textContent = 'AMBIENTE DE TESTE · DADOS SIMULADOS';
      e.style.cssText =
        'position:fixed;bottom:4px;left:4px;z-index:999999;background:#05121b;color:#78ddf4;padding:5px 9px;border:1px solid #356375;font:10px sans-serif;pointer-events:none';
      document.body.append(e);
    }
  });
  await page.screenshot({ path: out + '/' + name + '.png', fullPage: true });
}
try {
  const deadline = Date.now() + 30000;
  let ready = false;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(origin + '/login')).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(ready, 'isolated Next start');
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' }),
    page = await context.newPage();
  const token = await encode({
    token: { discordId: '123456789012345678', authenticatedAt: Date.now(), name: 'TecCode', username: 'teccode' },
    secret,
    salt: 'authjs.session-token',
    maxAge: 3600,
  });
  await context.addCookies([
    { name: 'authjs.session-token', value: token, url: origin, httpOnly: true, sameSite: 'Lax' },
  ]);
  for (const [name, affiliate, admin] of [
    ['comum', false, false],
    ['afiliado', true, false],
    ['admin', false, true],
    ['afiliado-admin', true, true],
  ]) {
    state = { affiliate, admin };
    for (const [label, width, height] of [
      ['desktop', 1440, 1000],
      ['mobile', 390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await Promise.all([
        page.waitForResponse((r) => r.url().endsWith('/api/me/access')),
        page.goto(origin + '/minha-conta'),
      ]);
      await page.getByRole('button', { name: 'Conta de TecCode' }).click();
      const expected = ['Ver perfil', ...(affiliate ? ['Afiliado'] : []), ...(admin ? ['Admin'] : []), 'Sair'];
      assert.deepEqual(await page.getByRole('menuitem').allTextContents(), expected);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await shot(page, 'dropdown-' + name + '-' + label);
      pass('dropdown ' + name + ' ' + label);
    }
  }
  state = { affiliate: true, admin: false };
  for (const [label, width, height] of [
    ['desktop', 1440, 1000],
    ['mobile', 390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(origin + '/minha-conta/afiliado');
    await page.getByRole('heading', { name: 'Seu impacto no Subúrbio.' }).waitFor();
    assert.ok(await page.getByText('TECCODE', { exact: true }).isVisible());
    assert.ok(await page.getByRole('table').getByText('VIP Elite').isVisible());
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await shot(page, 'painel-' + label);
    pass('painel ' + label);
  }
  for (const period of ['7', '90', 'all']) {
    await page.getByRole('link', { name: period === 'all' ? 'Todo período' : period + ' dias', exact: true }).click();
    await page.waitForURL('**period=' + period);
    await page
      .getByRole('link', { name: period === 'all' ? 'Todo período' : period + ' dias', exact: true })
      .evaluate((e) => e.getAttribute('aria-current'));
    assert.ok(periods.includes(period));
    pass('filtro ' + period);
  }
  empty = true;
  await page.goto(origin + '/minha-conta/afiliado');
  await page.getByText('Nenhuma venda registrada neste período.').waitFor();
  await shot(page, 'painel-vazio-mobile');
  pass('empty state real sem números inventados');
  state = { affiliate: false, admin: false };
  const response = await page.goto(origin + '/minha-conta/afiliado');
  assert.equal(response.status(), 404);
  pass('acesso direto comum negado');
  console.log('AFFILIATE_BROWSER_TESTS=' + checks);
} finally {
  await browser?.close();
  if (server.exitCode === null) {
    const exit = once(server, 'exit');
    server.kill();
    await exit;
  }
  await new Promise((r) => mock.close(r));
}
