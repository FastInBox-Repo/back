export interface RateLimitOptions {
  /** Max requests allowed per key within the window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  /** Requests already counted in the current window (after this hit). */
  count: number;
  /** Remaining allowance after this hit (never negative). */
  remaining: number;
  /** Epoch ms when the current window resets. */
  resetAt: number;
}

interface WindowEntry {
  count: number;
  windowStart: number;
}

/**
 * Dependency-free fixed-window rate limiter. Pure and deterministic when a
 * clock is injected, so it can be unit-tested without real time or HTTP.
 */
export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, WindowEntry>();

  constructor(
    private readonly options: RateLimitOptions,
    private readonly clock: () => number = () => Date.now(),
  ) {}

  /** Records a hit for `key` and returns whether it is allowed. */
  hit(key: string): RateLimitDecision {
    const now = this.clock();
    const { max, windowMs } = this.options;
    const entry = this.buckets.get(key);

    if (!entry || now - entry.windowStart >= windowMs) {
      const fresh: WindowEntry = { count: 1, windowStart: now };
      this.buckets.set(key, fresh);
      return {
        allowed: true,
        count: 1,
        remaining: Math.max(0, max - 1),
        resetAt: now + windowMs,
      };
    }

    entry.count += 1;
    const allowed = entry.count <= max;
    return {
      allowed,
      count: entry.count,
      remaining: Math.max(0, max - entry.count),
      resetAt: entry.windowStart + windowMs,
    };
  }

  /** Number of tracked keys (for diagnostics/tests). */
  size(): number {
    return this.buckets.size;
  }

  /** Drops windows that have fully elapsed, to keep the map bounded. */
  sweep(): void {
    const now = this.clock();
    for (const [key, entry] of this.buckets) {
      if (now - entry.windowStart >= this.options.windowMs) {
        this.buckets.delete(key);
      }
    }
  }
}

const DEFAULT_MAX = 120;
const DEFAULT_WINDOW_MS = 60_000;

/** Reads limiter options from env with safe defaults. */
export function rateLimitOptionsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): RateLimitOptions {
  const max = Number.parseInt(env.RATE_LIMIT_MAX ?? '', 10);
  const windowMs = Number.parseInt(env.RATE_LIMIT_WINDOW_MS ?? '', 10);
  return {
    max: Number.isFinite(max) && max > 0 ? max : DEFAULT_MAX,
    windowMs:
      Number.isFinite(windowMs) && windowMs > 0 ? windowMs : DEFAULT_WINDOW_MS,
  };
}
