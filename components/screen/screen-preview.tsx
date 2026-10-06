'use client';
import { useEffect, useRef, useState } from 'react';
import { DisconnectReason, Room, RoomEvent, Track, type Participant } from 'livekit-client';
import { CaptureController, qualityPresets, screenPublishOptions, stopStream, type Quality } from '@/lib/screen/media';
import { requestRoom, RoomRequestError, type RoomConnection, type RoomState } from '@/lib/screen/room-client';

type Phase =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error'
  | 'full'
  | 'denied'
  | 'removed'
  | 'ended'
  | 'unavailable';
const LABEL: Record<Phase, string> = {
  idle: 'Desconectado',
  connecting: 'Conectando…',
  connected: 'Conectado',
  reconnecting: 'Reconectando…',
  disconnected: 'Desconectado',
  error: 'Conexão perdida',
  full: 'Sala cheia',
  denied: 'Acesso negado',
  removed: 'Você foi removido da sala',
  ended: 'Transmissão encerrada',
  unavailable: 'Serviço indisponível',
};
// Estados sem sala ativa que mostram um aviso no palco.
const NOTICE: Partial<Record<Phase, string>> = {
  full: 'Todas as vagas desta sala estão ocupadas. Tente novamente quando alguém sair.',
  denied: 'Você não tem acesso a esta sala.',
  removed: 'O anfitrião removeu você desta sala.',
  ended: 'O anfitrião encerrou esta transmissão.',
  unavailable: 'O servidor de transmissão não respondeu. Tente novamente em instantes.',
  error: 'A conexão com a sala caiu e não foi possível retomá-la.',
};
const RETRY_DELAYS_MS = [2_000, 5_000, 10_000];
const SESSION_KEY = 'suburbio:tela:sala';
const CODE = /^[A-F0-9]{10}$/;
type Meta = { host: string; locked: boolean; capacity: number; presenters: string[]; silenced: string[] };

function parseMeta(raw: string | undefined, fallback: RoomState): Meta {
  const base = {
    host: fallback.host,
    locked: fallback.locked,
    capacity: fallback.capacity,
    presenters: [],
    silenced: [],
  };
  try {
    const value = JSON.parse(raw || '{}');
    return {
      host: typeof value.host === 'string' ? value.host : base.host,
      locked: typeof value.locked === 'boolean' ? value.locked : base.locked,
      capacity: typeof value.capacity === 'number' ? value.capacity : base.capacity,
      presenters: Array.isArray(value.presenters) ? value.presenters.filter((v: unknown) => typeof v === 'string') : [],
      silenced: Array.isArray(value.silenced) ? value.silenced.filter((v: unknown) => typeof v === 'string') : [],
    };
  } catch {
    // Metadados inválidos não mudam autoridade: o servidor é quem aplica as permissões.
    return base;
  }
}
const canPresent = (meta: Meta | null, id: string) =>
  !!meta && (meta.host === id || meta.presenters.includes(id)) && !meta.silenced.includes(id);
const canSpeak = (meta: Meta | null, id: string) => !!meta && !meta.silenced.includes(id);
function phaseFor(error: unknown): Phase {
  if (!(error instanceof RoomRequestError)) return 'unavailable';
  if (error.code === 'ROOM_FULL') return 'full';
  if (error.code === 'ROOM_NOT_FOUND') return 'ended';
  if (['ROOM_LOCKED', 'SESSION_REQUIRED', 'INVALID_ORIGIN'].includes(error.code)) return 'denied';
  if (['RATE_LIMITED', 'INVALID_INPUT'].includes(error.code)) return 'idle';
  return 'unavailable';
}
const remember = (code: string | null) => {
  try {
    if (code) sessionStorage.setItem(SESSION_KEY, code);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* Armazenamento indisponível: só perde a reentrada automática após reload. */
  }
};

function Media({ track, muted }: { track: Track; muted: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const element = useRef<HTMLMediaElement | null>(null);
  useEffect(() => {
    const node = track.attach();
    node.autoplay = true;
    if (node instanceof HTMLVideoElement) {
      node.playsInline = true;
      node.style.width = '100%';
    }
    element.current = node;
    ref.current?.appendChild(node);
    return () => {
      track.detach(node);
      node.remove();
      element.current = null;
    };
  }, [track]);
  useEffect(() => {
    if (element.current) element.current.muted = track.isLocal || muted;
  }, [track, muted]);
  return <div ref={ref} />;
}

export function ScreenPreview({ maxCapacity = 10 }: { maxCapacity?: number }) {
  const [connection, setConnection] = useState<RoomConnection | null>(null),
    [meta, setMeta] = useState<Meta | null>(null),
    [code, setCode] = useState(''),
    [capacity, setCapacity] = useState(maxCapacity),
    [phase, setPhase] = useState<Phase>('idle'),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [version, update] = useState(0),
    [quality, setQuality] = useState<Quality>('auto'),
    [audio, setAudio] = useState(true),
    [screenAudio, setScreenAudio] = useState(false),
    [mic, setMic] = useState(false),
    [mics, setMics] = useState<MediaDeviceInfo[]>([]),
    [micId, setMicId] = useState(''),
    [incomingMuted, setIncomingMuted] = useState(false),
    [sharing, setSharing] = useState(false);
  const capture = useRef<CaptureController | null>(null),
    room = useRef<Room | null>(null),
    screen = useRef<MediaStream | null>(null),
    mounted = useRef(false),
    generation = useRef(0),
    retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    retries = useRef(0),
    shareInFlight = useRef(false),
    lastCode = useRef('');

  const refresh = () => {
    if (mounted.current) update((v) => v + 1);
  };
  const clearRetry = () => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = null;
  };
  // Encerra a mídia local: tela, áudio da tela e microfone. Não toca no servidor.
  function releaseMedia() {
    capture.current?.stop();
    stopStream(screen.current);
    screen.current = null;
    if (mounted.current) {
      setSharing(false);
      setScreenAudio(false);
      setMic(false);
    }
  }
  // Desconecta a sala atual sem disparar os handlers dela (sem listeners duplicados em reconexões).
  async function teardown() {
    const instance = room.current;
    room.current = null;
    releaseMedia();
    if (instance) {
      instance.removeAllListeners();
      await instance.disconnect().catch(() => {});
    }
  }

  useEffect(() => {
    mounted.current = true;
    const query = new URLSearchParams(location.search).get('room');
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(SESSION_KEY);
    } catch {
      saved = null;
    }
    if (query && CODE.test(query)) setCode(query);
    // Reload da aba que estava numa sala: volta para a mesma sala com a mesma identity.
    if (saved && CODE.test(saved) && (!query || query === saved)) void connect('join', saved);
    return () => {
      mounted.current = false;
      generation.current++;
      clearRetry();
      void teardown();
    };
    // Só na montagem: reexecutar repetiria a reentrada automática.
  }, []);

  function scheduleRetry(roomCode: string) {
    clearRetry();
    if (retries.current >= RETRY_DELAYS_MS.length) {
      setPhase('error');
      return;
    }
    setPhase('reconnecting');
    const delay = RETRY_DELAYS_MS[retries.current++];
    retryTimer.current = setTimeout(() => void connect('join', roomCode, true), delay);
  }

  function bind(instance: Room, info: RoomConnection) {
    const own = () => instance === room.current;
    for (const event of [
      RoomEvent.TrackSubscribed,
      RoomEvent.TrackUnsubscribed,
      RoomEvent.TrackMuted,
      RoomEvent.TrackUnmuted,
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
      RoomEvent.LocalTrackPublished,
      RoomEvent.ParticipantPermissionsChanged,
    ])
      instance.on(event, refresh);
    instance.on(RoomEvent.LocalTrackUnpublished, (publication) => {
      if (publication.source === Track.Source.ScreenShare) {
        capture.current?.stop();
        stopStream(screen.current);
        screen.current = null;
        setSharing(false);
        setScreenAudio(false);
      }
      if (publication.source === Track.Source.Microphone) setMic(false);
      refresh();
    });
    instance.on(RoomEvent.RoomMetadataChanged, (raw) => {
      const next = parseMeta(raw, info);
      setMeta(next);
      const self = instance.localParticipant.identity;
      // Permissão revogada pelo anfitrião: o servidor já silenciou; aqui só limpa a mídia local.
      if (!canPresent(next, self) && screen.current) void stopShare();
      if (!canSpeak(next, self)) setMic(false);
    });
    instance.on(RoomEvent.MediaDevicesChanged, () => void loadMics());
    instance.on(RoomEvent.Reconnecting, () => own() && setPhase('reconnecting'));
    instance.on(RoomEvent.Reconnected, () => own() && setPhase('connected'));
    instance.on(RoomEvent.Disconnected, (reason) => {
      if (!own()) return;
      room.current = null;
      instance.removeAllListeners();
      releaseMedia();
      setConnection(null);
      refresh();
      if (reason === DisconnectReason.CLIENT_INITIATED) return setPhase('idle');
      if (reason === DisconnectReason.ROOM_DELETED) {
        remember(null);
        return setPhase('ended');
      }
      if (reason === DisconnectReason.PARTICIPANT_REMOVED) {
        remember(null);
        return setPhase('removed');
      }
      if (reason === DisconnectReason.DUPLICATE_IDENTITY) {
        setMessage('Sua conta entrou nesta sala em outra aba ou dispositivo.');
        return setPhase('disconnected');
      }
      // Queda de rede/servidor: retoma com novas tentativas espaçadas (sem loop agressivo).
      scheduleRetry(info.code);
    });
  }

  async function connect(kind: 'create' | 'join', target = code, retry = false) {
    if (busy && !retry) return;
    clearRetry();
    if (!retry) retries.current = 0;
    setBusy(true);
    setMessage('');
    setPhase(retry ? 'reconnecting' : 'connecting');
    const current = ++generation.current;
    try {
      const info = await requestRoom<RoomConnection>(kind, kind === 'create' ? { capacity } : { code: target });
      if (!mounted.current || current !== generation.current) return;
      await teardown();
      const instance = new Room({ adaptiveStream: true, dynacast: true, disconnectOnPageLeave: true });
      room.current = instance;
      bind(instance, info);
      await instance.connect(info.url, info.token);
      if (!mounted.current || current !== generation.current) {
        instance.removeAllListeners();
        await instance.disconnect();
        return;
      }
      retries.current = 0;
      lastCode.current = info.code;
      remember(info.code);
      history.replaceState(null, '', '/tela?room=' + info.code);
      setConnection(info);
      setMeta(parseMeta(instance.metadata, info));
      setCode(info.code);
      setPhase('connected');
      refresh();
    } catch (error) {
      if (!mounted.current || current !== generation.current) return;
      await teardown();
      setConnection(null);
      const next = phaseFor(error);
      if (next === 'ended' || next === 'denied') remember(null);
      // Durante uma retomada, falha transitória continua a sequência de tentativas.
      if (retry && next === 'unavailable') return scheduleRetry(target);
      setPhase(next);
      setMessage(
        error instanceof RoomRequestError ? error.message : 'Não foi possível conectar ao servidor de transmissão.',
      );
    } finally {
      if (mounted.current && current === generation.current) setBusy(false);
    }
  }

  async function stopShare(stopCapture = true) {
    if (stopCapture) capture.current?.stop();
    const instance = room.current;
    const stream = screen.current;
    screen.current = null;
    stopStream(stream);
    if (instance && stream)
      for (const track of stream.getTracks()) await instance.localParticipant.unpublishTrack(track).catch(() => {});
    setSharing(false);
    setScreenAudio(false);
    refresh();
  }

  async function share() {
    const instance = room.current;
    // Uma publicação por vez: cliques repetidos não publicam a mesma tela duas vezes.
    if (busy || !instance || shareInFlight.current) return;
    if (!canPresent(meta, instance.localParticipant.identity))
      return setMessage('O anfitrião precisa permitir sua transmissão.');
    shareInFlight.current = true;
    setBusy(true);
    setMessage('');
    const current = generation.current;
    let stream: MediaStream | null = null;
    try {
      // O controller é a única fonte dos eventos da captura (fim pelo navegador, áudio da tela).
      capture.current ??= new CaptureController(navigator.mediaDevices, (state, captured) => {
        if (state === 'ended') void stopShare(false);
        else if (captured) setScreenAudio(captured.getAudioTracks().some((t) => t.readyState === 'live'));
      });
      await capture.current.start(quality, audio);
      stream = capture.current.stream;
      if (!stream) throw Error('Captura encerrada.');
      if (!mounted.current || current !== generation.current || room.current !== instance) {
        stopStream(stream);
        return;
      }
      await stopShare(false);
      screen.current = stream;
      for (const track of stream.getTracks())
        await instance.localParticipant.publishTrack(track, screenPublishOptions(quality, track.kind));
      setSharing(true);
      setScreenAudio(stream.getAudioTracks().some((t) => t.readyState === 'live'));
      refresh();
    } catch (error) {
      if (stream && screen.current !== stream) stopStream(stream);
      else if (stream) await stopShare();
      const name = error instanceof Error ? error.name : '';
      setMessage(
        name === 'NotAllowedError'
          ? 'Permissão de captura negada. Escolha uma tela, janela ou aba para compartilhar.'
          : name === 'NotFoundError' || (error instanceof Error && error.message === 'NO_VIDEO')
            ? 'Nenhuma fonte de vídeo disponível para captura.'
            : 'A captura foi cancelada ou não pôde ser publicada. Selecione uma fonte novamente.',
      );
    } finally {
      shareInFlight.current = false;
      setBusy(false);
    }
  }

  async function loadMics() {
    try {
      const devices = await Room.getLocalDevices('audioinput', false);
      if (mounted.current) setMics(devices.filter((d) => d.deviceId));
    } catch {
      if (mounted.current) setMics([]);
    }
  }
  async function toggleMic() {
    const instance = room.current;
    if (!instance) return;
    try {
      const enabled = !mic;
      await instance.localParticipant.setMicrophoneEnabled(enabled, micId ? { deviceId: micId } : undefined);
      setMic(enabled);
      if (enabled) void loadMics();
      refresh();
    } catch {
      setMessage('O microfone não foi permitido ou não está disponível.');
    }
  }
  async function changeMic(id: string) {
    setMicId(id);
    if (mic && room.current) await room.current.switchActiveDevice('audioinput', id).catch(() => {});
  }

  async function control(name: string, extra: Record<string, unknown> = {}) {
    if (busy || !connection) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await requestRoom<RoomState>(name, { code: connection.code, ...extra });
      if (name === 'end' || name === 'leave') {
        generation.current++;
        clearRetry();
        remember(null);
        await teardown();
        setConnection(null);
        setMeta(null);
        setPhase(name === 'end' ? 'ended' : 'idle');
      } else setConnection((old) => (old ? { ...old, ...result } : old));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Ação indisponível.');
    } finally {
      setBusy(false);
    }
  }

  const instance = room.current,
    participants: Participant[] = instance ? [instance.localParticipant, ...instance.remoteParticipants.values()] : [],
    self = instance?.localParticipant.identity ?? '',
    host = !!meta && meta.host === self,
    presenter = canPresent(meta, self),
    speaker = canSpeak(meta, self),
    online = phase === 'connected' && !!instance,
    tracks = participants.flatMap((p) =>
      [...p.trackPublications.values()]
        .filter((publication) => publication.track && !publication.isMuted)
        .map((publication) => ({ participant: p, publication })),
    ),
    remoteScreen = tracks.some(
      ({ participant, publication }) =>
        participant !== instance?.localParticipant && publication.source === Track.Source.ScreenShare,
    ),
    capacities = [...new Set([2, 4, 6, 8, 10, 15, 20, 30, 40, 50].filter((n) => n <= maxCapacity).concat(maxCapacity))];
  void version;
  const notice = !connection ? NOTICE[phase] : undefined;
  return (
    <div className="screen-layout">
      <aside className="screen-sidebar">
        <span className="admin-kicker">SUBÚRBIO / TELA</span>
        <h2>{connection?.title ?? 'Compartilhar tela'}</h2>
        <p role="status">{LABEL[phase]}</p>
        {!connection ? (
          <>
            <label>
              Vagas na sala
              <select value={capacity} disabled={busy} onChange={(e) => setCapacity(Number(e.target.value))}>
                {capacities.map((n) => (
                  <option key={n} value={n}>
                    {n} participantes
                  </option>
                ))}
              </select>
            </label>
            <button className="button" disabled={busy} onClick={() => connect('create')}>
              Criar sala
            </button>
            <label>
              Código da sala
              <input value={code} maxLength={10} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            </label>
            <button className="button outline" disabled={busy || !CODE.test(code)} onClick={() => connect('join')}>
              Entrar na sala
            </button>
          </>
        ) : (
          <>
            <p>
              Código: <strong>{connection.code}</strong> · {participants.length}/{meta?.capacity ?? connection.capacity}{' '}
              vagas
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
        {participants.map((p) => {
          const id = p.identity,
            isPresenter = canPresent(meta, id) && meta?.host !== id,
            isSilenced = !!meta?.silenced.includes(id);
          return (
            <div key={id}>
              <p>
                {p.name || 'Cidadão'}
                {meta?.host === id ? ' · Anfitrião' : isPresenter ? ' · Apresentador' : ''}
                {isSilenced ? ' · Silenciado' : ''}
              </p>
              {host && p !== instance?.localParticipant && (
                <>
                  <button disabled={busy} onClick={() => control('share', { target: id, enabled: !isPresenter })}>
                    {isPresenter ? 'Bloquear transmissão' : 'Permitir transmissão'}
                  </button>
                  <button disabled={busy} onClick={() => control('silence', { target: id, enabled: !isSilenced })}>
                    {isSilenced ? 'Liberar áudio' : 'Silenciar participante'}
                  </button>
                  <button disabled={busy} onClick={() => control('transfer', { target: id })}>
                    Tornar anfitrião
                  </button>
                  <button disabled={busy} onClick={() => control('kick', { target: id })}>
                    Remover
                  </button>
                </>
              )}
            </div>
          );
        })}
        {host && (
          <fieldset disabled={busy}>
            <legend>Controles do host</legend>
            <button onClick={() => control('lock', { enabled: !meta?.locked })}>
              {meta?.locked ? 'Abrir entradas' : 'Bloquear entradas'}
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
          <button className="button" disabled={busy || !online || !presenter} onClick={share}>
            {sharing ? 'Trocar compartilhamento' : 'Compartilhar tela'}
          </button>
          <button disabled={!sharing || busy} onClick={() => void stopShare()}>
            Parar compartilhamento
          </button>
          <button disabled={!online || !speaker} onClick={toggleMic}>
            {mic ? 'Desligar microfone' : 'Ligar microfone'}
          </button>
          {mics.length > 1 && (
            <label>
              Microfone
              <select value={micId} onChange={(e) => void changeMic(e.target.value)}>
                <option value="">Padrão do sistema</option>
                {mics.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || 'Microfone'}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <p>
          Áudio da tela: {screenAudio ? 'capturado' : 'não capturado'}. Microfone: {mic ? 'ligado' : 'desligado'}.
          {online && !presenter && ' O anfitrião precisa permitir sua transmissão de tela.'}
        </p>
        <p>
          A seleção de aba, janela ou monitor é feita pelo navegador. A qualidade escolhida será solicitada na próxima
          captura.
        </p>
        <button disabled={!connection} onClick={() => void instance?.startAudio()}>
          Ativar áudio recebido
        </button>
        <button disabled={!connection} onClick={() => setIncomingMuted((v) => !v)}>
          {incomingMuted ? 'Ouvir áudio recebido' : 'Silenciar áudio recebido'}
        </button>
        <div className="screen-stage">
          {phase === 'reconnecting' && <span className="screen-badge">RECONECTANDO</span>}
          {phase === 'connected' && (sharing || remoteScreen) && (
            <span className="screen-badge">{sharing ? 'SUA TELA AO VIVO' : 'AO VIVO'}</span>
          )}
          {notice ? (
            <div className="screen-empty" role="status">
              <h2>{LABEL[phase]}</h2>
              <p>{notice}</p>
              {['unavailable', 'error', 'full'].includes(phase) && lastCode.current && (
                <button className="button" disabled={busy} onClick={() => connect('join', lastCode.current)}>
                  Tentar novamente
                </button>
              )}
            </div>
          ) : connection && !tracks.some(({ publication }) => publication.kind === Track.Kind.Video) ? (
            <div className="screen-empty" role="status">
              <h2>{phase === 'connecting' ? 'Conectando…' : 'Aguardando transmissão'}</h2>
              <p>Nenhuma tela está sendo compartilhada nesta sala.</p>
            </div>
          ) : null}
          {tracks.map(({ participant, publication }) => (
            <div key={publication.trackSid}>
              <p>
                {participant.name || 'Cidadão'} ·{' '}
                {publication.source === Track.Source.Microphone
                  ? 'Microfone'
                  : publication.source === Track.Source.ScreenShareAudio
                    ? 'Áudio da tela'
                    : 'Tela'}
              </p>
              <Media track={publication.track!} muted={incomingMuted} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
