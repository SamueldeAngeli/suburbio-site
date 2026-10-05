// Browser-side call to the site BFF. Receives only the public LiveKit URL and a short-lived token.
export type RoomConnection = { code: string; host: string; locked: boolean; url: string; token: string };
export type RoomState = { code: string; host: string; locked: boolean };

export async function requestRoom<T = RoomState>(
  action: string,
  payload: Record<string, unknown>,
  transport: typeof fetch = fetch,
): Promise<T> {
  const response = await transport('/api/screen/room', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-suburbio-intent': 'screen.room' },
    body: JSON.stringify({ action, ...payload }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(body.error?.message ?? 'Não foi possível realizar a ação.');
  return body as T;
}
