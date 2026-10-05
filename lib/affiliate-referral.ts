export const REFERRAL_TTL = 7 * 86400000;
export function storedReferral(raw: string | null, now = Date.now()): string | null {
  try {
    const v = JSON.parse(raw ?? 'null');
    return v &&
      typeof v.code === 'string' &&
      /^[A-Z0-9_-]{3,32}$/.test(v.code) &&
      Number.isFinite(v.expiresAt) &&
      v.expiresAt > now &&
      v.expiresAt <= now + REFERRAL_TTL
      ? v.code
      : null;
  } catch {
    return null;
  }
}
