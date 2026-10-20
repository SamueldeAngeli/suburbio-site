import { it, expect, vi, beforeEach } from 'vitest';
const m = vi.hoisted(() => ({ session: vi.fn(), room: vi.fn(), list: vi.fn(), authorize: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ currentSession: m.session }));
vi.mock('@/lib/screen/rooms', () => ({
  roomAction: m.room,
  listBroadcasts: m.list,
  CATEGORIES: ['gameplay', 'staff', 'suporte', 'evento', 'apresentacao', 'outro'],
  SCREEN_MODERATION_CAPABILITY: 'PUNISHMENTS_WRITE',
}));
vi.mock('@/lib/permissions/guards', () => ({ authorize: m.authorize }));
vi.mock('@/lib/api/modules/accounts', () => ({ AccountService: class {} }));
vi.mock('@/lib/server/env', () => ({ serverEnv: () => ({ AUTH_URL: 'http://localhost:3002' }) }));
import { GET, POST } from '@/app/api/screen/room/route';

let user = 0;
const request = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('http://localhost:3002/api/screen/room', {
    method: 'POST',
    headers: {
      origin: 'http://localhost:3002',
      'content-type': 'application/json',
      'x-suburbio-intent': 'screen.room',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  // Usuário diferente por teste: o rate limit local não vaza entre casos.
  const discordId = `40000000000000${String(++user).padStart(4, '0')}`;
  m.session.mockResolvedValue({ user: { discordId, name: 'Cidadão' } });
  m.room.mockResolvedValue({ code: 'ABCDEF1234', token: 'jwt', url: 'wss://tela.example' });
});

it('sem sessão não recebe token nem chega na sala', async () => {
  m.session.mockResolvedValue(null);
  const response = await POST(request({ action: 'join', code: 'ABCDEF1234' }));
  expect(response.status).toBe(401);
  expect(m.room).not.toHaveBeenCalled();
});

it.each([
  { identity: '999999999999999999' },
  { discordId: '999999999999999999' },
  { role: 'host' },
  { name: 'Admin' },
  { canPublish: true },
  { room: 'suburbio-abc' },
])('payload não escolhe identity, papel ou sala interna: %o é recusado', async (extra) => {
  const response = await POST(request({ action: 'join', code: 'ABCDEF1234', ...extra }));
  expect(response.status).toBe(400);
  expect(m.room).not.toHaveBeenCalled();
});

it('identity e nome usados vêm exclusivamente da sessão', async () => {
  await POST(request({ action: 'join', code: 'ABCDEF1234' }));
  const [identity, input] = m.room.mock.calls[0]!;
  expect(identity).toEqual((await m.session.mock.results[0]!.value).user);
  expect(input).toEqual({ action: 'join', code: 'ABCDEF1234' });
});

it('exige origem do site e o cabeçalho de intenção (CSRF)', async () => {
  expect((await POST(request({ action: 'join', code: 'ABCDEF1234' }, { origin: 'https://evil.example' }))).status).toBe(
    403,
  );
  expect((await POST(request({ action: 'join', code: 'ABCDEF1234' }, { 'x-suburbio-intent': 'other' }))).status).toBe(
    400,
  );
  expect(m.room).not.toHaveBeenCalled();
});

it('corpo acima do limite é recusado antes da sala', async () => {
  const response = await POST(request(JSON.stringify({ action: 'join', code: 'ABCDEF1234', pad: 'x'.repeat(3000) })));
  expect(response.status).toBe(413);
  expect(m.room).not.toHaveBeenCalled();
});

it('código e alvo malformados são recusados (sem enumeração por formato livre)', async () => {
  for (const body of [
    { action: 'join', code: 'abc' },
    { action: 'kick', code: 'ABCDEF1234', target: 'not-a-snowflake' },
    { action: 'create', title: 'Teste', capacity: 1000 },
    { action: 'create' },
    { action: 'create', title: 'ab' },
    { action: 'create', title: 'Teste', category: 'twitch' },
    { action: 'join', code: 'ABCDEF1234', invite: 'nao-hex' },
  ])
    expect((await POST(request(body))).status).toBe(400);
  expect(m.room).not.toHaveBeenCalled();
});

it('criação de salas tem limite próprio (abuso)', async () => {
  const statuses = [];
  for (let i = 0; i < 6; i++) statuses.push((await POST(request({ action: 'create', title: 'Teste' }))).status);
  expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
  expect(statuses[5]).toBe(429);
});

it('emissão de tokens (join) tem limite próprio (abuso)', async () => {
  const statuses = [];
  for (let i = 0; i < 21; i++) statuses.push((await POST(request({ action: 'join', code: 'ABCDEF1234' }))).status);
  expect(statuses.filter((s) => s === 200)).toHaveLength(20);
  expect(statuses.at(-1)).toBe(429);
});

it('resposta nunca é cacheada', async () => {
  const response = await POST(request({ action: 'join', code: 'ABCDEF1234' }));
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});

it('lista de transmissões exige sessão e não é cacheada', async () => {
  m.session.mockResolvedValueOnce(null);
  expect((await GET()).status).toBe(401);
  expect(m.list).not.toHaveBeenCalled();
  m.list.mockResolvedValue({ live: [], mine: null, ended: [] });
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(m.list).toHaveBeenCalledWith((await m.session.mock.results.at(-1)!.value).user);
});

it('moderação: a capability só é consultada sob demanda e na API', async () => {
  await POST(request({ action: 'end', code: 'ABCDEF1234', reason: 'Conteúdo impróprio' }));
  expect(m.authorize).not.toHaveBeenCalled();
  const options = m.room.mock.calls[0]![3] as { isStaff: () => Promise<boolean> };
  m.authorize.mockResolvedValueOnce({});
  expect(await options.isStaff()).toBe(true);
  expect(m.authorize).toHaveBeenCalledWith(expect.any(String), 'PUNISHMENTS_WRITE', expect.anything());
  m.authorize.mockRejectedValueOnce(new Error('403'));
  expect(await options.isStaff()).toBe(false);
});
