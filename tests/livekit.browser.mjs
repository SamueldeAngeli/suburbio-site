// Real WebRTC via local LiveKit; deterministic canvas/audio capture replaces the OS picker only.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { encode } from 'next-auth/jwt';
const require = createRequire(import.meta.url),
  origin = 'http://localhost:3114',
  secret = 'isolated-livekit-browser-only-'.repeat(3);
const server = spawn(
  process.execPath,
  [require.resolve('next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '3114'],
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
      // Salas exigem Redis: instância isolada de teste (padrão 127.0.0.1:16379) e prefixo próprio.
      LIVEKIT_ENABLED: 'true',
      REDIS_URL: process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:16379',
      REDIS_KEY_PREFIX: 'suburbio:livekit-test:',
    },
  },
);
server.stdout.on('data', () => {});
server.stderr.on('data', () => {});
const browsers = [];
let checks = 0;
const pass = (name) => {
  checks++;
  console.log('PASS ' + name);
};
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin + '/login')).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(ready);
  const pages = [];
  for (let i = 0; i < 2; i++) {
    const browser = await chromium.launch({
      channel: 'msedge',
      headless: true,
      args: [
        '--autoplay-policy=no-user-gesture-required',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
      ],
    });
    browsers.push(browser);
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const discordId = i ? '223456789012345678' : '123456789012345678';
    const token = await encode({
      token: { discordId, authenticatedAt: Date.now(), name: i ? 'Viewer Test' : 'Host Test' },
      secret,
      salt: 'authjs.session-token',
      maxAge: 3600,
    });
    await context.addCookies([
      { name: 'authjs.session-token', value: token, url: origin, httpOnly: true, sameSite: 'Lax' },
    ]);
    await context.addInitScript(() => {
      navigator.mediaDevices.getDisplayMedia = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        let n = 0;
        const draw = () => {
          const c = canvas.getContext('2d');
          c.fillStyle = n++ % 2 ? '#ef4444' : '#2563eb';
          c.fillRect(0, 0, 640, 360);
        };
        const timer = setInterval(draw, 50);
        draw();
        const stream = canvas.captureStream(20);
        const audio = new AudioContext(),
          tone = audio.createOscillator(),
          destination = audio.createMediaStreamDestination();
        tone.connect(destination);
        tone.start();
        stream.addTrack(destination.stream.getAudioTracks()[0]);
        stream.getVideoTracks()[0].addEventListener('ended', () => {
          clearInterval(timer);
          void audio.close();
        });
        return stream;
      };
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    pages.push(page);
    await page.goto(origin + '/tela');
  }
  const [host, viewer] = pages;
  await host.getByRole('button', { name: 'Criar sala', exact: true }).click();
  await host.getByRole('status').filter({ hasText: 'Conectado' }).waitFor();
  pass('host cria sala e conecta LiveKit local');
  const code = await host.locator('.screen-sidebar strong').innerText();
  assert.match(code, /^[A-F0-9]{10}$/);
  await viewer.getByLabel('Código da sala').fill(code);
  await viewer.getByRole('button', { name: 'Entrar na sala', exact: true }).click();
  await viewer.getByRole('status').filter({ hasText: 'Conectado' }).waitFor();
  await host.getByRole('heading', { name: 'Participantes (2)' }).waitFor();
  pass('segundo navegador com outra sessão entra');
  assert.equal(await viewer.getByRole('button', { name: 'Compartilhar tela', exact: true }).isEnabled(), false);
  await viewer.getByText('O anfitrião precisa permitir sua transmissão de tela.', { exact: false }).waitFor();
  pass('participante não transmite sem permissão do anfitrião');
  const promote = await viewer.evaluate(
    async ({ code, id }) => {
      const response = await fetch('/api/screen/room', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-suburbio-intent': 'screen.room' },
        body: JSON.stringify({ action: 'share', code, target: id, enabled: true }),
      });
      return { status: response.status, code: (await response.json()).error?.code };
    },
    { code, id: '223456789012345678' },
  );
  assert.deepEqual(promote, { status: 403, code: 'ROOM_HOST_REQUIRED' });
  pass('participante não se autopromove pelo BFF');
  for (const button of await host.locator('.screen-layout button').all()) {
    const color = await button.evaluate((el) => getComputedStyle(el).backgroundColor);
    assert.notEqual(color, 'rgb(239, 239, 239)');
    assert.notEqual(color, 'rgb(255, 255, 255)');
  }
  pass('controles sem faixas brancas');
  await host.getByRole('button', { name: 'Compartilhar tela', exact: true }).click();
  await viewer.locator('video').waitFor();
  await viewer.waitForFunction(() =>
    [...document.querySelectorAll('video')].some((v) => v.videoWidth > 0 && v.currentTime > 0.2),
  );
  pass('vídeo real publicado e decodificado no viewer');
  await viewer.locator('audio').waitFor({ state: 'attached' });
  await viewer.waitForFunction(() => [...document.querySelectorAll('audio')].some((a) => a.currentTime > 0.2));
  await host.getByText('Áudio da tela: capturado.', { exact: false }).waitFor();
  pass('screen audio separado recebido');
  await host.getByRole('button', { name: 'Ligar microfone' }).click();
  await host.getByRole('button', { name: 'Desligar microfone' }).waitFor();
  await viewer.waitForFunction(() => document.querySelectorAll('audio').length === 2);
  pass('microfone separado do áudio da tela');
  await host.getByRole('button', { name: 'Desligar microfone' }).click();
  pass('microfone desligado');
  await host.getByRole('button', { name: 'Trocar compartilhamento' }).click();
  await viewer.waitForFunction(() =>
    [...document.querySelectorAll('video')].some((v) => v.videoWidth > 0 && v.currentTime > 0.2),
  );
  pass('troca de captura sem sair');
  await host.getByRole('button', { name: 'Bloquear entradas' }).click();
  await host.getByRole('button', { name: 'Abrir entradas' }).waitFor();
  pass('host bloqueia entrada');
  // Reload: a aba volta sozinha para a sala (mesma identity, sem participante duplicado),
  // inclusive com entradas bloqueadas, porque já tinha sido admitida.
  await viewer.reload();
  await viewer.getByRole('status').filter({ hasText: 'Conectado' }).waitFor();
  await host.getByRole('heading', { name: 'Participantes (2)' }).waitFor();
  pass('reload reconecta mesma identidade sem duplicar');
  await host.getByRole('button', { name: 'Parar compartilhamento', exact: true }).click();
  await viewer.waitForFunction(() => document.querySelectorAll('video').length === 0);
  pass('stop remove track remoto');
  await host.getByRole('button', { name: 'Permitir transmissão' }).click();
  await viewer.waitForFunction(() =>
    [...document.querySelectorAll('button')].some((b) => b.textContent === 'Compartilhar tela' && !b.disabled),
  );
  pass('host concede publicação');
  await viewer.getByRole('button', { name: 'Compartilhar tela', exact: true }).click();
  await host.waitForFunction(() =>
    [...document.querySelectorAll('video')].some((v) => v.videoWidth > 0 && v.currentTime > 0.2),
  );
  pass('participante transmite vídeo ao anfitrião');
  await host.screenshot({ path: '.local/livekit/room-host.png', fullPage: true });
  await host.getByRole('button', { name: 'Bloquear transmissão' }).click();
  await host.waitForFunction(() => document.querySelectorAll('video').length === 0);
  await viewer.getByText('Nenhuma tela sua sendo transmitida').waitFor();
  await viewer.waitForFunction(() =>
    [...document.querySelectorAll('button')].some((b) => b.textContent === 'Compartilhar tela' && b.disabled),
  );
  pass('revogação interrompe a transmissão do participante');
  await host.getByRole('button', { name: 'Silenciar participante' }).click();
  await viewer.waitForFunction(() =>
    [...document.querySelectorAll('button')].some((b) => b.textContent === 'Ligar microfone' && b.disabled),
  );
  await host.getByRole('button', { name: 'Liberar áudio' }).click();
  await viewer.waitForFunction(() =>
    [...document.querySelectorAll('button')].some((b) => b.textContent === 'Ligar microfone' && !b.disabled),
  );
  pass('silenciar bloqueia e libera o microfone');
  await host.getByRole('button', { name: 'Tornar anfitrião' }).click();
  await viewer.getByRole('button', { name: 'Encerrar sala' }).waitFor();
  pass('transferência de host');
  await host.getByRole('button', { name: 'Sair da sala' }).click();
  await viewer.getByRole('heading', { name: 'Participantes (1)' }).waitFor();
  pass('leave remove participante');
  await viewer.getByRole('button', { name: 'Encerrar sala' }).click();
  await viewer.getByRole('button', { name: 'Criar sala' }).waitFor();
  await viewer.getByText('O anfitrião encerrou esta transmissão.').waitFor();
  pass('host encerra sala');
  console.log('LIVEKIT_BROWSER_TESTS=' + checks + ' BROWSERS=2 IDENTITIES=2 CAPTURE=synthetic MEDIA=real-WebRTC');
} finally {
  for (const browser of browsers) await browser.close();
  if (server.exitCode === null) {
    const ended = once(server, 'exit');
    server.kill();
    await ended;
  }
}
