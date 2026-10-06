import type { TrackPublishOptions } from 'livekit-client';

// Bitrate máximo da camada principal; o simulcast gera camadas menores para quem recebe em
// janela pequena ou rede fraca (adaptive stream + dynacast escolhem por espectador).
export const qualityPresets = {
  auto: { label: 'Automática — recomendado na sala', height: 720, fps: 30, bitrate: 2_500_000 },
  '360p30': { label: '360p · 30 FPS', height: 360, fps: 30, bitrate: 600_000 },
  '480p30': { label: 'Econômico · 480p30', height: 480, fps: 30, bitrate: 1_000_000 },
  '720p30': { label: 'Equilibrado · 720p30', height: 720, fps: 30, bitrate: 2_000_000 },
  '720p60': { label: 'Jogo · 720p60', height: 720, fps: 60, bitrate: 3_000_000 },
  '1080p30': { label: 'Alta · 1080p30', height: 1080, fps: 30, bitrate: 3_500_000 },
  '1080p60': { label: 'Máxima · 1080p60', height: 1080, fps: 60, bitrate: 5_000_000 },
};
export type Quality = keyof typeof qualityPresets;
export type CaptureState = 'idle' | 'capturing' | 'muted' | 'ended';
export function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}
export function captureConstraints(quality: Quality, audio: boolean): DisplayMediaStreamOptions {
  const p = qualityPresets[quality];
  return {
    video: { height: { ideal: p.height }, frameRate: { ideal: p.fps } },
    audio,
    selfBrowserSurface: 'exclude',
  } as DisplayMediaStreamOptions;
}
/** Publicação da tela: simulcast no vídeo; 60 FPS prioriza fluidez, demais priorizam nitidez. */
export function screenPublishOptions(quality: Quality, kind: string): TrackPublishOptions {
  const p = qualityPresets[quality];
  if (kind !== 'video') return { source: 'screen_share_audio' as TrackPublishOptions['source'] };
  return {
    source: 'screen_share' as TrackPublishOptions['source'],
    simulcast: true,
    screenShareEncoding: { maxBitrate: p.bitrate, maxFramerate: p.fps },
    degradationPreference: p.fps >= 60 ? 'maintain-framerate' : 'maintain-resolution',
  };
}
export class CaptureController {
  stream: MediaStream | null = null;
  private version = 0;
  private clean = () => {};
  constructor(
    private devices: Pick<MediaDevices, 'getDisplayMedia'>,
    private notify: (state: CaptureState, stream: MediaStream | null) => void,
  ) {}
  async start(quality: Quality, audio: boolean) {
    const version = ++this.version;
    const stream = await this.devices.getDisplayMedia(captureConstraints(quality, audio));
    if (version !== this.version) {
      stopStream(stream);
      return;
    }
    const video = stream.getVideoTracks()[0];
    if (!video || video.readyState === 'ended') {
      stopStream(stream);
      throw Error('NO_VIDEO');
    }
    this.clean();
    stopStream(this.stream);
    this.stream = stream;
    const ended = () => {
      this.clean();
      stopStream(stream);
      this.stream = null;
      this.notify('ended', null);
    };
    const mute = () => this.notify('muted', stream),
      unmute = () => this.notify('capturing', stream);
    const audioEnded = () => this.notify(video.muted ? 'muted' : 'capturing', stream);
    stream.getAudioTracks().forEach((t) => t.addEventListener('ended', audioEnded));
    video.addEventListener('ended', ended);
    video.addEventListener('mute', mute);
    video.addEventListener('unmute', unmute);
    this.clean = () => {
      stream.getAudioTracks().forEach((t) => t.removeEventListener('ended', audioEnded));
      video.removeEventListener('ended', ended);
      video.removeEventListener('mute', mute);
      video.removeEventListener('unmute', unmute);
    };
    this.notify(video.muted ? 'muted' : 'capturing', stream);
  }
  stop() {
    this.version++;
    this.clean();
    stopStream(this.stream);
    this.stream = null;
    this.notify('idle', null);
  }
}
