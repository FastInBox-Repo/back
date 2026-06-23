import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { TooManyRequestsDomainError } from './domain-errors';
import { SKIP_RATE_LIMIT_KEY } from './decorators';
import {
  FixedWindowRateLimiter,
  rateLimitOptionsFromEnv,
  type RateLimitOptions,
} from './rate-limiter';

interface RateLimitedRequest {
  ip?: string;
  socket?: { remoteAddress?: string };
  headers: Record<string, string | string[] | undefined>;
  res?: {
    setHeader: (name: string, value: string | number) => void;
  };
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly limiter: FixedWindowRateLimiter;
  private readonly options: RateLimitOptions;

  constructor(
    private readonly reflector: Reflector,
    // Optional so Nest's DI leaves these undefined (no provider needed); unit
    // tests pass an explicit limiter/options to drive the threshold cheaply.
    @Optional() limiter?: FixedWindowRateLimiter,
    @Optional() options?: RateLimitOptions,
  ) {
    this.options = options ?? rateLimitOptionsFromEnv();
    this.limiter = limiter ?? new FixedWindowRateLimiter(this.options);
  }

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skip) return true;

    const req = context.switchToHttp().getRequest<RateLimitedRequest>();
    const key = clientIp(req);
    const decision = this.limiter.hit(key);

    if (req.res?.setHeader) {
      req.res.setHeader('X-RateLimit-Limit', this.options.max);
      req.res.setHeader('X-RateLimit-Remaining', decision.remaining);
      req.res.setHeader(
        'X-RateLimit-Reset',
        Math.ceil(decision.resetAt / 1000),
      );
    }

    if (!decision.allowed) {
      throw new TooManyRequestsDomainError();
    }
    return true;
  }
}

function clientIp(req: RateLimitedRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].split(',')[0].trim();
  }
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}
