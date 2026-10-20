// @vitest-environment jsdom
import React from 'react';
import { it, expect, vi, afterEach, beforeEach, describe } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, act } from '@testing-library/react';
type Handler = (...args: unknown[]) => void;
type FakeParticipant = { identity: string; name: string; metadata: string; trackPublications: Map<string, unknown> };
const m = vi.hoisted(() => ({
  publish: vi.fn(),
  unpublish: vi.fn(),
  microphone: vi.fn(),
  disconnect: vi.fn(),
  removeAll: vi.fn(),
  rooms: [] as {
    emit: (event: string, ...args: unknown[]) => void;
    metadata: string;
    localParticipant: { identity: string };
    remoteParticipants: Map<string, unknown>;
  }[],
  identity: '123456789012345678',
  metadata: '',
  remote: [] as unknown[],
}));
vi.mock('livekit-client', () => ({
  Track: {
    Source: { ScreenShare: 'screen_share', ScreenShareAudio: 'screen_share_audio', Microphone: 'microphone' },
    Kind: { Video: 'video', Audio: 'audio' },
  },
  RoomEvent: new Proxy({}, { get: (_, key) => String(key) }),
  DisconnectReason: { CLIENT_INITIATED: 1, DUPLICATE_IDENTITY: 2, PARTICIPANT_REMOVED: 4, ROOM_DELETED: 5 },
  Room: class {
    handlers = new Map<string, Handler[]>();
    metadata = m.metadata;
    localParticipant = {
      identity: m.identity,
      name: 'Eu',
      metadata: '{}',
      trackPublications: new Map(),
      publishTrack: m.publish,
      unpublishTrack: m.unpublish,
      setMicrophoneEnabled: m.microphone,
    };
    remoteParticipants = new Map((m.remote as FakeParticipant[]).map((p) => [p.identity, p]));
    constructor() {
      m.rooms.push(this);
    }
    on(event: string, fn: Handler) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), fn]);
      return this;
    }
    emit(event: string, ...args: unknown[]) {
      for (const fn of this.handlers.get(event) ?? []) fn(...args);
    }
    removeAllListeners() {
      m.removeAll();
      this.handlers.clear();
      return this;
    }
    async connect() {}
    disconnect = m.disconnect;
    startAudio = vi.fn(async () => {});
  },
}));
import { ScreenPreview } from '@/components/screen/screen-preview';

const HOST = '123456789012345678',
  OTHER = '223456789012345678',
  KEY = 'suburbio:tela:sala';
const meta = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    host: HOST,
    hostName: 'Host',
    title: 'Corrida',
    locked: false,
    capacity: 10,
    presenters: [],
    silenced: [],
    ...extra,
  });
const connection = (role = 'host', extra: Record<string, unknown> = {}) => ({
  code: 'ABCDEF1234',
  title: 'Corrida',
  description: '',
  category: 'gameplay',
  visibility: 'public',
  host: HOST,
  hostName: 'Host',
  hostAvatar: null,
  startedAt: null,
  locked: false,
  capacity: 10,
  role,
  url: 'wss://tela.example',
  token: 'fixture',
  ...extra,
});
const card = (extra: Record<string, unknown> = {}) => ({
  code: 'FEDCBA4321',
  title: 'Evento na praça',
  description: 'Corrida de rua',
  category: 'evento',
  visibility: 'public',
  host: OTHER,
  hostName: 'Fulano',
  hostAvatar: null,
  status: 'live',
  startedAt: Date.now() - 65_000,
  viewers: 3,
  peakViewers: 4,
  hostConnected: true,
  ...extra,
});
const emptyList = { live: [], mine: null, ended: [] };
function media(name?: string) {
  const track = Object.assign(new EventTarget(), {
    kind: 'video',
    readyState: 'live',
    muted: false,
    stop: vi.fn(),
    getSettings: () => ({ width: 640, height: 360 }),
  });
  const stream = { getTracks: () => [track], getVideoTracks: () => [track], getAudioTracks: () => [] };
  const getDisplayMedia = vi.fn(async () => {
    if (name) throw Object.assign(new Error('denied'), { name });
    return stream;
  });
  return { track, stream, getDisplayMedia };
}
type Body = { action: string; [key: string]: unknown };
function backend(post: (body: Body) => Response, list: () => unknown = () => emptyList) {
  const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === 'POST' ? post(JSON.parse(String(init.body))) : Response.json(list()),
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
const posts = (fetch: ReturnType<typeof backend>) =>
  fetch.mock.calls.filter(([, init]) => init?.method === 'POST').map(([, init]) => JSON.parse(String(init!.body)));
const lastRoom = () => m.rooms.at(-1)!;
async function startBroadcast(title = 'Corrida na zona norte') {
  fireEvent.click(await screen.findByRole('button', { name: 'Iniciar transmissão' }));
  fireEvent.change(screen.getByLabelText('Título'), { target: { value: title } });
  fireEvent.click(screen.getByRole('button', { name: 'Escolher tela e entrar ao vivo' }));
}

beforeEach(() => {
  m.rooms.length = 0;
  m.remote = [];
  m.identity = HOST;
  m.metadata = meta();
  m.disconnect.mockResolvedValue(undefined);
  m.publish.mockResolvedValue(undefined);
  m.unpublish.mockResolvedValue(undefined);
  m.microphone.mockResolvedValue(undefined);
  sessionStorage.clear();
  history.replaceState(null, '', '/tela');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('central', () => {
  it('sem transmissões mostra estado vazio e o botão de iniciar, sem publicar nada', async () => {
    backend(() => Response.json({}));
    render(<ScreenPreview />);
    await screen.findByText('Ninguém está transmitindo agora.');
    expect(screen.getByRole('heading', { name: 'Transmissões' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Iniciar transmissão' })).toBeTruthy();
    expect(m.publish).not.toHaveBeenCalled();
  });
  it('lista ao vivo com título, transmissor, espectadores e AO VIVO; assistir entra só para assistir', async () => {
    m.identity = OTHER;
    m.metadata = meta({ host: OTHER, hostName: 'Fulano' });
    const fetch = backend(
      () => Response.json(connection('participant', { code: 'FEDCBA4321', host: OTHER, hostName: 'Fulano' })),
      () => ({ ...emptyList, live: [card()] }),
    );
    m.identity = '323456789012345678';
    render(<ScreenPreview />);
    await screen.findByText('Evento na praça');
    expect(screen.getByText('AO VIVO')).toBeTruthy();
    expect(screen.getByText('Fulano')).toBeTruthy();
    expect(screen.getByText('Evento')).toBeTruthy();
    expect(screen.getByTitle('Assistindo agora').textContent).toContain('3');
    fireEvent.click(screen.getByRole('button', { name: 'Assistir' }));
    await screen.findByRole('toolbar', { name: 'Controles do espectador' });
    expect(posts(fetch)).toEqual([{ action: 'join', code: 'FEDCBA4321' }]);
    expect(screen.getByRole('button', { name: 'Tela cheia' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Silenciar' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Encerrar transmissão' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Compartilhar tela' })).toBeNull();
    expect(m.publish).not.toHaveBeenCalled();
  });
  it('transmissão própria aberta: oferece voltar ou encerrar, sem iniciar outra', async () => {
    const fetch = backend(
      () => Response.json({ ended: true }),
      () => ({ ...emptyList, mine: card({ host: HOST, code: 'ABCDEF1234', status: 'paused' }) }),
    );
    render(<ScreenPreview />);
    await screen.findByRole('button', { name: 'Voltar para a transmissão' });
    expect(screen.queryByRole('button', { name: 'Iniciar transmissão' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar' }));
    await waitFor(() => expect(posts(fetch)).toEqual([{ action: 'end', code: 'ABCDEF1234' }]));
  });
});

describe('quem transmite', () => {
  it('escolhe a tela antes de criar, publica uma vez, não liga microfone e marca ao vivo no servidor', async () => {
    const video = media();
    const order: string[] = [];
    video.getDisplayMedia.mockImplementation(async () => {
      order.push('capture');
      return video.stream;
    });
    const fetch = backend((body) => {
      order.push(body.action);
      return Response.json(connection());
    });
    vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia: video.getDisplayMedia } });
    render(<ScreenPreview />);
    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar transmissão' }));
    expect((screen.getByRole('button', { name: 'Escolher tela e entrar ao vivo' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Corrida na zona norte' } });
    fireEvent.change(screen.getByLabelText(/Categoria/), { target: { value: 'gameplay' } });
    fireEvent.click(screen.getByRole('button', { name: 'Escolher tela e entrar ao vivo' }));
    await screen.findByRole('button', { name: 'Parar compartilhamento' });
    await waitFor(() => expect(order).toEqual(['capture', 'create', 'live']));
    expect(posts(fetch)[0]).toEqual({
      action: 'create',
      title: 'Corrida na zona norte',
      category: 'gameplay',
      visibility: 'public',
    });
    expect(m.publish).toHaveBeenCalledTimes(1);
    expect(m.publish).toHaveBeenCalledWith(
      video.track,
      expect.objectContaining({ source: 'screen_share', simulcast: true }),
    );
    expect(m.microphone).not.toHaveBeenCalled();
    expect(JSON.parse(sessionStorage.getItem(KEY)!)).toMatchObject({ code: 'ABCDEF1234' });
  });
  it('permissão de captura negada: mensagem amigável, sem criar sala e sem publicar', async () => {
    const denied = media('NotAllowedError');
    const fetch = backend(() => Response.json(connection()));
    vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia: denied.getDisplayMedia } });
    render(<ScreenPreview />);
    await startBroadcast();
    await screen.findByText(/Não foi possível acessar sua tela/);
    expect(posts(fetch)).toEqual([]);
    expect(m.publish).not.toHaveBeenCalled();
  });
  it('já tem transmissão aberta: libera a captura e mostra como voltar', async () => {
    const video = media();
    backend(
      () =>
        Response.json(
          { error: { code: 'ROOM_ACTIVE_EXISTS', message: 'Você já tem uma transmissão aberta.' } },
          { status: 409 },
        ),
      () => emptyList,
    );
    vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia: video.getDisplayMedia } });
    render(<ScreenPreview />);
    await startBroadcast();
    await screen.findByText('Você já tem uma transmissão aberta.');
    expect(video.track.stop).toHaveBeenCalled();
    expect(m.publish).not.toHaveBeenCalled();
  });
  it('compartilhamento interrompido pelo navegador: sala continua aberta e dá para retomar', async () => {
    const video = media();
    backend(() => Response.json(connection()));
    vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia: video.getDisplayMedia } });
    render(<ScreenPreview />);
    await startBroadcast();
    await screen.findByRole('button', { name: 'Parar compartilhamento' });
    await act(async () => video.track.dispatchEvent(new Event('ended')));
    await waitFor(() => expect(m.unpublish).toHaveBeenCalledWith(video.track));
    expect(screen.getAllByText('Compartilhamento interrompido').length).toBeGreaterThan(0);
    expect(m.disconnect).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Compartilhar tela' })[0]!);
    await screen.findByRole('button', { name: 'Parar compartilhamento' });
    expect(m.publish).toHaveBeenCalledTimes(2);
  });
  it('encerrar pede confirmação; cancelar mantém; confirmar encerra para todos', async () => {
    const video = media();
    const fetch = backend((body) => Response.json(body.action === 'end' ? { ended: true } : connection()));
    vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia: video.getDisplayMedia } });
    render(<ScreenPreview />);
    await startBroadcast();
    await screen.findByRole('button', { name: 'Parar compartilhamento' });
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar transmissão' }));
    expect(screen.getByRole('alertdialog', { name: 'Encerrar transmissão?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar transmitindo' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(posts(fetch).some((b) => b.action === 'end')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar transmissão' }));
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar' }));
    await screen.findByText('Esta transmissão foi encerrada.');
    expect(posts(fetch).at(-1)).toEqual({ action: 'end', code: 'ABCDEF1234' });
    expect(sessionStorage.getItem(KEY)).toBeNull();
    expect(video.track.stop).toHaveBeenCalled();
  });
});

describe('quem assiste', () => {
  it('antes de começar: avisa que vai começar, não que caiu', async () => {
    m.identity = OTHER;
    backend(() => Response.json(connection('participant')));
    history.replaceState(null, '', '/tela?room=ABCDEF1234');
    render(<ScreenPreview />);
    await screen.findByText('A transmissão vai começar');
    expect(screen.queryByText('O transmissor perdeu a conexão.')).toBeNull();
  });
  it('transmissor caiu depois de ir ao vivo: avisa que perdeu a conexão em vez de tela preta', async () => {
    m.identity = OTHER;
    m.metadata = meta({ startedAt: Date.now() - 60_000 });
    backend(() => Response.json(connection('participant')));
    history.replaceState(null, '', '/tela?room=ABCDEF1234');
    render(<ScreenPreview />);
    await screen.findByText('O transmissor perdeu a conexão.');
  });
  it('transmissor conectado sem tela: transmissão pausada', async () => {
    m.identity = OTHER;
    m.metadata = meta({ startedAt: Date.now() - 1000 });
    m.remote = [{ identity: HOST, name: 'Host', metadata: '{}', trackPublications: new Map() }];
    backend(() => Response.json(connection('participant')));
    history.replaceState(null, '', '/tela?room=ABCDEF1234');
    render(<ScreenPreview />);
    await screen.findByText('Transmissão pausada');
  });
  it('tela cheia real no palco', async () => {
    m.identity = OTHER;
    backend(() => Response.json(connection('participant')));
    history.replaceState(null, '', '/tela?room=ABCDEF1234');
    const requestFullscreen = vi.fn(async () => {});
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { value: requestFullscreen, configurable: true });
    render(<ScreenPreview />);
    fireEvent.click(await screen.findByRole('button', { name: 'Tela cheia' }));
    await waitFor(() => expect(requestFullscreen).toHaveBeenCalled());
    expect(requestFullscreen.mock.contexts[0]).toBe(screen.getByLabelText('Transmissão'));
  });
  it('mouse parado esconde controles e selos; mexer o mouse mostra de novo', async () => {
    m.identity = OTHER;
    backend(() => Response.json(connection('participant')));
    history.replaceState(null, '', '/tela?room=ABCDEF1234');
    render(<ScreenPreview />);
    await screen.findByRole('toolbar', { name: 'Controles do espectador' });
    const stage = screen.getByLabelText('Transmissão');
    vi.useFakeTimers();
    fireEvent.mouseMove(stage);
    expect(stage.className).not.toContain('is-idle');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_600);
    });
    expect(stage.className).toContain('is-idle');
    fireEvent.mouseMove(stage);
    expect(stage.className).not.toContain('is-idle');
    // Mouse sobre a barra de controles: não some enquanto estiver ali.
    fireEvent.mouseEnter(screen.getByRole('toolbar', { name: 'Controles do espectador' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(stage.className).not.toContain('is-idle');
    vi.useRealTimers();
  });
  it('link de convite privado envia o convite na entrada', async () => {
    m.identity = OTHER;
    const fetch = backend(() => Response.json(connection('participant')));
    history.replaceState(null, '', `/tela?room=ABCDEF1234&invite=${'a'.repeat(32)}`);
    render(<ScreenPreview />);
    await screen.findByRole('toolbar', { name: 'Controles do espectador' });
    expect(posts(fetch)[0]).toEqual({ action: 'join', code: 'ABCDEF1234', invite: 'a'.repeat(32) });
  });
});

describe('estados de erro e desconexão', () => {
  it('transmissão lotada mostra estado próprio', async () => {
    backend(() => Response.json({ error: { code: 'ROOM_FULL', message: 'Lotada.' } }, { status: 409 }));
    history.replaceState(null, '', '/tela?room=ABCDEF1234');
    render(<ScreenPreview />);
    await screen.findByText('Transmissão lotada');
    expect(m.rooms).toHaveLength(0);
  });
  it('privada sem convite explica como entrar', async () => {
    backend(() => Response.json({ error: { code: 'ROOM_INVITE_REQUIRED', message: 'Privada.' } }, { status: 403 }));
    history.replaceState(null, '', '/tela?room=ABCDEF1234');
    render(<ScreenPreview />);
    await screen.findByText('Transmissão privada');
  });
  it.each([
    [4, 'Você foi removido'],
    [5, 'Transmissão encerrada'],
  ])('desconexão com motivo %i mostra "%s" e esquece a sala', async (reason, label) => {
    m.identity = OTHER;
    backend(() => Response.json(connection('participant')));
    history.replaceState(null, '', '/tela?room=ABCDEF1234');
    render(<ScreenPreview />);
    await screen.findByRole('toolbar', { name: 'Controles do espectador' });
    await act(async () => lastRoom().emit('Disconnected', reason));
    await screen.findByText(label);
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });
  it('serviço indisponível mostra estado limpo, sem detalhes internos', async () => {
    backend(() =>
      Response.json({ error: { code: 'ROOM_UNAVAILABLE', message: 'Transmissão indisponível.' } }, { status: 503 }),
    );
    history.replaceState(null, '', '/tela?room=ABCDEF1234');
    render(<ScreenPreview />);
    await screen.findByText('Transmissão indisponível');
    expect(document.body.textContent).not.toMatch(/stack|ECONN|127\.0\.0\.1/);
  });
});

describe('reconexão', () => {
  it('queda inesperada tenta de novo com espera, sem loop; volta para a mesma transmissão', async () => {
    m.identity = OTHER;
    const fetch = backend(() => Response.json(connection('participant')));
    history.replaceState(null, '', '/tela?room=ABCDEF1234');
    render(<ScreenPreview />);
    await screen.findByRole('toolbar', { name: 'Controles do espectador' });
    vi.useFakeTimers();
    await act(async () => lastRoom().emit('Disconnected', 0));
    expect(screen.getByText('Reconectando à transmissão…')).toBeTruthy();
    expect(posts(fetch)).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_999);
    });
    expect(posts(fetch)).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    vi.useRealTimers();
    await screen.findByRole('toolbar', { name: 'Controles do espectador' });
    expect(posts(fetch)[1]).toEqual({ action: 'join', code: 'ABCDEF1234' });
    expect(m.rooms).toHaveLength(2);
  });
  it.each([
    ['formato atual', JSON.stringify({ code: 'ABCDEF1234' })],
    ['formato anterior', 'ABCDEF1234'],
  ])('reload da aba volta para a mesma transmissão (%s)', async (_label, saved) => {
    sessionStorage.setItem(KEY, saved);
    const fetch = backend(() => Response.json(connection()));
    render(<ScreenPreview />);
    await screen.findByRole('toolbar', { name: 'Controles da transmissão' });
    expect(posts(fetch)[0]).toEqual({ action: 'join', code: 'ABCDEF1234' });
  });
});

it('desmontar remove listeners, para tracks locais e desconecta a sala', async () => {
  const video = media();
  backend(() => Response.json(connection()));
  vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia: video.getDisplayMedia } });
  const view = render(<ScreenPreview />);
  await startBroadcast();
  await screen.findByRole('button', { name: 'Parar compartilhamento' });
  view.unmount();
  await waitFor(() => expect(m.disconnect).toHaveBeenCalled());
  expect(m.removeAll).toHaveBeenCalled();
  expect(video.track.stop).toHaveBeenCalled();
});
