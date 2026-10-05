import { it, expect, vi, beforeEach } from 'vitest';
const m = vi.hoisted(() => ({ session: vi.fn(), recipient: vi.fn(), room: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ currentSession: m.session }));
vi.mock('@/lib/api/client', () => ({
  SuburbioApiClient: class {
    giftRecipient = m.recipient;
  },
}));
vi.mock('@/lib/screen/rooms', () => ({ roomAction: m.room }));
vi.mock('@/lib/server/env', () => ({ serverEnv: () => ({ AUTH_URL: 'http://localhost:3002' }) }));
import { POST as recipient } from '@/app/api/vip/gifts/recipient/route';
import { POST as room } from '@/app/api/screen/room/route';
const request = (body: unknown, intent: string, origin = 'http://localhost:3002') =>
  new Request('http://localhost:3002/api', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json', 'x-suburbio-intent': intent },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  m.session.mockResolvedValue({ user: { discordId: '123456789012345678', name: 'Cidadão' } });
  m.recipient.mockResolvedValue({ data: {} });
  m.room.mockResolvedValue({ code: '123456ABCD' });
});
it('gift lookup takes buyer exclusively from session', async () => {
  expect((await recipient(request({ recipientDiscordId: '223456789012345678' }, 'gift.resolve'))).status).toBe(200);
  expect(m.recipient).toHaveBeenCalledWith('123456789012345678', '223456789012345678');
});
it('gift lookup rejects forged buyer', async () => {
  expect(
    (
      await recipient(
        request({ recipientDiscordId: '223456789012345678', customerDiscordId: '323456789012345678' }, 'gift.resolve'),
      )
    ).status,
  ).toBe(400);
  expect(m.recipient).not.toHaveBeenCalled();
});
it('gift lookup requires session and CSRF', async () => {
  m.session.mockResolvedValue(null);
  expect((await recipient(request({ recipientDiscordId: '223456789012345678' }, 'gift.resolve'))).status).toBe(401);
  expect((await recipient(request({}, 'gift.resolve', 'http://evil.test'))).status).toBe(403);
});
it('room token endpoint requires session', async () => {
  m.session.mockResolvedValue(null);
  expect((await room(request({ action: 'create' }, 'screen.room'))).status).toBe(401);
  expect(m.room).not.toHaveBeenCalled();
});
it('room rejects browser identity and host claims', async () => {
  expect((await room(request({ action: 'create', host: 'attacker' }, 'screen.room'))).status).toBe(400);
  expect(m.room).not.toHaveBeenCalled();
});
it('room passes session identity and prevents token caching', async () => {
  const r = await room(request({ action: 'create' }, 'screen.room'));
  expect(r.status).toBe(200);
  expect(r.headers.get('cache-control')).toContain('no-store');
  expect(m.room).toHaveBeenCalledWith({ discordId: '123456789012345678', name: 'Cidadão' }, { action: 'create' });
});
it('room rejects cross-origin mutation', async () =>
  expect((await room(request({ action: 'create' }, 'screen.room', 'https://evil.test'))).status).toBe(403));
