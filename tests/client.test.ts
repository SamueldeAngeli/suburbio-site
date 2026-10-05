import { describe, it, expect, vi } from 'vitest';
import { SuburbioApiClient } from '@/lib/api/client';
import { signRequest } from '@/lib/api/hmac';
import { safeError } from '@/lib/api/errors';
import { config, health, playerId, discordId, operationId } from './fixtures';
describe('Cliente HTTP oficial', () => {
  it('health envia HMAC válido, no-store e proíbe redirects', async () => {
    const transport = vi.fn<typeof fetch>(async (url, init) => {
      expect(String(url)).toBe('http://127.0.0.1:3000/internal/health');
      const h = new Headers(init?.headers);
      expect(h.get('X-Signature')).toBe(
        signRequest(
          config.SITE_SERVICE_SECRET!,
          'GET',
          '/internal/health',
          h.get('X-Timestamp')!,
          h.get('X-Nonce')!,
          '',
        ),
      );
      expect(init?.cache).toBe('no-store');
      expect(init?.redirect).toBe('error');
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return Response.json(health, { headers: { 'X-Request-Id': operationId } });
    });
    const response = await new SuburbioApiClient(config, transport).health();
    expect(response.data.mysql).toBe('disabled');
    expect(response.data['discord-bot']).toBe('unmonitored');
    expect(response.trace.requestId).toBe(operationId);
  });
  it('health público não envia credencial interna', async () => {
    const fetcher = vi.fn<typeof fetch>(async (_, init) => {
      expect(new Headers(init?.headers).has('X-Signature')).toBe(false);
      return Response.json(health);
    });
    await new SuburbioApiClient(config, fetcher).publicHealth();
  });
  it('preserva health degradado 503', async () => {
    const api = new SuburbioApiClient(config, async () =>
      Response.json({ ...health, status: 'degraded', postgres: 'down' }, { status: 503 }),
    );
    expect((await api.health()).data.postgres).toBe('down');
  });
  it('rejeita shape desconhecido em resposta de sucesso', async () => {
    const api = new SuburbioApiClient(config, async () => Response.json({ online: true }));
    await expect(api.health()).rejects.toMatchObject({ code: 'API_INVALID_RESPONSE' });
  });
  it('API offline retorna mensagem sanitizada', async () => {
    const api = new SuburbioApiClient(config, async () => {
      throw new Error('postgres://user:secret@host');
    });
    try {
      await api.health();
    } catch (e) {
      expect(JSON.stringify(safeError(e))).not.toContain('secret@');
      expect(safeError(e).body.error.code).toBe('API_OFFLINE');
    }
  });
  it('API_READ_ONLY é preservado sem retry de escrita', async () => {
    const transport = vi.fn<typeof fetch>(async () =>
      Response.json({ success: false, error: { code: 'API_READ_ONLY', message: 'internal secret' } }, { status: 503 }),
    );
    await expect(
      new SuburbioApiClient(config, transport).revoke(playerId, 'Motivo', discordId, 'test-key-123'),
    ).rejects.toMatchObject({ code: 'API_READ_ONLY' });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('revoke assina exatamente o corpo transmitido, ator e idempotência', async () => {
    const transport = vi.fn<typeof fetch>(async (_, init) => {
      const h = new Headers(init?.headers);
      const body = String(init?.body);
      expect(JSON.parse(body).actorDiscordId).toBe(discordId);
      expect(h.get('Idempotency-Key')).toBe('test-key-123');
      expect(h.get('X-Signature')).toBe(
        signRequest(
          config.SITE_SERVICE_SECRET!,
          'POST',
          '/internal/allowlist/revoke',
          h.get('X-Timestamp')!,
          h.get('X-Nonce')!,
          body,
        ),
      );
      return Response.json({ playerId, allowlistId: playerId, status: 'revoked', operationId });
    });
    expect(
      (await new SuburbioApiClient(config, transport).revoke(playerId, 'Motivo', discordId, 'test-key-123')).trace
        .operationId,
    ).toBe(operationId);
  });
  it('nonce muda entre tentativas com mesma chave de idempotência', async () => {
    const nonces: string[] = [];
    const transport = vi.fn<typeof fetch>(async (_, init) => {
      nonces.push(new Headers(init?.headers).get('X-Nonce')!);
      return Response.json({ playerId, allowlistId: playerId, status: 'revoked', operationId });
    });
    const api = new SuburbioApiClient(config, transport);
    await api.revoke(playerId, 'Motivo', discordId, 'test-key-123');
    await api.revoke(playerId, 'Motivo', discordId, 'test-key-123');
    expect(nonces[0]).not.toBe(nonces[1]);
  });
  it('não aceita URL arbitrária no lugar do playerId', () => {
    const transport = vi.fn();
    expect(() => new SuburbioApiClient(config, transport).allowlist('http://169.254.169.254/')).toThrow();
    expect(transport).not.toHaveBeenCalled();
  });
  it('configuração desabilitada nunca faz chamada de rede', async () => {
    const transport = vi.fn();
    await expect(
      new SuburbioApiClient({ ...config, SUBURBIO_API_ENABLED: false }, transport).health(),
    ).rejects.toMatchObject({ code: 'API_NOT_CONFIGURED' });
    expect(transport).not.toHaveBeenCalled();
  });
  it('erro upstream não vaza stack/SQL/mensagem', async () => {
    const api = new SuburbioApiClient(config, async () =>
      Response.json({ error: { code: 'UNKNOWN', message: 'SELECT password; secret' } }, { status: 500 }),
    );
    try {
      await api.health();
    } catch (e) {
      expect(JSON.stringify(safeError(e))).not.toMatch(/SELECT|password|secret/);
    }
  });
  it('HTTP 429 vira limite com mensagem segura mesmo sem JSON', async () => {
    await expect(
      new SuburbioApiClient(config, async () => new Response('busy', { status: 429 })).health(),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });
});
