import { describe, it, expect } from 'vitest';
import { RateLimiter, WindowLimiter } from '@/lib/server/security';
import { RedisUnavailable, type SiteRedis } from '@/lib/server/redis';

function redis(counts: Map<string, number>, fail = false): SiteRedis {
  return {
    key: (name) => 'suburbio:site:' + name,
    run: async (_op, action) => {
      if (fail) throw new RedisUnavailable('down');
      return action({
        eval: async (_: string, { keys }: { keys: string[] }) => {
          const n = (counts.get(keys[0]) ?? 0) + 1;
          counts.set(keys[0], n);
          return n;
        },
      } as never);
    },
  };
}

describe('RateLimiter', () => {
  it('shares the window through Redis under the site namespace', async () => {
    const counts = new Map<string, number>();
    const a = new RateLimiter(new WindowLimiter(), () => redis(counts));
    const b = new RateLimiter(new WindowLimiter(), () => redis(counts));
    await a.consume('order-create:1', 2);
    await b.consume('order-create:1', 2);
    await expect(a.consume('order-create:1', 2)).rejects.toMatchObject({ code: 'RATE_LIMITED', status: 429 });
    expect([...counts.keys()]).toEqual(['suburbio:site:rate-limit:order-create:1']);
  });

  it('Redis outage degrades to the local window instead of removing the limit', async () => {
    const limiter = new RateLimiter(new WindowLimiter(), () => redis(new Map(), true));
    await limiter.consume('admin:1', 1);
    await expect(limiter.consume('admin:1', 1)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('works without Redis configured', async () => {
    const limiter = new RateLimiter(new WindowLimiter(), () => null);
    await limiter.consume('x', 1);
    await expect(limiter.consume('x', 1)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });
});
