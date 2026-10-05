import { it, expect, vi } from 'vitest';
import { CaptureController, captureConstraints, qualityPresets } from '@/lib/screen/media';
function track(kind = 'video') {
  const t = new EventTarget() as EventTarget & {
    kind: string;
    readyState: string;
    muted: boolean;
    enabled: boolean;
    stop: ReturnType<typeof vi.fn>;
    applyConstraints: ReturnType<typeof vi.fn>;
  };
  Object.assign(t, {
    kind,
    readyState: 'live',
    muted: false,
    enabled: true,
    stop: vi.fn(() => {
      t.readyState = 'ended';
    }),
    applyConstraints: vi.fn(async () => {}),
  });
  return t;
}
function stream(audio = false) {
  const video = track(),
    sound = audio ? track('audio') : null;
  return {
    video,
    sound,
    media: {
      getTracks: () => (sound ? [video, sound] : [video]),
      getVideoTracks: () => [video],
      getAudioTracks: () => (sound ? [sound] : []),
    } as unknown as MediaStream,
  };
}
it.each(Object.keys(qualityPresets) as (keyof typeof qualityPresets)[])(
  'qualidade %s usa preferências sem exact/min',
  (q) => {
    const c = captureConstraints(q, true);
    expect(c.audio).toBe(true);
    expect(JSON.stringify(c)).not.toMatch(/exact|min/);
  },
);
it('sem audio track continua vídeo sem inventar áudio', async () => {
  const s = stream(),
    notify = vi.fn(),
    c = new CaptureController({ getDisplayMedia: vi.fn(async () => s.media) }, notify);
  await c.start('auto', true);
  expect(c.stream?.getAudioTracks()).toEqual([]);
  expect(notify).toHaveBeenLastCalledWith('capturing', s.media);
  c.stop();
});
it('troca de fonte encerra tracks antigos e mantém nova', async () => {
  const a = stream(true),
    b = stream(),
    getDisplayMedia = vi.fn().mockResolvedValueOnce(a.media).mockResolvedValueOnce(b.media),
    c = new CaptureController({ getDisplayMedia }, vi.fn());
  await c.start('auto', true);
  await c.start('720p60', false);
  expect(a.video.stop).toHaveBeenCalled();
  expect(a.sound?.stop).toHaveBeenCalled();
  expect(c.stream).toBe(b.media);
  c.stop();
});
it('cancelar nova seleção mantém captura anterior', async () => {
  const a = stream(),
    getDisplayMedia = vi.fn().mockResolvedValueOnce(a.media).mockRejectedValueOnce(Error()),
    c = new CaptureController({ getDisplayMedia }, vi.fn());
  await c.start('auto', true);
  await expect(c.start('auto', true)).rejects.toThrow();
  expect(c.stream).toBe(a.media);
  expect(a.video.stop).not.toHaveBeenCalled();
  c.stop();
});
it('ended encerra áudio e remove stream', async () => {
  const s = stream(true),
    notify = vi.fn(),
    c = new CaptureController({ getDisplayMedia: vi.fn(async () => s.media) }, notify);
  await c.start('auto', true);
  s.video.dispatchEvent(new Event('ended'));
  expect(c.stream).toBeNull();
  expect(s.sound?.stop).toHaveBeenCalled();
  expect(notify).toHaveBeenLastCalledWith('ended', null);
});
it('mute e unmute atualizam estado', async () => {
  const s = stream(),
    notify = vi.fn(),
    c = new CaptureController({ getDisplayMedia: vi.fn(async () => s.media) }, notify);
  await c.start('auto', true);
  s.video.dispatchEvent(new Event('mute'));
  expect(notify).toHaveBeenLastCalledWith('muted', s.media);
  s.video.dispatchEvent(new Event('unmute'));
  expect(notify).toHaveBeenLastCalledWith('capturing', s.media);
  c.stop();
});
it('sair durante seletor pendente impede captura órfã', async () => {
  const s = stream();
  let resolve!: (s: MediaStream) => void;
  const c = new CaptureController(
    {
      getDisplayMedia: () =>
        new Promise((r) => {
          resolve = r;
        }),
    },
    vi.fn(),
  );
  const pending = c.start('auto', true);
  c.stop();
  resolve(s.media);
  await pending;
  expect(s.video.stop).toHaveBeenCalled();
  expect(c.stream).toBeNull();
});
it('áudio e qualidade controlados independentemente', async () => {
  const s = stream(true),
    c = new CaptureController({ getDisplayMedia: vi.fn(async () => s.media) }, vi.fn());
  await c.start('auto', true);
  c.audio(false);
  expect(s.sound?.enabled).toBe(false);
  await c.quality('480p30');
  expect(s.video.applyConstraints).toHaveBeenCalledWith({ height: { ideal: 480 }, frameRate: { ideal: 30 } });
  c.stop();
});
it('fim da track de áudio atualiza disponibilidade sem parar vídeo', async () => {
  const s = stream(true),
    notify = vi.fn(),
    c = new CaptureController({ getDisplayMedia: vi.fn(async () => s.media) }, notify);
  await c.start('auto', true);
  s.sound!.readyState = 'ended';
  s.sound!.dispatchEvent(new Event('ended'));
  expect(notify).toHaveBeenLastCalledWith('capturing', s.media);
  expect(s.video.stop).not.toHaveBeenCalled();
  c.stop();
});
