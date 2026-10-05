import { it, expect, vi } from 'vitest';
import { requestRoom } from '@/lib/screen/room-client';

it('sends intent header and JSON body to the BFF only', async () => {
  const transport = vi.fn<typeof fetch>(async () => Response.json({ code: 'A1B2C3D4E5', host: '1', locked: false }));
  await requestRoom('lock', { code: 'A1B2C3D4E5', enabled: true }, transport);
  const [url, init] = transport.mock.calls[0];
  expect(url).toBe('/api/screen/room');
  expect(new Headers(init?.headers).get('x-suburbio-intent')).toBe('screen.room');
  expect(JSON.parse(String(init?.body))).toEqual({ action: 'lock', code: 'A1B2C3D4E5', enabled: true });
});

it('surfaces the sanitized BFF message and tolerates non-JSON errors', async () => {
  await expect(
    requestRoom('join', {}, async () => Response.json({ error: { message: 'Sala fechada.' } }, { status: 403 })),
  ).rejects.toThrow('Sala fechada.');
  await expect(requestRoom('join', {}, async () => new Response('bad gateway', { status: 502 }))).rejects.toThrow(
    'Não foi possível realizar a ação.',
  );
});
