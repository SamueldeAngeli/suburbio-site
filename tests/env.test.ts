import { describe, it, expect } from 'vitest';
import { parseServerEnv } from '@/lib/server/env';

const liveKit = {
  LIVEKIT_ENABLED: 'true',
  LIVEKIT_INTERNAL_URL: 'http://127.0.0.1:7880',
  LIVEKIT_PUBLIC_URL: 'wss://tela.suburbio.example',
  LIVEKIT_API_KEY: 'site-key',
  LIVEKIT_API_SECRET: 's'.repeat(32),
  REDIS_URL: 'redis://127.0.0.1:6379',
};
const production = { NODE_ENV: 'production', ...liveKit };

describe('SUBURBIO_API_TIMEOUT_MS', () => {
  it('defaults to 5000 and ignores the generic API_TIMEOUT_MS used by other tools', () => {
    expect(parseServerEnv({ API_TIMEOUT_MS: '120000' }).SUBURBIO_API_TIMEOUT_MS).toBe(5000);
  });
  it('rejects values out of range', () => {
    expect(() => parseServerEnv({ SUBURBIO_API_TIMEOUT_MS: '100' })).toThrow('SUBURBIO_API_TIMEOUT_MS');
  });
});

describe('LiveKit configuration', () => {
  it('accepts internal loopback with public WSS in production', () => {
    expect(parseServerEnv(production).LIVEKIT_PUBLIC_URL).toBe('wss://tela.suburbio.example');
  });
  it.each([
    'ws://tela.suburbio.example',
    'wss://127.0.0.1:7880',
    'wss://localhost',
    'wss://10.0.0.5',
    'https://tela.suburbio.example',
  ])('production rejects public URL %s', (url) => {
    expect(() => parseServerEnv({ ...production, LIVEKIT_PUBLIC_URL: url })).toThrow('LIVEKIT_PUBLIC_URL');
  });
  it('production rejects plaintext internal URL to a public host', () => {
    expect(() => parseServerEnv({ ...production, LIVEKIT_INTERNAL_URL: 'http://livekit.example.com' })).toThrow(
      'LIVEKIT_INTERNAL_URL',
    );
  });
  it('production requires a 32+ character secret', () => {
    expect(() => parseServerEnv({ ...production, LIVEKIT_API_SECRET: 'short-secret' })).toThrow('LIVEKIT_API_SECRET');
  });
  it('development allows loopback ws for local tests', () => {
    expect(() =>
      parseServerEnv({ ...liveKit, LIVEKIT_PUBLIC_URL: 'ws://127.0.0.1:7880', LIVEKIT_API_SECRET: 'dev-secret' }),
    ).not.toThrow();
  });
  it.each(['wss://user:pw@tela.example', 'wss://tela.example/path', 'wss://tela.example?x=1'])(
    'rejects malformed URL %s',
    (url) => {
      expect(() => parseServerEnv({ ...liveKit, LIVEKIT_PUBLIC_URL: url })).toThrow();
    },
  );
  it('error messages name the variable but never echo its value', () => {
    try {
      parseServerEnv({ ...production, LIVEKIT_API_SECRET: 'tiny-secret-value' });
    } catch (error) {
      expect(String(error)).not.toContain('tiny-secret-value');
    }
  });
  it('transmissão exige Redis: salas nunca ficam na memória do processo', () => {
    expect(() => parseServerEnv({ ...production, REDIS_URL: '' })).toThrow('REDIS_URL');
    expect(() => parseServerEnv({ ...liveKit, REDIS_URL: undefined })).toThrow('REDIS_URL');
  });
  it.each(['LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'LIVEKIT_PUBLIC_URL', 'LIVEKIT_INTERNAL_URL'])(
    'configuração ausente (%s) bloqueia a transmissão',
    (key) => {
      expect(() => parseServerEnv({ ...production, [key]: undefined })).toThrow(key);
    },
  );
  it('capacidade máxima por sala é configurável dentro de 2–50 (padrão 10)', () => {
    expect(parseServerEnv(production).LIVEKIT_ROOM_MAX_PARTICIPANTS).toBe(10);
    expect(parseServerEnv({ ...production, LIVEKIT_ROOM_MAX_PARTICIPANTS: '4' }).LIVEKIT_ROOM_MAX_PARTICIPANTS).toBe(4);
    expect(() => parseServerEnv({ ...production, LIVEKIT_ROOM_MAX_PARTICIPANTS: '1' })).toThrow(
      'LIVEKIT_ROOM_MAX_PARTICIPANTS',
    );
    expect(() => parseServerEnv({ ...production, LIVEKIT_ROOM_MAX_PARTICIPANTS: '500' })).toThrow();
  });
  it('desligada não exige nenhuma variável LiveKit nem Redis', () => {
    expect(parseServerEnv({ NODE_ENV: 'production', LIVEKIT_ENABLED: 'false' }).LIVEKIT_ENABLED).toBe(false);
  });
});

describe('Redis configuration', () => {
  it('is optional', () => expect(parseServerEnv({}).REDIS_URL).toBeUndefined());
  it('rejects non-redis schemes', () =>
    expect(() => parseServerEnv({ REDIS_URL: 'http://127.0.0.1:6379' })).toThrow('REDIS_URL'));
  it('uses a site-only namespace by default', () => expect(parseServerEnv({}).REDIS_KEY_PREFIX).toBe('suburbio:site:'));
});
