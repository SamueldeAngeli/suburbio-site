'use client';
import { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track, type Participant } from 'livekit-client';
import { CaptureController, qualityPresets, stopStream, type Quality } from '@/lib/screen/media';
import { requestRoom, type RoomConnection as Connection, type RoomState } from '@/lib/screen/room-client';
function Media({ track }: { track: Track }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = track.attach();
    node.autoplay = true;
    if (node instanceof HTMLVideoElement) {
      node.playsInline = true;
      node.style.width = '100%';
    }
    if (track.isLocal) node.muted = true;
    ref.current?.appendChild(node);
    return () => {
      track.detach(node);
      node.remove();
    };
  }, [track]);
  return <div ref={ref} />;
}
export function ScreenPreview() {
  const [connection, setConnection] = useState<Connection | null>(null),
    [code, setCode] = useState(''),
    [status, setStatus] = useState('Desconectado'),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [version, update] = useState(0),
    [quality, setQuality] = useState<Quality>('auto'),
    [audio, setAudio] = useState(true),
    [screenAudio, setScreenAudio] = useState(false),
    [mic, setMic] = useState(false),
    [sharing, setSharing] = useState(false);
  const capture = useRef<CaptureController | null>(null);
  const room = useRef<Room | null>(null),
    screen = useRef<MediaStream | null>(null),
    mounted = useRef(false),
    generation = useRef(0);
  useEffect(() => {
    mounted.current = true;
    const value = new URLSearchParams(location.search).get('room');
    if (value && /^[A-F0-9]{10}$/.test(value)) setCode(value);
    return () => {
      mounted.current = false;
      generation.current++;
      capture.current?.stop();
      stopStream(screen.current);
      void room.current?.disconnect();
    };
  }, []);
  const refresh = () => {
    if (mounted.current) update((v) => v + 1);
  };
  const action = <T = RoomState,>(name: string, extra: Record<string, unknown> = {}) =>
    requestRoom<T>(name, { code: connection?.code ?? code, ...extra });
  async function connect(actionName: 'create' | 'join') {
    if (busy) return;
    setBusy(true);
    setMessage('');
    const current = ++generation.current;
    try {
      const info = await action<Connection>(actionName, actionName === 'create' ? { code: undefined } : {});
      if (!mounted.current || current !== generation.current) return;
      const instance = new Room({ adaptiveStream: true, dynacast: true });
      room.current = instance;
      for (const event of [
        RoomEvent.TrackSubscribed,
        RoomEvent.TrackUnsubscribed,
        RoomEvent.TrackMuted,
        RoomEvent.TrackUnmuted,
        RoomEvent.ParticipantConnected,
        RoomEvent.ParticipantDisconnected,
        RoomEvent.LocalTrackPublished,
        RoomEvent.LocalTrackUnpublished,
        RoomEvent.ParticipantPermissionsChanged,
      ])
        instance.on(event, refresh);
      instance.on(RoomEvent.LocalTrackUnpublished, (publication) => {
        if (publication.source === Track.Source.ScreenShare) {
          stopStream(screen.current);
          screen.current = null;
          setSharing(false);
          setScreenAudio(false);
        }
        if (publication.source === Track.Source.Microphone) setMic(false);
      });
      instance.on(RoomEvent.RoomMetadataChanged, (metadata) => {
        try {
          const value = JSON.parse(metadata ?? '{}');
          setConnection((old) => (old ? { ...old, host: value.host, locked: value.locked } : old));
        } catch {
          /* Invalid metadata does not change control authority. */
        }
      });
      instance.on(RoomEvent.Reconnecting, () => setStatus('Reconectando…'));
      instance.on(RoomEvent.Reconnected, () => setStatus('Conectado'));
      instance.on(RoomEvent.Disconnected, () => {
        stopStream(screen.current);
        screen.current = null;
        setSharing(false);
        setMic(false);
        setStatus('Desconectado');
        refresh();
      });
      await instance.connect(info.url, info.token);
      if (!mounted.current || current !== generation.current) {
        await instance.disconnect();
        return;
      }
      setConnection(info);
      setCode(info.code);
      setStatus('Conectado');
      refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Não foi possível conectar.');
      await room.current?.disconnect();
      room.current = null;
    } finally {
      setBusy(false);
    }
  }
  async function stopShare(stopCapture = true) {
    if (stopCapture) capture.current?.stop();
    const instance = room.current;
    const stream = screen.current;
    screen.current = null;
    stopStream(stream);
    if (instance && stream)
      for (const track of stream.getTracks()) await instance.localParticipant.unpublishTrack(track);
    setSharing(false);
    setScreenAudio(false);
    refresh();
  }
  async function share() {
    if (busy || !room.current) return;
    setBusy(true);
    setMessage('');
    const current = generation.current;
    let stream: MediaStream | null = null;
    try {
      capture.current ??= new CaptureController(navigator.mediaDevices, () => {});
      await capture.current.start(quality, audio);
      stream = capture.current.stream;
      if (!stream) throw Error('Captura encerrada.');
      if (!mounted.current || current !== generation.current) {
        stopStream(stream);
        return;
      }
      await stopShare(false);
      screen.current = stream;
      const instance = room.current;
      if (!instance) throw Error('Sala desconectada.');
      for (const track of stream.getTracks())
        await instance.localParticipant.publishTrack(track, {
          source: track.kind === 'video' ? Track.Source.ScreenShare : Track.Source.ScreenShareAudio,
          simulcast: track.kind === 'video',
          screenShareEncoding: {
            maxBitrate: quality.startsWith('1080') ? 8000000 : 4000000,
            maxFramerate: qualityPresets[quality].fps,
          },
        });
      stream.getVideoTracks()[0]?.addEventListener(
        'ended',
        () => {
          void stopShare();
        },
        { once: true },
      );
      stream.getAudioTracks().forEach((t) => t.addEventListener('ended', () => setScreenAudio(false), { once: true }));
      setSharing(true);
      setScreenAudio(stream.getAudioTracks().some((t) => t.readyState === 'live'));
      refresh();
    } catch {
      stopStream(stream);
      setMessage('A captura foi cancelada ou não pôde ser publicada. Selecione uma fonte novamente.');
    } finally {
      setBusy(false);
    }
  }
  async function toggleMic() {
    try {
      const enabled = !mic;
      await room.current?.localParticipant.setMicrophoneEnabled(enabled);
      setMic(enabled);
      refresh();
    } catch {
      setMessage('O microfone não foi permitido.');
    }
  }
  async function control(name: string, extra: Record<string, unknown> = {}) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await action(name, extra);
      if (name === 'end' || name === 'leave') {
        generation.current++;
        await stopShare();
        await room.current?.disconnect();
        room.current = null;
        setConnection(null);
        setStatus('Desconectado');
      } else setConnection((old) => (old ? { ...old, host: result.host, locked: result.locked } : old));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ação indisponível.');
    } finally {
      setBusy(false);
    }
  }
  const instance = room.current,
    participants: Participant[] = instance ? [instance.localParticipant, ...instance.remoteParticipants.values()] : [],
    host = !!connection && !!instance && connection.host === instance.localParticipant.identity;
  void version;
  return (
    <div className="screen-layout">
      <aside className="screen-sidebar">
        <span className="admin-kicker">SUBÚRBIO / TELA</span>
        <h2>Compartilhar tela</h2>
        <p role="status">{status}</p>
        {!connection ? (
          <>
            <button className="button" disabled={busy} onClick={() => connect('create')}>
              Criar sala
            </button>
            <label>
              Código da sala
              <input value={code} maxLength={10} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            </label>
            <button
              className="button outline"
              disabled={busy || !/^[A-F0-9]{10}$/.test(code)}
              onClick={() => connect('join')}
            >
              Entrar na sala
            </button>
          </>
        ) : (
          <>
            <p>
              Código: <strong>{connection.code}</strong>
            </p>
            <button
              onClick={() =>
                navigator.clipboard.writeText(connection.code).catch(() => setMessage('Copie o código exibido.'))
              }
            >
              Copiar código
            </button>
            <button
              onClick={() =>
                navigator.clipboard
                  .writeText(location.origin + '/tela?room=' + connection.code)
                  .catch(() => setMessage('Não foi possível copiar o link.'))
              }
            >
              Copiar link
            </button>
            <button className="button outline" disabled={busy} onClick={() => control('leave')}>
              Sair da sala
            </button>
          </>
        )}
        {message && <p role="alert">{message}</p>}
        <h3>Participantes ({connection ? participants.length : 0})</h3>
        {participants.map((p) => (
          <div key={p.identity}>
            <p>
              {p.name || 'Cidadão'}
              {connection?.host === p.identity ? ' · Anfitrião' : ''}
            </p>
            {host && p !== instance?.localParticipant && (
              <>
                <button
                  disabled={busy}
                  onClick={() => control('share', { target: p.identity, enabled: !p.permissions?.canPublish })}
                >
                  {p.permissions?.canPublish ? 'Bloquear transmissão' : 'Permitir transmissão'}
                </button>
                <button disabled={busy} onClick={() => control('transfer', { target: p.identity })}>
                  Tornar anfitrião
                </button>
                <button disabled={busy} onClick={() => control('kick', { target: p.identity })}>
                  Remover
                </button>
              </>
            )}
          </div>
        ))}
        {host && (
          <fieldset disabled={busy}>
            <legend>Controles do host</legend>
            <button onClick={() => control('lock', { enabled: !connection?.locked })}>
              {connection?.locked ? 'Abrir entradas' : 'Bloquear entradas'}
            </button>
            <button onClick={() => control('end')}>Encerrar sala</button>
          </fieldset>
        )}
      </aside>
      <section className="screen-main">
        <h1>Compartilhamento de tela</h1>
        <p>{sharing ? 'Transmitindo' : 'Nenhuma tela sua sendo transmitida'}</p>
        <div className="screen-controls">
          <label>
            Qualidade
            <select value={quality} disabled={busy} onChange={(e) => setQuality(e.target.value as Quality)}>
              {Object.entries(qualityPresets).map(([key, preset]) => (
                <option key={key} value={key}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <input type="checkbox" checked={audio} onChange={(e) => setAudio(e.target.checked)} /> Solicitar áudio da
            tela
          </label>
          <button
            className="button"
            disabled={busy || status !== 'Conectado' || !instance?.localParticipant.permissions?.canPublish}
            onClick={share}
          >
            {sharing ? 'Trocar compartilhamento' : 'Compartilhar tela'}
          </button>
          <button disabled={!sharing || busy} onClick={() => void stopShare()}>
            Parar compartilhamento
          </button>
          <button
            disabled={status !== 'Conectado' || !instance?.localParticipant.permissions?.canPublish}
            onClick={toggleMic}
          >
            {mic ? 'Desligar microfone' : 'Ligar microfone'}
          </button>
        </div>
        <p>
          Áudio da tela: {screenAudio ? 'capturado' : 'não capturado'}. Microfone: {mic ? 'ligado' : 'desligado'}.
        </p>
        <p>
          A seleção de aba, janela ou monitor é feita pelo navegador. A qualidade escolhida será solicitada na próxima
          captura.
        </p>
        <button disabled={!connection} onClick={() => void instance?.startAudio()}>
          Ativar áudio recebido
        </button>
        <div className="screen-stage">
          {participants.flatMap((p) =>
            [...p.trackPublications.values()]
              .filter((publication) => publication.track && !publication.isMuted)
              .map((publication) => (
                <div key={publication.trackSid}>
                  <p>
                    {p.name || 'Cidadão'} ·{' '}
                    {publication.source === Track.Source.Microphone
                      ? 'Microfone'
                      : publication.source === Track.Source.ScreenShareAudio
                        ? 'Áudio da tela'
                        : 'Tela'}
                  </p>
                  <Media track={publication.track!} />
                </div>
              )),
          )}
        </div>
      </section>
    </div>
  );
}
