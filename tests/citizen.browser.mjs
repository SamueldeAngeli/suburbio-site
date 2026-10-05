// Browser verification uses an isolated Next process and a signed fixture session only.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { encode } from 'next-auth/jwt';
const require = createRequire(import.meta.url),
  origin = 'http://localhost:3108',
  secret = 'isolated-citizen-ui-test-only-'.repeat(3);
const output = 'docs/screenshots/crypto-screen';
await mkdir(output, { recursive: true });
const server = spawn(
  process.execPath,
  [require.resolve('next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '3108'],
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
      SUBURBIO_API_ENABLED: 'false',
      DISCORD_ROLE_AUTH_ENABLED: 'false',
    },
  },
);
let browser;
let checks = 0;
const verified = (label) => {
  checks++;
  console.log('PASS ' + label);
};
try {
  const deadline = Date.now() + 20000;
  let ready = false;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw Error('Isolated server exited');
    try {
      if ((await fetch(origin + '/login')).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(ready);
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await context.route('**/api/me/crypto', (route) =>
    route.fulfill({ json: { balance: '1250', currency: 'CRYPTO', asOf: '2026-10-04T00:00:00Z' } }),
  );
  await page.goto(origin);
  await page.getByRole('button', { name: 'Entrar com Discord', exact: true }).waitFor();
  verified('navbar deslogada');
  for (const width of [390, 360]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'anonymous mobile overflow',
    );
    await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
    await page.getByRole('button', { name: 'Carrinho', exact: true }).click();
    await page.getByRole('dialog', { name: 'Seu carrinho' }).waitFor();
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    await page.screenshot({ path: output + '/anonymous-' + width + '.png', fullPage: false });
    verified('mobile deslogado ' + width + ' com carrinho acessível');
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.getByRole('button', { name: 'Abrir carrinho, 0 itens' }).click();
  await page.getByRole('dialog', { name: 'Seu carrinho' }).waitFor();
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  verified('carrinho preservado na navbar extraída');
  const token = await encode({
    token: { discordId: '123456789012345678', authenticatedAt: Date.now(), name: 'TecCode', username: 'teccode' },
    secret,
    salt: 'authjs.session-token',
    maxAge: 3600,
  });
  await context.addCookies([
    { name: 'authjs.session-token', value: token, url: origin, httpOnly: true, sameSite: 'Lax' },
  ]);
  await page.goto(origin + '/minha-conta');
  await page.getByRole('button', { name: 'Conta de TecCode' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Entrar com Discord', exact: true }).count(), 0);
  verified('sessão real de teste troca login por nome/avatar');
  await page.locator('.crypto-desktop').getByRole('link', { name: 'Saldo: 1.250 Crypto' }).waitFor();
  const cart = await page.locator('.header-actions .cart-trigger').boundingBox(),
    crypto = await page.locator('.crypto-desktop').boundingBox(),
    profile = await page.locator('.user-nav').boundingBox();
  assert.ok(cart && crypto && profile && cart.x + cart.width <= crypto.x && crypto.x + crypto.width <= profile.x);
  verified('desktop: carrinho, Crypto, perfil nesta ordem');
  assert.equal(await page.getByRole('link', { name: 'Transmissão', exact: true }).count(), 1);
  verified('Transmissão na navegação principal');
  for (const [label, width, height] of [
    ['desktop-1920', 1920, 1080],
    ['notebook-1366', 1366, 768],
    ['tablet-820', 820, 1180],
    ['mobile-390', 390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: `${output}/${label}.png`, fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ' overflow');
    await page.getByRole('button', { name: 'Conta de TecCode' }).click();
    await page.getByRole('menu').waitFor();
    assert.equal(await page.getByRole('menu').getByText('Crypto').count(), 0);
    const box = await page.getByRole('menu').boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= width);
    await page.screenshot({ path: `${output}/${label}-menu.png`, fullPage: true });
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('menu').count(), 0);
    verified(label + ' perfil/dropdown sem overflow');
  }
  await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await page.locator('.crypto-mobile').getByRole('link', { name: 'Saldo: 1.250 Crypto' }).waitFor();
  await page.screenshot({ path: output + '/mobile-crypto-menu.png', fullPage: true });
  await page.getByRole('button', { name: 'Fechar menu', exact: true }).click();
  verified('Crypto no menu mobile fora do dropdown');
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.getByRole('button', { name: 'Conta de TecCode' }).click();
  await page.getByRole('heading', { name: 'Seu próximo capítulo.' }).click();
  assert.equal(await page.getByRole('menu').count(), 0);
  verified('click fora fecha');
  const trigger = page.getByRole('button', { name: 'Conta de TecCode' });
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  await page.getByRole('menu').waitFor();
  assert.equal(
    await page.getByRole('menuitem', { name: 'Ver perfil' }).evaluate((el) => el === document.activeElement),
    true,
  );
  await page.keyboard.press('End');
  assert.equal(
    await page.getByRole('menuitem', { name: 'Sair' }).evaluate((el) => el === document.activeElement),
    true,
  );
  await page.keyboard.press('Escape');
  verified('teclado/foco');
  for (const [path, label] of [
    ['/minha-conta/pedidos', 'Meus pedidos'],
    ['/minha-conta/beneficios', 'Meus benefícios'],
    ['/minha-conta/presentes', 'Meus presentes'],
    ['/minha-conta/personagens', 'Meus personagens'],
  ]) {
    await page.goto(origin + path);
    await page.getByRole('heading', { name: label, exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    verified('aba ' + path);
  }
  await page.goto(origin + '/tela');
  await page.getByRole('heading', { name: 'Compartilhamento de tela', exact: true }).waitFor();
  await page.screenshot({ path: output + '/tela-notebook.png', fullPage: true });
  const policy = (await page.request.get(origin + '/tela')).headers()['permissions-policy'];
  assert.ok(policy.includes('microphone=(self)'));
  verified('/tela preserva prévia e permite solicitar microfone');
  await page.goto(origin + '/minha-conta');
  await page.getByRole('button', { name: 'Conta de TecCode' }).click();
  await page.getByRole('menuitem', { name: 'Sair' }).click();
  await page.getByRole('button', { name: 'Entrar com Discord', exact: true }).waitFor();
  assert.equal(
    (await context.cookies()).some((c) => c.name === 'authjs.session-token'),
    false,
  );
  verified('logout server-side elimina cookie e retorna login');
  console.log(`UI_BROWSER_TESTS=${checks}`);
} finally {
  await browser?.close();
  if (server.exitCode === null) {
    const exit = once(server, 'exit');
    server.kill();
    await exit;
  }
}
