// Browser-side call to the site BFF. Receives only the public LiveKit URL and a short-lived token.
export type RoomRole = 'host' | 'presenter' | 'participant';
export type RoomState = {
  code: string;
  title: string;
  host: string;
  locked: boolean;
  capacity: number;
  role: RoomRole;
};
export type RoomConnection = RoomState & { url: string; token: string };

/** Erro do BFF com o código estável (ROOM_FULL, ROOM_LOCKED, …) e a mensagem já sanitizada. */
export class RoomRequestError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
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
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new RoomRequestError(
      typeof body.error?.code === 'string' ? body.error.code : 'UNKNOWN',
      response.status,
      body.error?.message ?? 'Não foi possível realizar a ação.',
    );
  return body as T;
}
