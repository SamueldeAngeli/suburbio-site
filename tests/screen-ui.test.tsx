// @vitest-environment jsdom
import React from 'react';
import { it, expect, vi, afterEach, beforeEach, describe } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, act } from '@testing-library/react';
type Handler = (...args: unknown[]) => void;
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
  }[],
  identity: '123456789012345678',
  metadata: '',
}));
vi.mock('livekit-client', () => ({
  Track: {
    Source: { ScreenShare: 'screen_share', ScreenShareAudio: 'screen_share_audio', Microphone: 'microphone' },
    Kind: { Video: 'video', Audio: 'audio' },
  },
  RoomEvent: new Proxy({}, { get: (_, key) => String(key) }),
  DisconnectReason: { CLIENT_INITIATED: 1, DUPLICATE_IDENTITY: 2, PARTICIPANT_REMOVED: 4, ROOM_DELETED: 5 },
  Room: class {
    static getLocalDevices = vi.fn(async () => []);
    handlers = new Map<string, Handler[]>();
    metadata = m.metadata;
    localParticipant = {
      identity: m.identity,
      name: 'Eu',
      trackPublications: new Map(),
      publishTrack: m.publish,
      unpublishTrack: m.unpublish,
      setMicrophoneEnabled: m.microphone,
    };
    remoteParticipants = new Map();
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
    switchActiveDevice = vi.fn(async () => true);
    startAudio = vi.fn(async () => {});
  },
}));
import { ScreenPreview } from '@/components/screen/screen-preview';

const HOST = '123456789012345678',
  OTHER = '223456789012345678';
const meta = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({ host: HOST, locked: false, capacity: 10, presenters: [], silenced: [], ...extra });
const connection = (role = 'host', host = HOST) => ({
  code: 'ABCDEF1234',
  title: 'Sala de Host',
  host,
  locked: false,
  capacity: 10,
  role,
  url: 'wss://tela.example',
  token: 'fixture',
});
function media(name?: string) {
  const track = Object.assign(new EventTarget(), {
    kind: 'video',
    readyState: 'live',
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
function backend(responses: (body: { action: string }) => Response) {
  const fetch = vi.fn(async (_url: string, init: RequestInit) => responses(JSON.parse(String(init.body))));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
const lastRoom = () => m.rooms.at(-1)!;

beforeEach(() => {
  m.rooms.length = 0;
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

it('sem sala não publica captura e não mostra controles de host', () => {
  render(<ScreenPreview />);
  expect((screen.getByRole('button', { name: 'Compartilhar tela' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByText('Controles do host')).toBeNull();
  expect(m.publish).not.toHaveBeenCalled();
});

it('anfitrião: publica uma vez, microfone separado, track ended remove publicação', async () => {
  const video = media();
  backend(() => Response.json(connection()));
  vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia: video.getDisplayMedia } });
  render(<ScreenPreview />);
  fireEvent.click(screen.getByRole('button', { name: 'Criar sala' }));
  await screen.findByText('Conectado');
  expect(sessionStorage.getItem('suburbio:tela:sala')).toBe('ABCDEF1234');
  const share = screen.getByRole('button', { name: 'Compartilhar tela' });
  fireEvent.click(share);
  fireEvent.click(share);
  await screen.findByRole('button', { name: 'Trocar compartilhamento' });
  expect(m.publish).toHaveBeenCalledTimes(1);
  expect(m.publish).toHaveBeenCalledWith(
    video.track,
    expect.objectContaining({ source: 'screen_share', simulcast: true }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Ligar microfone' }));
  await screen.findByRole('button', { name: 'Desligar microfone' });
  expect(m.microphone).toHaveBeenCalledWith(true, undefined);
  expect(video.track.stop).not.toHaveBeenCalled();
  await act(async () => video.track.dispatchEvent(new Event('ended')));
  await waitFor(() => expect(m.unpublish).toHaveBeenCalledWith(video.track));
  expect(screen.getByText('Nenhuma tela sua sendo transmitida')).toBeTruthy();
});

it('participante não transmite até o anfitrião permitir; revogação para a captura local', async () => {
  m.identity = OTHER;
  const video = media();
  backend(() => Response.json(connection('participant')));
  vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia: video.getDisplayMedia } });
  render(<ScreenPreview />);
  fireEvent.change(screen.getByLabelText('Código da sala'), { target: { value: 'ABCDEF1234' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar na sala' }));
  await screen.findByText('Conectado');
  const share = screen.getByRole('button', { name: 'Compartilhar tela' }) as HTMLButtonElement;
  expect(share.disabled).toBe(true);
  expect(screen.queryByText('Controles do host')).toBeNull();
  await act(async () => lastRoom().emit('RoomMetadataChanged', meta({ presenters: [OTHER] })));
  expect(share.disabled).toBe(false);
  fireEvent.click(share);
  await screen.findByRole('button', { name: 'Trocar compartilhamento' });
  await act(async () => lastRoom().emit('RoomMetadataChanged', meta({ presenters: [] })));
  await waitFor(() => expect(m.unpublish).toHaveBeenCalledWith(video.track));
  expect(video.track.stop).toHaveBeenCalled();
});

describe('estados de erro e desconexão', () => {
  it('sala cheia mostra estado próprio', async () => {
    backend(() => Response.json({ error: { code: 'ROOM_FULL', message: 'Esta sala está cheia.' } }, { status: 409 }));
    render(<ScreenPreview />);
    fireEvent.change(screen.getByLabelText('Código da sala'), { target: { value: 'ABCDEF1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar na sala' }));
    await screen.findAllByText('Sala cheia');
    expect(screen.getByText(/Todas as vagas desta sala estão ocupadas/)).toBeTruthy();
    expect(m.rooms).toHaveLength(0);
  });
  it.each([
    [4, 'Você foi removido da sala'],
    [5, 'Transmissão encerrada'],
  ])('desconexão com motivo %i mostra "%s" e esquece a sala', async (reason, label) => {
    backend(() => Response.json(connection()));
    render(<ScreenPreview />);
    fireEvent.click(screen.getByRole('button', { name: 'Criar sala' }));
    await screen.findByText('Conectado');
    await act(async () => lastRoom().emit('Disconnected', reason));
    await screen.findAllByText(label);
    expect(sessionStorage.getItem('suburbio:tela:sala')).toBeNull();
  });
  it('permissão de captura negada mostra orientação, sem publicar', async () => {
    const denied = media('NotAllowedError');
    backend(() => Response.json(connection()));
    vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia: denied.getDisplayMedia } });
    render(<ScreenPreview />);
    fireEvent.click(screen.getByRole('button', { name: 'Criar sala' }));
    await screen.findByText('Conectado');
    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar tela' }));
    await screen.findByText(/Permissão de captura negada/);
    expect(m.publish).not.toHaveBeenCalled();
  });
  it('serviço indisponível mostra estado limpo', async () => {
    backend(() =>
      Response.json({ error: { code: 'ROOM_UNAVAILABLE', message: 'Transmissão indisponível.' } }, { status: 503 }),
    );
    render(<ScreenPreview />);
    fireEvent.click(screen.getByRole('button', { name: 'Criar sala' }));
    await screen.findAllByText('Serviço indisponível');
  });
});

describe('reconexão', () => {
  it('queda inesperada tenta de novo com espera, sem loop; volta conectado na mesma sala', async () => {
    const fetch = backend(() => Response.json(connection()));
    render(<ScreenPreview />);
    fireEvent.click(screen.getByRole('button', { name: 'Criar sala' }));
    await screen.findByText('Conectado');
    vi.useFakeTimers();
    await act(async () => lastRoom().emit('Disconnected', 0));
    expect(screen.getByText('Reconectando…')).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_999);
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    vi.useRealTimers();
    await screen.findByText('Conectado');
    expect(JSON.parse(String(fetch.mock.calls[1]![1].body))).toEqual({ action: 'join', code: 'ABCDEF1234' });
    expect(m.rooms).toHaveLength(2);
  });
  it('reload da aba volta para a mesma sala automaticamente', async () => {
    sessionStorage.setItem('suburbio:tela:sala', 'ABCDEF1234');
    const fetch = backend(() => Response.json(connection()));
    render(<ScreenPreview />);
    await screen.findByText('Conectado');
    expect(JSON.parse(String(fetch.mock.calls[0]![1].body))).toEqual({ action: 'join', code: 'ABCDEF1234' });
  });
});

it('desmontar remove listeners, para tracks locais e desconecta a sala', async () => {
  const video = media();
  backend(() => Response.json(connection()));
  vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia: video.getDisplayMedia } });
  const view = render(<ScreenPreview />);
  fireEvent.click(screen.getByRole('button', { name: 'Criar sala' }));
  await screen.findByText('Conectado');
  fireEvent.click(screen.getByRole('button', { name: 'Compartilhar tela' }));
  await screen.findByRole('button', { name: 'Trocar compartilhamento' });
  view.unmount();
  await waitFor(() => expect(m.disconnect).toHaveBeenCalled());
  expect(m.removeAll).toHaveBeenCalled();
  expect(video.track.stop).toHaveBeenCalled();
});
