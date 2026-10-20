'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DisconnectReason, Room, RoomEvent, Track, type Participant } from 'livekit-client';
import { CaptureController, qualityPresets, screenPublishOptions, stopStream, type Quality } from '@/lib/screen/media';
import {
  CATEGORY_LABEL,
  elapsed,
  fetchBroadcasts,
  requestRoom,
  RoomRequestError,
  type Broadcasts,
  type BroadcastCard,
  type Category,
  type RoomConnection,
  type RoomState,
  type Visibility,
} from '@/lib/screen/room-client';

// Estados da conexão. Dentro da sala, "ao vivo / pausado / transmissor ausente" são derivados das trilhas.
type Phase =
  | 'idle'
  | 'preparing'
  | 'capturing'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'
  | 'full'
  | 'denied'
  | 'invite'
  | 'removed'
  | 'ended'
  | 'unavailable';
const NOTICE: Partial<Record<Phase, { title: string; text: string }>> = {
  full: { title: 'Transmissão lotada', text: 'Todas as vagas estão ocupadas. Tente novamente quando alguém sair.' },
  denied: { title: 'Sem autorização', text: 'Você não tem acesso a esta transmissão.' },
  invite: {
    title: 'Transmissão privada',
    text: 'Esta transmissão é privada. Peça o link de convite a quem está transmitindo.',
  },
  removed: { title: 'Você foi removido', text: 'Quem está transmitindo removeu você desta transmissão.' },
  ended: { title: 'Transmissão encerrada', text: 'Esta transmissão foi encerrada.' },
  unavailable: {
    title: 'Transmissão indisponível',
    text: 'O servidor de transmissão não respondeu. Tente novamente em instantes.',
  },
  error: { title: 'Conexão perdida', text: 'A conexão caiu e não foi possível retomá-la.' },
};
const RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 20_000];
const LIST_REFRESH_MS = 15_000;
const SESSION_KEY = 'suburbio:tela:sala';
const CODE = /^[A-F0-9]{10}$/;
const INVITE = /^[a-f0-9]{32}$/;
type Meta = {
  host: string;
  hostName: string;
  hostAvatar: string | null;
  title: string;
  startedAt: number | null;
  locked: boolean;
  capacity: number;
  presenters: string[];
  silenced: string[];
};

function parseMeta(raw: string | undefined, fallback: RoomState): Meta {
  const base: Meta = {
    host: fallback.host,
    hostName: fallback.hostName,
    hostAvatar: fallback.hostAvatar,
    title: fallback.title,
    startedAt: fallback.startedAt,
    locked: fallback.locked,
    capacity: fallback.capacity,
    presenters: [],
    silenced: [],
  };
  try {
    const v = JSON.parse(raw || '{}');
    const list = (x: unknown) => (Array.isArray(x) ? x.filter((i: unknown): i is string => typeof i === 'string') : []);
    return {
      host: typeof v.host === 'string' ? v.host : base.host,
      hostName: typeof v.hostName === 'string' ? v.hostName : base.hostName,
      hostAvatar: typeof v.hostAvatar === 'string' ? v.hostAvatar : base.hostAvatar,
      title: typeof v.title === 'string' ? v.title : base.title,
      startedAt: typeof v.startedAt === 'number' ? v.startedAt : base.startedAt,
      locked: typeof v.locked === 'boolean' ? v.locked : base.locked,
      capacity: typeof v.capacity === 'number' ? v.capacity : base.capacity,
      presenters: list(v.presenters),
      silenced: list(v.silenced),
    };
  } catch {
    // Metadados inválidos não mudam autoridade: o servidor é quem aplica as permissões.
    return base;
  }
}
const canPresent = (meta: Meta | null, id: string) =>
  !!meta && (meta.host === id || meta.presenters.includes(id)) && !meta.silenced.includes(id);
function phaseFor(error: unknown): Phase {
  if (!(error instanceof RoomRequestError)) return 'unavailable';
  if (error.code === 'ROOM_FULL') return 'full';
  if (error.code === 'ROOM_NOT_FOUND') return 'ended';
  if (error.code === 'ROOM_INVITE_REQUIRED') return 'invite';
  if (['ROOM_LOCKED', 'SESSION_REQUIRED', 'INVALID_ORIGIN'].includes(error.code)) return 'denied';
  if (['RATE_LIMITED', 'INVALID_INPUT', 'ROOM_ACTIVE_EXISTS'].includes(error.code)) return 'idle';
  return 'unavailable';
}
const remember = (value: { code: string; invite?: string } | null) => {
  try {
    if (value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* Armazenamento indisponível: só perde a reentrada automática após reload. */
  }
};
const recall = (): { code: string; invite?: string } | null => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    // Compatível com a versão anterior, que guardava só o código.
    const value = CODE.test(raw) ? { code: raw } : JSON.parse(raw);
    return value && CODE.test(value.code) ? value : null;
  } catch {
    return null;
  }
};
const avatarOf = (p: Participant) => {
  try {
    const v = JSON.parse(p.metadata || '{}').avatar;
    return typeof v === 'string' && v.startsWith('https://cdn.discordapp.com/') ? v : null;
  } catch {
    return null;
  }
};

function Avatar({ src, name, size = 32 }: { src: string | null; name: string; size?: number }) {
  return src ? (
    <img className="tela-avatar" src={src} alt="" width={size} height={size} />
  ) : (
    <span className="tela-avatar tela-avatar-fallback" style={{ width: size, height: size }} aria-hidden>
      {(name || '?').slice(0, 1).toUpperCase()}
    </span>
  );
}
function Eye() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function useClock(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

function Media({ track, muted, volume }: { track: Track; muted: boolean; volume: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const element = useRef<HTMLMediaElement | null>(null);
  useEffect(() => {
    const node = track.attach();
    node.autoplay = true;
    if (node instanceof HTMLVideoElement) {
      node.playsInline = true;
      node.className = 'tela-video';
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
    if (!element.current) return;
    element.current.muted = track.isLocal || muted;
    element.current.volume = volume;
  }, [track, muted, volume]);
  return <div ref={ref} className={track.kind === Track.Kind.Video ? 'tela-media' : 'tela-media-audio'} />;
}

type StartForm = {
  title: string;
  description: string;
  category: Category | '';
  visibility: Visibility;
  quality: Quality;
  audio: boolean;
};

export function ScreenPreview() {
  const [connection, setConnection] = useState<RoomConnection | null>(null),
    [meta, setMeta] = useState<Meta | null>(null),
    [phase, setPhase] = useState<Phase>('idle'),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [version, update] = useState(0),
    [quality, setQuality] = useState<Quality>('auto'),
    [screenAudio, setScreenAudio] = useState(false),
    [mic, setMic] = useState(false),
    [muted, setMuted] = useState(false),
    [volume, setVolume] = useState(1),
    [sharing, setSharing] = useState(false),
    [list, setList] = useState<Broadcasts | null>(null),
    [listError, setListError] = useState(''),
    [starting, setStarting] = useState(false),
    // Rascunho do formulário de início: sobrevive a uma captura cancelada ou negada.
    [draft, setDraft] = useState<StartForm | null>(null),
    [confirmEnd, setConfirmEnd] = useState(false),
    [fullscreen, setFullscreen] = useState(false);
  const capture = useRef<CaptureController | null>(null),
    room = useRef<Room | null>(null),
    screen = useRef<MediaStream | null>(null),
    stage = useRef<HTMLDivElement>(null),
    mounted = useRef(false),
    generation = useRef(0),
    retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    retries = useRef(0),
    shareInFlight = useRef(false),
    last = useRef<{ code: string; invite?: string } | null>(null);

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
  // keepCapture: ao iniciar, a tela já foi escolhida e não pode ser parada antes de publicar.
  async function teardown(keepCapture = false) {
    const instance = room.current;
    room.current = null;
    if (!keepCapture) releaseMedia();
    if (instance) {
      instance.removeAllListeners();
      await instance.disconnect().catch(() => {});
    }
  }

  const loadList = useCallback(async () => {
    try {
      const value = await fetchBroadcasts();
      if (!mounted.current) return;
      setList(value);
      setListError('');
    } catch (error) {
      if (mounted.current)
        setListError(error instanceof RoomRequestError ? error.message : 'Não foi possível carregar as transmissões.');
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const params = new URLSearchParams(location.search);
    const query = params.get('room'),
      invite = params.get('invite') ?? undefined;
    const saved = recall();
    // Reload da aba que estava numa transmissão: volta para a mesma, com a mesma identity.
    if (saved && (!query || query === saved.code)) void connect('join', saved.code, saved.invite);
    else if (query && CODE.test(query)) void connect('join', query, invite && INVITE.test(invite) ? invite : undefined);
    return () => {
      mounted.current = false;
      generation.current++;
      clearRetry();
      void teardown();
    };
    // Só na montagem: reexecutar repetiria a reentrada automática.
  }, []);

  // Central: atualização leve (15s) e ao voltar para a aba; nada de polling por segundo.
  const inRoom = !!connection || ['connecting', 'reconnecting', 'preparing'].includes(phase);
  useEffect(() => {
    if (inRoom) return;
    void loadList();
    const timer = setInterval(() => document.visibilityState === 'visible' && void loadList(), LIST_REFRESH_MS);
    const visible = () => document.visibilityState === 'visible' && void loadList();
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [inRoom, loadList]);

  useEffect(() => {
    const change = () => setFullscreen(document.fullscreenElement === stage.current && !!stage.current);
    document.addEventListener('fullscreenchange', change);
    return () => document.removeEventListener('fullscreenchange', change);
  }, []);

  function scheduleRetry(target: { code: string; invite?: string }) {
    clearRetry();
    if (retries.current >= RETRY_DELAYS_MS.length) {
      setPhase('error');
      return;
    }
    setPhase('reconnecting');
    const delay = RETRY_DELAYS_MS[retries.current++];
    retryTimer.current = setTimeout(() => void connect('join', target.code, target.invite, true), delay);
  }

  function bind(instance: Room, info: RoomConnection, invite?: string) {
    const own = () => instance === room.current;
    for (const event of [
      RoomEvent.TrackSubscribed,
      RoomEvent.TrackUnsubscribed,
      RoomEvent.TrackMuted,
      RoomEvent.TrackUnmuted,
      RoomEvent.TrackPublished,
      RoomEvent.TrackUnpublished,
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
      // Permissão revogada: o servidor já silenciou; aqui só limpa a mídia local.
      if (!canPresent(next, instance.localParticipant.identity) && screen.current) void stopShare();
    });
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
        remember(null);
        setMessage('Sua conta abriu esta transmissão em outra aba ou dispositivo.');
        return setPhase('idle');
      }
      // Queda de rede/servidor: retoma com novas tentativas espaçadas (sem loop agressivo).
      scheduleRetry({ code: info.code, invite });
    });
  }

  async function connect(kind: 'create' | 'join', target = '', invite?: string, retry = false, extra = {}) {
    clearRetry();
    if (!retry) retries.current = 0;
    setBusy(true);
    setMessage('');
    setPhase(retry ? 'reconnecting' : 'connecting');
    const current = ++generation.current;
    try {
      const info = await requestRoom<RoomConnection>(
        kind,
        kind === 'create' ? extra : { code: target, ...(invite ? { invite } : {}) },
      );
      if (!mounted.current || current !== generation.current) return null;
      await teardown(kind === 'create');
      const instance = new Room({ adaptiveStream: true, dynacast: true, disconnectOnPageLeave: true });
      room.current = instance;
      const key = { code: info.code, invite: invite ?? info.invite };
      bind(instance, info, key.invite);
      await instance.connect(info.url, info.token);
      if (!mounted.current || current !== generation.current) {
        instance.removeAllListeners();
        await instance.disconnect();
        return null;
      }
      retries.current = 0;
      last.current = key;
      remember(key);
      history.replaceState(null, '', '/tela?room=' + info.code);
      setConnection(info);
      setMeta(parseMeta(instance.metadata, info));
      setPhase('connected');
      refresh();
      return instance;
    } catch (error) {
      if (!mounted.current || current !== generation.current) return null;
      await teardown();
      setConnection(null);
      const next = phaseFor(error);
      if (['ended', 'denied', 'invite'].includes(next)) remember(null);
      // Durante uma retomada, falha transitória continua a sequência de tentativas.
      if (retry && next === 'unavailable') {
        scheduleRetry({ code: target, invite });
        return null;
      }
      setPhase(next);
      setMessage(
        error instanceof RoomRequestError ? error.message : 'Não foi possível conectar ao servidor de transmissão.',
      );
      if (error instanceof RoomRequestError && error.code === 'ROOM_ACTIVE_EXISTS') void loadList();
      return null;
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

  function captureMessage(error: unknown) {
    const name = error instanceof Error ? error.name : '';
    return name === 'NotAllowedError'
      ? 'Não foi possível acessar sua tela: a permissão foi negada ou a escolha foi cancelada.'
      : name === 'NotFoundError' || (error instanceof Error && error.message === 'NO_VIDEO')
        ? 'Nenhuma tela, janela ou aba disponível para captura.'
        : 'Não foi possível acessar sua tela. Tente selecionar a fonte novamente.';
  }
  // Captura pelo seletor nativo do navegador (monitor, janela ou aba). Precisa do clique do usuário.
  async function captureScreen(q: Quality, withAudio: boolean) {
    capture.current ??= new CaptureController(navigator.mediaDevices, (state, captured) => {
      if (state === 'ended') void stopShare(false);
      else if (captured) setScreenAudio(captured.getAudioTracks().some((t) => t.readyState === 'live'));
    });
    await capture.current.start(q, withAudio);
    const stream = capture.current.stream;
    if (!stream) throw Error('NO_VIDEO');
    return stream;
  }
  async function publish(instance: Room, stream: MediaStream, q: Quality) {
    screen.current = stream;
    for (const track of stream.getTracks())
      await instance.localParticipant.publishTrack(track, screenPublishOptions(q, track.kind));
    setSharing(true);
    setScreenAudio(stream.getAudioTracks().some((t) => t.readyState === 'live'));
    refresh();
    // O servidor confere na LiveKit que a tela está publicada antes de marcar AO VIVO.
    const code = last.current?.code;
    if (code) await requestRoom('live', { code }).catch(() => {});
  }

  /** Iniciar: escolhe a tela (no clique), cria a transmissão, conecta e publica. */
  async function start(form: StartForm) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    setPhase('capturing');
    let stream: MediaStream;
    try {
      stream = await captureScreen(form.quality, form.audio);
    } catch (error) {
      setBusy(false);
      setPhase('idle');
      setMessage(captureMessage(error));
      return;
    }
    setQuality(form.quality);
    setStarting(false);
    setDraft(null);
    setPhase('preparing');
    screen.current = stream;
    const instance = await connect('create', '', undefined, false, {
      title: form.title,
      ...(form.description ? { description: form.description } : {}),
      ...(form.category ? { category: form.category } : {}),
      visibility: form.visibility,
    });
    if (!instance) {
      capture.current?.stop();
      stopStream(stream);
      screen.current = null;
      return;
    }
    try {
      await publish(instance, stream, form.quality);
    } catch {
      await stopShare();
      setMessage('A tela foi capturada, mas não pôde ser enviada. Tente compartilhar de novo.');
    }
  }

  async function share() {
    const instance = room.current;
    // Uma publicação por vez: cliques repetidos não publicam a mesma tela duas vezes.
    if (busy || !instance || shareInFlight.current) return;
    if (!canPresent(meta, instance.localParticipant.identity)) return;
    shareInFlight.current = true;
    setBusy(true);
    setMessage('');
    const current = generation.current;
    let stream: MediaStream | null = null;
    try {
      stream = await captureScreen(quality, true);
      if (!mounted.current || current !== generation.current || room.current !== instance) {
        stopStream(stream);
        return;
      }
      const previous = screen.current;
      screen.current = null;
      if (previous)
        for (const t of previous.getTracks()) await instance.localParticipant.unpublishTrack(t).catch(() => {});
      await publish(instance, stream, quality);
    } catch (error) {
      if (stream && screen.current !== stream) stopStream(stream);
      else if (stream) await stopShare();
      setMessage(captureMessage(error));
    } finally {
      shareInFlight.current = false;
      setBusy(false);
    }
  }

  async function toggleMic() {
    const instance = room.current;
    if (!instance) return;
    try {
      await instance.localParticipant.setMicrophoneEnabled(!mic);
      setMic(!mic);
      refresh();
    } catch {
      setMessage('O microfone não foi permitido ou não está disponível.');
    }
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
        setConfirmEnd(false);
        setPhase(name === 'end' ? 'ended' : 'idle');
        if (name === 'leave') history.replaceState(null, '', '/tela');
      } else setConnection((old) => (old ? { ...old, ...result } : old));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Ação indisponível.');
    } finally {
      setBusy(false);
    }
  }
  async function endFromCenter(code: string) {
    if (busy) return;
    setBusy(true);
    try {
      await requestRoom('end', { code });
      remember(null);
      setMessage('Transmissão encerrada.');
      await loadList();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Ação indisponível.');
    } finally {
      setBusy(false);
    }
  }
  function backToCenter() {
    clearRetry();
    remember(null);
    setPhase('idle');
    setMessage('');
    history.replaceState(null, '', '/tela');
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stage.current?.requestFullscreen();
    } catch {
      setMessage('Tela cheia indisponível neste navegador.');
    }
  }
  async function pictureInPicture() {
    const video = stage.current?.querySelector('video');
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else if (video) await video.requestPictureInPicture();
    } catch {
      setMessage('Janela flutuante indisponível neste navegador.');
    }
  }

  const instance = room.current,
    self = instance?.localParticipant.identity ?? '',
    isHost = !!meta && meta.host === self,
    remote = instance ? [...instance.remoteParticipants.values()] : [],
    hostParticipant = isHost ? instance?.localParticipant : remote.find((p) => p.identity === meta?.host),
    viewers: Participant[] = isHost
      ? remote
      : [...remote.filter((p) => p.identity !== meta?.host), ...(instance ? [instance.localParticipant] : [])],
    screenTrack = hostParticipant
      ? [...hostParticipant.trackPublications.values()].find(
          (p) => p.source === Track.Source.ScreenShare && p.track && !p.isMuted,
        )
      : undefined,
    audioTracks = remote.flatMap((p) =>
      [...p.trackPublications.values()].filter((pub) => pub.track && !pub.isMuted && pub.kind === Track.Kind.Audio),
    ),
    live = phase === 'connected' && !!screenTrack,
    // Só conta como queda se já esteve ao vivo; antes disso a transmissão ainda vai começar.
    hostAway = phase === 'connected' && !isHost && !!meta?.startedAt && !hostParticipant,
    supportsPip =
      typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled;
  const now = useClock(!!connection && !!meta?.startedAt);
  void version;

  // ---------------------------------------------------------------- Central
  // Enquanto o seletor de tela do navegador está aberto, a central (e o diálogo) continuam na tela.
  if (!connection && !['connecting', 'reconnecting', 'preparing'].includes(phase)) {
    const notice = NOTICE[phase];
    return (
      <div className="tela-center">
        <header className="tela-head">
          <div>
            <span className="admin-kicker">SUBÚRBIO / TELA</span>
            <h1>Transmissões</h1>
            <p>Compartilhe sua tela com a cidade ou assista quem está ao vivo agora.</p>
          </div>
          {!list?.mine && (
            <button className="button" disabled={busy} onClick={() => setStarting(true)}>
              Iniciar transmissão
            </button>
          )}
        </header>
        {notice && (
          <div className="tela-notice" role="status">
            <strong>{notice.title}</strong>
            <p>{phase === 'unavailable' && message ? message : notice.text}</p>
            <div>
              {['unavailable', 'error', 'full'].includes(phase) && last.current && (
                <button
                  className="button small"
                  disabled={busy}
                  onClick={() => connect('join', last.current!.code, last.current!.invite)}
                >
                  Tentar novamente
                </button>
              )}
              <button className="button small outline" onClick={backToCenter}>
                Ver transmissões
              </button>
            </div>
          </div>
        )}
        {message && !notice && !starting && (
          <p className="tela-message" role="alert">
            {message}
          </p>
        )}
        {list?.mine && (
          <section className="tela-mine" aria-label="Sua transmissão">
            <BroadcastTile card={list.mine} now={Date.now()} own />
            <div className="tela-mine-actions">
              <p>
                {list.mine.status === 'live'
                  ? 'Sua transmissão está ao vivo.'
                  : list.mine.hostConnected
                    ? 'Sua transmissão está aberta, sem tela compartilhada.'
                    : 'Sua transmissão está aberta e aguardando você voltar.'}
              </p>
              <button
                className="button"
                disabled={busy}
                onClick={() => connect('join', list.mine!.code, list.mine!.invite)}
              >
                Voltar para a transmissão
              </button>
              <button className="button outline" disabled={busy} onClick={() => endFromCenter(list.mine!.code)}>
                Encerrar
              </button>
            </div>
          </section>
        )}
        <section aria-labelledby="tela-live">
          <h2 id="tela-live">
            Ao vivo agora {list && list.live.length > 0 && <span className="tela-count">{list.live.length}</span>}
          </h2>
          {listError && <p className="tela-message">{listError}</p>}
          {!list && !listError ? (
            <p className="tela-muted">Carregando transmissões…</p>
          ) : list && list.live.length === 0 ? (
            <div className="tela-empty">
              <strong>Ninguém está transmitindo agora.</strong>
              <p>Quando alguém entrar ao vivo, a transmissão aparece aqui.</p>
            </div>
          ) : (
            <div className="tela-grid">
              {list?.live.map((card) => (
                <BroadcastTile
                  key={card.code}
                  card={card}
                  now={Date.now()}
                  onWatch={() => connect('join', card.code)}
                  disabled={busy}
                />
              ))}
            </div>
          )}
        </section>
        {list && list.ended.length > 0 && (
          <section aria-labelledby="tela-ended">
            <h2 id="tela-ended">Encerradas recentemente</h2>
            <ul className="tela-history">
              {list.ended.map((e) => (
                <li key={e.code + e.endedAt}>
                  <Avatar src={e.hostAvatar} name={e.hostName} size={28} />
                  <div>
                    <strong>{e.title}</strong>
                    <span>
                      {e.hostName}
                      {e.category && ` · ${CATEGORY_LABEL[e.category]}`} · {elapsed(e.startedAt, e.endedAt)} de duração
                      {e.peakViewers > 0 && ` · pico de ${e.peakViewers} assistindo`}
                    </span>
                  </div>
                  <time dateTime={new Date(e.endedAt).toISOString()}>
                    {new Date(e.endedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </time>
                </li>
              ))}
            </ul>
          </section>
        )}
        {starting && (
          <StartDialog
            busy={busy}
            initial={draft}
            capturing={phase === 'capturing'}
            error={message}
            onCancel={() => {
              setStarting(false);
              setMessage('');
            }}
            onStart={(form) => {
              setDraft(form);
              void start(form);
            }}
          />
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------- Sala (quem transmite e quem assiste)
  const title = meta?.title ?? connection?.title ?? 'Transmissão';
  const hostName = meta?.hostName ?? connection?.hostName ?? 'Cidadão';
  const status =
    phase === 'capturing'
      ? 'Solicitando acesso à tela…'
      : phase === 'preparing'
        ? 'Preparando transmissão…'
        : phase === 'connecting'
          ? 'Conectando…'
          : phase === 'reconnecting'
            ? 'Reconectando à transmissão…'
            : null;
  return (
    <div className="tela-room">
      <div className="tela-room-main">
        <div
          ref={stage}
          className={`tela-stage${fullscreen ? ' is-fullscreen' : ''}`}
          tabIndex={0}
          aria-label="Transmissão"
        >
          {screenTrack?.track && <Media track={screenTrack.track} muted volume={volume} />}
          {audioTracks.map((pub) => (
            <Media key={pub.trackSid} track={pub.track!} muted={muted} volume={volume} />
          ))}
          {!screenTrack && (
            <div className="tela-stage-empty" role="status">
              {status ? (
                <>
                  <span className="tela-spinner" aria-hidden />
                  <strong>{status}</strong>
                </>
              ) : isHost ? (
                <>
                  <strong>{sharing ? 'Enviando sua tela…' : 'Compartilhamento interrompido'}</strong>
                  <p>
                    {sharing
                      ? 'Sua tela aparece aqui em instantes.'
                      : 'A transmissão continua aberta. Compartilhe de novo para voltar ao vivo.'}
                  </p>
                  {!sharing && (
                    <button className="button" disabled={busy} onClick={share}>
                      Compartilhar tela
                    </button>
                  )}
                </>
              ) : hostAway ? (
                <>
                  <span className="tela-spinner" aria-hidden />
                  <strong>O transmissor perdeu a conexão.</strong>
                  <p>Aguardando o retorno. Se não voltar em alguns minutos, a transmissão é encerrada.</p>
                </>
              ) : (
                <>
                  <strong>{meta?.startedAt ? 'Transmissão pausada' : 'A transmissão vai começar'}</strong>
                  <p>
                    {meta?.startedAt
                      ? 'Quem transmite interrompeu o compartilhamento por um momento.'
                      : 'Aguardando a tela ser compartilhada.'}
                  </p>
                </>
              )}
            </div>
          )}
          <div className="tela-overlay-top">
            {live && <span className="tela-live">AO VIVO</span>}
            {phase === 'reconnecting' && <span className="tela-chip">RECONECTANDO</span>}
            {meta?.startedAt && <span className="tela-chip">{elapsed(meta.startedAt, now)}</span>}
            <span className="tela-chip" title="Assistindo agora">
              <Eye /> {viewers.length}
            </span>
          </div>
          {!isHost && (
            <div className="tela-controls" role="toolbar" aria-label="Controles do espectador">
              <button onClick={() => setMuted((v) => !v)} aria-pressed={muted}>
                {muted ? 'Ativar som' : 'Silenciar'}
              </button>
              <label className="tela-volume">
                <span className="sr-only">Volume</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  aria-label="Volume"
                />
              </label>
              <button onClick={() => void instance?.startAudio()}>Liberar áudio</button>
              <span className="tela-spacer" />
              {supportsPip && screenTrack && <button onClick={pictureInPicture}>Janela flutuante</button>}
              <button onClick={toggleFullscreen}>{fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}</button>
              <button className="danger" onClick={() => control('leave')} disabled={busy}>
                Sair
              </button>
            </div>
          )}
        </div>
        <div className="tela-info">
          <Avatar src={meta?.hostAvatar ?? connection?.hostAvatar ?? null} name={hostName} size={44} />
          <div>
            <h1>{title}</h1>
            <p>
              {hostName}
              {connection?.category && ` · ${CATEGORY_LABEL[connection.category]}`}
              {connection?.visibility === 'private' && ' · Privada'}
            </p>
            {connection?.description && <p className="tela-description">{connection.description}</p>}
          </div>
        </div>
        {message && (
          <p className="tela-message" role="alert">
            {message}
          </p>
        )}
        {isHost && connection && (
          <div className="tela-host-bar" role="toolbar" aria-label="Controles da transmissão">
            <span className={`tela-host-state${live ? ' is-live' : ''}`}>
              {live ? 'Você está transmitindo' : sharing ? 'Iniciando…' : 'Compartilhamento interrompido'}
            </span>
            <button className="button small" disabled={busy} onClick={share}>
              {sharing ? 'Trocar tela' : 'Compartilhar tela'}
            </button>
            {sharing && (
              <button className="button small outline" disabled={busy} onClick={() => void stopShare()}>
                Parar compartilhamento
              </button>
            )}
            <label className="tela-select">
              <span>Qualidade</span>
              <select value={quality} disabled={busy} onChange={(e) => setQuality(e.target.value as Quality)}>
                {Object.entries(qualityPresets).map(([key, preset]) => (
                  <option key={key} value={key}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
            <button className="button small outline" onClick={toggleMic} aria-pressed={mic}>
              {mic ? 'Microfone ligado' : 'Microfone desligado'}
            </button>
            <span className="tela-muted">Áudio da tela: {screenAudio ? 'sim' : 'não'}</span>
            <span className="tela-spacer" />
            <button
              className="button small outline"
              onClick={() => {
                const link = `${location.origin}/tela?room=${connection.code}${connection.invite ? `&invite=${connection.invite}` : ''}`;
                navigator.clipboard.writeText(link).then(
                  () => setMessage('Link copiado.'),
                  () => setMessage('Não foi possível copiar o link.'),
                );
              }}
            >
              {connection.invite ? 'Copiar convite' : 'Copiar link'}
            </button>
            <button className="button small danger" disabled={busy} onClick={() => setConfirmEnd(true)}>
              Encerrar transmissão
            </button>
          </div>
        )}
      </div>
      <aside className="tela-viewers" aria-label="Quem está assistindo">
        <h2>
          Assistindo <span className="tela-count">{viewers.length}</span>
        </h2>
        {viewers.length === 0 ? (
          <p className="tela-muted">Ninguém assistindo ainda.</p>
        ) : (
          <ul>
            {viewers.map((p) => (
              <li key={p.identity}>
                <Avatar src={avatarOf(p)} name={p.name || 'Cidadão'} size={28} />
                <span>{p.name || 'Cidadão'}</span>
                {isHost && p !== instance?.localParticipant && (
                  <button className="tela-link" disabled={busy} onClick={() => control('kick', { target: p.identity })}>
                    Remover
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </aside>
      {confirmEnd && (
        <div className="tela-dialog-backdrop" role="presentation">
          <div className="tela-dialog" role="alertdialog" aria-modal="true" aria-labelledby="tela-end-title">
            <h2 id="tela-end-title">Encerrar transmissão?</h2>
            <p>Todos os espectadores serão desconectados e a transmissão sai da lista.</p>
            <div>
              <button className="button outline" onClick={() => setConfirmEnd(false)} autoFocus>
                Continuar transmitindo
              </button>
              <button className="button danger" disabled={busy} onClick={() => control('end')}>
                Encerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BroadcastTile({
  card,
  now,
  onWatch,
  disabled,
  own,
}: {
  card: BroadcastCard;
  now: number;
  onWatch?: () => void;
  disabled?: boolean;
  own?: boolean;
}) {
  return (
    <article className={`tela-tile${card.status === 'live' ? ' is-live' : ''}`}>
      <div className="tela-tile-preview">
        <Avatar src={card.hostAvatar} name={card.hostName} size={64} />
        <div className="tela-tile-badges">
          {card.status === 'live' ? (
            <span className="tela-live">AO VIVO</span>
          ) : (
            <span className="tela-chip">{card.status === 'paused' ? 'PAUSADA' : 'AGUARDANDO'}</span>
          )}
          <span className="tela-chip" title="Assistindo agora">
            <Eye /> {card.viewers}
          </span>
        </div>
        {card.startedAt && <span className="tela-tile-time">{elapsed(card.startedAt, now)}</span>}
      </div>
      <div className="tela-tile-body">
        <Avatar src={card.hostAvatar} name={card.hostName} size={32} />
        <div>
          <h3>{card.title}</h3>
          <p>
            {card.hostName}
            {card.category && <span className="tela-tag">{CATEGORY_LABEL[card.category]}</span>}
            {own && card.visibility === 'private' && <span className="tela-tag">Privada</span>}
          </p>
          {card.description && <p className="tela-description">{card.description}</p>}
        </div>
      </div>
      {onWatch && (
        <button className="button small" disabled={disabled} onClick={onWatch}>
          Assistir
        </button>
      )}
    </article>
  );
}

function StartDialog({
  busy,
  initial,
  capturing,
  error,
  onCancel,
  onStart,
}: {
  busy: boolean;
  initial: StartForm | null;
  capturing: boolean;
  error: string;
  onCancel: () => void;
  onStart: (form: StartForm) => void;
}) {
  const [form, setForm] = useState<StartForm>(
    initial ?? { title: '', description: '', category: '', visibility: 'public', quality: 'auto', audio: true },
  );
  const valid = form.title.trim().length >= 3;
  return (
    <div className="tela-dialog-backdrop" role="presentation">
      <form
        className="tela-dialog tela-start"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tela-start-title"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !busy) onStart({ ...form, title: form.title.trim(), description: form.description.trim() });
        }}
      >
        <h2 id="tela-start-title">Iniciar transmissão</h2>
        <label>
          Título
          <input
            required
            minLength={3}
            maxLength={80}
            value={form.title}
            autoFocus
            placeholder="Ex.: Corrida na zona norte"
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </label>
        <label>
          <span>
            Descrição <span className="tela-muted">(opcional)</span>
          </span>
          <textarea
            maxLength={280}
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <div className="tela-row">
          <label>
            <span>
              Categoria <span className="tela-muted">(opcional)</span>
            </span>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as Category | '' })}
            >
              <option value="">Sem categoria</option>
              {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Quem pode assistir
            <select
              value={form.visibility}
              onChange={(e) => setForm({ ...form, visibility: e.target.value as Visibility })}
            >
              <option value="public">Pública — aparece na lista</option>
              <option value="private">Privada — só com o link de convite</option>
            </select>
          </label>
        </div>
        <div className="tela-row">
          <label>
            Qualidade
            <select value={form.quality} onChange={(e) => setForm({ ...form, quality: e.target.value as Quality })}>
              {Object.entries(qualityPresets).map(([key, preset]) => (
                <option key={key} value={key}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          <label className="tela-check">
            <input
              type="checkbox"
              checked={form.audio}
              onChange={(e) => setForm({ ...form, audio: e.target.checked })}
            />
            Incluir áudio da tela, se o navegador permitir
          </label>
        </div>
        <p className="tela-muted">
          Ao continuar, o navegador pergunta qual monitor, janela ou aba compartilhar. O microfone não é ligado.
        </p>
        {error && (
          <p className="tela-message" role="alert">
            {error}
          </p>
        )}
        <div className="tela-dialog-actions">
          <button type="button" className="button outline" onClick={onCancel}>
            Cancelar
          </button>
          <button className="button" disabled={!valid || busy}>
            {capturing ? 'Escolha a tela no navegador…' : 'Escolher tela e entrar ao vivo'}
          </button>
        </div>
      </form>
    </div>
  );
}
