import { it, expect, vi } from 'vitest';
import { SuburbioApiClient } from '@/lib/api/client';
import { config, discordId, playerId } from './fixtures';
import { signRequest } from '@/lib/api/hmac';
it('histórico assina a identidade no caminho e não aceita página inválida', async () => {
  const transport = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify({ items: [], page: 1, pageSize: 25, total: 0 })));
  const api = new SuburbioApiClient(config, transport);
  await api.orders(discordId);
  const [url, init] = transport.mock.calls[0],
    u = new URL(String(url)),
    headers = new Headers(init?.headers);
  expect(u.searchParams.get('customerDiscordId')).toBe(discordId);
  expect(headers.get('x-signature')).toBe(
    signRequest(
      config.SITE_SERVICE_SECRET!,
      'GET',
      u.pathname + u.search,
      headers.get('x-timestamp')!,
      headers.get('x-nonce')!,
      '',
    ),
  );
  expect(() => api.orders(discordId, 0)).toThrow();
  expect(transport).toHaveBeenCalledTimes(1);
});
it('detalhe não permite injetar caminho ou identidade', () => {
  const transport = vi.fn<typeof fetch>(),
    api = new SuburbioApiClient(config, transport);
  expect(() => api.order(discordId, '../admins')).toThrow();
  expect(() => api.order('owner', playerId)).toThrow();
  expect(transport).not.toHaveBeenCalled();
});
