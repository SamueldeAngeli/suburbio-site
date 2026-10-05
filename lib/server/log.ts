import 'server-only';

type Level = 'info' | 'warn' | 'error';
type Value = string | number | boolean | null | undefined;
const SENSITIVE = /token|secret|password|authorization|cookie|signature|hmac|key$/i;

/** One JSON line per event. Sensitive-looking fields are dropped, never printed. */
export function logEvent(level: Level, event: string, fields: Record<string, Value> = {}) {
  const safe: Record<string, Value> = {};
  for (const [name, value] of Object.entries(fields))
    if (value !== undefined && !SENSITIVE.test(name)) safe[name] = value;
  const line = JSON.stringify({ timestamp: new Date().toISOString(), service: 'site', level, event, ...safe });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
}
