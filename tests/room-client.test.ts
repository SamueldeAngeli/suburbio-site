import { it, expect, vi } from 'vitest';
import { requestRoom, RoomRequestError } from '@/lib/screen/room-client';

it('sends intent header and JSON body to the BFF only', async () => {
  const transport = vi.fn<typeof fetch>(async () => Response.json({ code: 'A1B2C3D4E5', host: '1', locked: false }));
  await requestRoom('lock', { code: 'A1B2C3D4E5', enabled: true }, transport);
  const [url, init] = transport.mock.calls[0];
  expect(url).toBe('/api/screen/room');
  expect(new Headers(init?.headers).get('x-suburbio-intent')).toBe('screen.room');
  expect(JSON.parse(String(init?.body))).toEqual({ action: 'lock', code: 'A1B2C3D4E5', enabled: true });
});

it('surfaces the sanitized BFF message and code, and tolerates non-JSON errors', async () => {
  const full = await requestRoom('join', {}, async () =>
    Response.json({ error: { code: 'ROOM_FULL', message: 'Esta sala está cheia.' } }, { status: 409 }),
  ).catch((e: unknown) => e);
  expect(full).toBeInstanceOf(RoomRequestError);
  expect(full).toMatchObject({ code: 'ROOM_FULL', status: 409, message: 'Esta sala está cheia.' });
  await expect(requestRoom('join', {}, async () => new Response('bad gateway', { status: 502 }))).rejects.toMatchObject(
    { code: 'UNKNOWN', message: 'Não foi possível realizar a ação.' },
  );
});

it('falha de rede vira erro tipado, sem exceção crua', async () => {
  await expect(
    requestRoom('join', {}, async () => {
      throw new TypeError('Failed to fetch');
    }),
  ).rejects.toMatchObject({ code: 'NETWORK', status: 0 });
});
