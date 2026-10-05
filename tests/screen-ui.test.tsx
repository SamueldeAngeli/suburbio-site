// @vitest-environment jsdom
import React from 'react';
import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, act } from '@testing-library/react';
const m = vi.hoisted(() => ({ publish: vi.fn(), unpublish: vi.fn(), microphone: vi.fn(), disconnect: vi.fn() }));
vi.mock('livekit-client', () => ({
  Track: { Source: { ScreenShare: 'screen', ScreenShareAudio: 'audio', Microphone: 'mic' } },
  RoomEvent: {},
  Room: class {
    localParticipant = {
      identity: '123456789012345678',
      permissions: { canPublish: true },
      trackPublications: new Map(),
      publishTrack: m.publish,
      unpublishTrack: m.unpublish,
      setMicrophoneEnabled: m.microphone,
    };
    remoteParticipants = new Map();
    on() {
      return this;
    }
    async connect() {}
    disconnect = m.disconnect;
  },
}));
import { ScreenPreview } from '@/components/screen/screen-preview';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
function media() {
  const track = Object.assign(new EventTarget(), {
    kind: 'video',
    readyState: 'live',
    stop: vi.fn(),
    getSettings: () => ({ width: 640, height: 360 }),
  });
  return { track, stream: { getTracks: () => [track], getVideoTracks: () => [track], getAudioTracks: () => [] } };
}
it('sem sala não publica captura e não mostra controles de host', () => {
  render(<ScreenPreview />);
  expect((screen.getByRole('button', { name: 'Compartilhar tela' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByText('Controles do host')).toBeNull();
  expect(m.publish).not.toHaveBeenCalled();
});
it('sala conecta, mic separado e track ended removem publicação', async () => {
  const video = media();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      Response.json({
        code: 'ABCDEF1234',
        host: '123456789012345678',
        locked: false,
        url: 'ws://127.0.0.1:7880',
        token: 'fixture',
      }),
    ),
  );
  vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia: vi.fn(async () => video.stream) } });
  render(<ScreenPreview />);
  fireEvent.click(screen.getByRole('button', { name: 'Criar sala' }));
  await screen.findByText('Conectado');
  fireEvent.click(screen.getByRole('button', { name: 'Compartilhar tela' }));
  await screen.findByRole('button', { name: 'Trocar compartilhamento' });
  expect(m.publish).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Ligar microfone' }));
  await screen.findByRole('button', { name: 'Desligar microfone' });
  expect(m.microphone).toHaveBeenCalledWith(true);
  expect(video.track.stop).not.toHaveBeenCalled();
  await act(async () => video.track.dispatchEvent(new Event('ended')));
  await waitFor(() => expect(m.unpublish).toHaveBeenCalledWith(video.track));
  expect(screen.getByText('Nenhuma tela sua sendo transmitida')).toBeTruthy();
});
