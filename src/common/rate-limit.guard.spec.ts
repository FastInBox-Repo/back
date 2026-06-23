import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { DomainError } from './domain-errors';
import { RateLimitGuard } from './rate-limit.guard';
import { SKIP_RATE_LIMIT_KEY } from './decorators';
import {
  FixedWindowRateLimiter,
  rateLimitOptionsFromEnv,
} from './rate-limiter';

function contextFor(
  req: Record<string, unknown>,
  handler: () => void = () => {},
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => handler,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

describe('FixedWindowRateLimiter', () => {
  it('allows up to max then blocks within the same window', () => {
    let now = 1000;
    const limiter = new FixedWindowRateLimiter(
      { max: 3, windowMs: 1000 },
      () => now,
    );
    expect(limiter.hit('ip').allowed).toBe(true);
    expect(limiter.hit('ip').allowed).toBe(true);
    const third = limiter.hit('ip');
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
    expect(limiter.hit('ip').allowed).toBe(false);

    // New window resets the count.
    now += 1000;
    expect(limiter.hit('ip').allowed).toBe(true);
  });

  it('tracks keys independently and sweeps expired windows', () => {
    let now = 0;
    const limiter = new FixedWindowRateLimiter(
      { max: 1, windowMs: 100 },
      () => now,
    );
    expect(limiter.hit('a').allowed).toBe(true);
    expect(limiter.hit('b').allowed).toBe(true);
    expect(limiter.hit('a').allowed).toBe(false);
    expect(limiter.size()).toBe(2);
    now += 100;
    limiter.sweep();
    expect(limiter.size()).toBe(0);
  });
});

describe('rateLimitOptionsFromEnv', () => {
  it('uses defaults when env is unset or invalid', () => {
    expect(rateLimitOptionsFromEnv({})).toEqual({ max: 120, windowMs: 60_000 });
    expect(
      rateLimitOptionsFromEnv({
        RATE_LIMIT_MAX: 'x',
        RATE_LIMIT_WINDOW_MS: '0',
      }),
    ).toEqual({ max: 120, windowMs: 60_000 });
  });

  it('reads valid overrides', () => {
    expect(
      rateLimitOptionsFromEnv({
        RATE_LIMIT_MAX: '5',
        RATE_LIMIT_WINDOW_MS: '2000',
      }),
    ).toEqual({ max: 5, windowMs: 2000 });
  });
});

describe('RateLimitGuard', () => {
  it('throws RATE_LIMITED (429) once the per-IP threshold is exceeded', () => {
    const limiter = new FixedWindowRateLimiter({ max: 2, windowMs: 60_000 });
    const guard = new RateLimitGuard(new Reflector(), limiter, {
      max: 2,
      windowMs: 60_000,
    });
    const ctx = contextFor({ ip: '1.2.3.4', headers: {} });

    expect(guard.canActivate(ctx)).toBe(true);
    expect(guard.canActivate(ctx)).toBe(true);
    try {
      guard.canActivate(ctx);
      throw new Error('expected guard to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).getStatus()).toBe(429);
      expect((err as DomainError).getResponse()).toMatchObject({
        code: 'RATE_LIMITED',
      });
    }
  });

  it('separates counts by client IP (x-forwarded-for honored)', () => {
    const guard = new RateLimitGuard(
      new Reflector(),
      new FixedWindowRateLimiter({ max: 1, windowMs: 60_000 }),
      { max: 1, windowMs: 60_000 },
    );
    const a = contextFor({ headers: { 'x-forwarded-for': '9.9.9.9' } });
    const b = contextFor({ headers: { 'x-forwarded-for': '8.8.8.8' } });
    expect(guard.canActivate(a)).toBe(true);
    expect(guard.canActivate(b)).toBe(true); // different IP, fresh budget
    expect(() => guard.canActivate(a)).toThrow(DomainError); // same IP exhausted
  });

  it('bypasses routes decorated with @SkipRateLimit', () => {
    const reflector = new Reflector();
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key) =>
        key === SKIP_RATE_LIMIT_KEY ? true : undefined,
      );
    const guard = new RateLimitGuard(
      reflector,
      new FixedWindowRateLimiter({ max: 1, windowMs: 60_000 }),
      { max: 1, windowMs: 60_000 },
    );
    const ctx = contextFor({ ip: '1.2.3.4', headers: {} });
    // Many calls, never throttled because the route is exempt.
    for (let i = 0; i < 10; i += 1) {
      expect(guard.canActivate(ctx)).toBe(true);
    }
  });
});
