export const qualityPresets = {
  auto: { label: 'Automática — recomendado na sala', height: 720, fps: 30 },
  '360p30': { label: '360p · 30 FPS', height: 360, fps: 30 },
  '480p30': { label: 'Econômico · 480p30', height: 480, fps: 30 },
  '720p30': { label: 'Equilibrado · 720p30', height: 720, fps: 30 },
  '720p60': { label: 'Jogo · 720p60', height: 720, fps: 60 },
  '1080p30': { label: 'Alta · 1080p30', height: 1080, fps: 30 },
  '1080p60': { label: 'Máxima · 1080p60', height: 1080, fps: 60 },
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
  async quality(value: Quality) {
    const p = qualityPresets[value];
    await this.stream
      ?.getVideoTracks()[0]
      ?.applyConstraints({ height: { ideal: p.height }, frameRate: { ideal: p.fps } });
  }
  audio(enabled: boolean) {
    this.stream?.getAudioTracks().forEach((t) => {
      t.enabled = enabled;
    });
  }
  stop() {
    this.version++;
    this.clean();
    stopStream(this.stream);
    this.stream = null;
    this.notify('idle', null);
  }
}
