// Browser-side call to the site BFF. Receives only the public LiveKit URL and a short-lived token.
export type RoomRole = 'host' | 'presenter' | 'participant';
export type Category = 'gameplay' | 'staff' | 'suporte' | 'evento' | 'apresentacao' | 'outro';
export type Visibility = 'public' | 'private';
export const CATEGORY_LABEL: Record<Category, string> = {
  gameplay: 'Gameplay',
  staff: 'Staff',
  suporte: 'Suporte',
  evento: 'Evento',
  apresentacao: 'Apresentação',
  outro: 'Outro',
};
export type RoomState = {
  code: string;
  title: string;
  description: string;
  category: Category | null;
  visibility: Visibility;
  host: string;
  hostName: string;
  hostAvatar: string | null;
  startedAt: number | null;
  locked: boolean;
  capacity: number;
  role: RoomRole;
  invite?: string;
};
export type RoomConnection = RoomState & { url: string; token: string };
export type BroadcastStatus = 'live' | 'paused' | 'waiting';
export type BroadcastCard = {
  code: string;
  title: string;
  description: string;
  category: Category | null;
  visibility: Visibility;
  host: string;
  hostName: string;
  hostAvatar: string | null;
  status: BroadcastStatus;
  startedAt: number | null;
  viewers: number;
  peakViewers: number;
  hostConnected: boolean;
  invite?: string;
};
export type EndedBroadcast = {
  code: string;
  title: string;
  host: string;
  hostName: string;
  hostAvatar: string | null;
  category: Category | null;
  visibility: Visibility;
  startedAt: number;
  endedAt: number;
  peakViewers: number;
  reason: 'host' | 'moderator' | 'host_lost' | 'closed' | 'expired';
};
export type Broadcasts = { live: BroadcastCard[]; mine: BroadcastCard | null; ended: EndedBroadcast[] };

/** Erro do BFF com o código estável (ROOM_FULL, ROOM_ACTIVE_EXISTS, …) e a mensagem já sanitizada. */
export class RoomRequestError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new RoomRequestError(
      typeof body.error?.code === 'string' ? body.error.code : 'UNKNOWN',
      response.status,
      body.error?.message ?? 'Não foi possível realizar a ação.',
    );
  return body as T;
}

export async function requestRoom<T = RoomState>(
  action: string,
  payload: Record<string, unknown>,
  transport: typeof fetch = fetch,
): Promise<T> {
  let response: Response;
  try {
    response = await transport('/api/screen/room', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-suburbio-intent': 'screen.room' },
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    throw new RoomRequestError('NETWORK', 0, 'Sem conexão com o site. Verifique sua internet.');
  }
  return readResponse<T>(response);
}

export async function fetchBroadcasts(transport: typeof fetch = fetch): Promise<Broadcasts> {
  let response: Response;
  try {
    response = await transport('/api/screen/room', { cache: 'no-store' });
  } catch {
    throw new RoomRequestError('NETWORK', 0, 'Sem conexão com o site. Verifique sua internet.');
  }
  return readResponse<Broadcasts>(response);
}

/** "há 12 min", "1 h 05 min" — duração legível desde um instante. */
export function elapsed(since: number, now = Date.now()) {
  const total = Math.max(0, Math.floor((now - since) / 1000));
  const h = Math.floor(total / 3600),
    m = Math.floor((total % 3600) / 60),
    s = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
