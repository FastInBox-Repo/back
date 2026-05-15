import { Injectable, Logger } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { UnauthorizedDomainError } from '../../common/domain-errors';
import { newId } from '../../common/ids';
import { UsersService } from '../users/users.service';
import type { User, UserRole } from '../users/user.entity';

interface SessionToken {
  id: string;
  userId: string;
  role: UserRole;
  clinicId?: string;
  fullName: string;
  email: string;
  expiresAt: number;
}

interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: number;
  consumedAt?: number;
  replacedById?: string;
  ip?: string;
  userAgent?: string;
}

interface FailedLoginEntry {
  ip: string;
  count: number;
  windowStart: number;
}

const ACCESS_TTL_MS = 15 * 60 * 1000;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly secret: string;
  private readonly tokens = new Map<string, SessionToken>();
  private readonly refreshTokens = new Map<string, RefreshTokenRecord>();
  private readonly throttle = new Map<string, FailedLoginEntry>();
  private readonly resetTokens = new Map<
    string,
    { userId: string; expiresAt: number; consumed: boolean }
  >();

  constructor(private readonly users: UsersService) {
    this.secret =
      process.env.JWT_SECRET ?? 'fastinbox-development-secret-change-me';
  }

  login(
    email: string,
    password: string,
    context: { ip?: string; userAgent?: string } = {},
  ) {
    const ip = context.ip ?? 'unknown';
    this.assertNotThrottled(ip);

    const user = this.users.findByEmail(email);
    if (!user || !this.users.verifyPassword(password, user.passwordHash)) {
      this.registerFailure(ip);
      throw new UnauthorizedDomainError(
        'AUTH_INVALID_CREDENTIALS',
        'Invalid email or password',
      );
    }

    const session = this.issueAccessToken(user);
    const refresh = this.issueRefreshToken(user, undefined, context);
    this.logger.log(`auth.login user=${user.id} role=${user.role} ip=${ip}`);
    return {
      accessToken: session.signed,
      refreshToken: refresh.token,
      expiresAt: new Date(session.payload.expiresAt).toISOString(),
      user: this.users.toPublic(user),
    };
  }

  rotateRefresh(
    token: string,
    context: { ip?: string; userAgent?: string } = {},
  ) {
    const record = this.findRefresh(token);
    if (!record || record.expiresAt < Date.now()) {
      throw new UnauthorizedDomainError('AUTH_TOKEN_EXPIRED');
    }
    if (record.consumedAt) {
      this.revokeFamily(record.familyId);
      throw new UnauthorizedDomainError('AUTH_TOKEN_REUSE_DETECTED');
    }
    const user = this.users.findById(record.userId);
    if (!user) throw new UnauthorizedDomainError('AUTH_USER_GONE');

    record.consumedAt = Date.now();
    const next = this.issueRefreshToken(user, record.familyId, context);
    record.replacedById = next.recordId;

    const session = this.issueAccessToken(user);
    return {
      accessToken: session.signed,
      refreshToken: next.token,
      expiresAt: new Date(session.payload.expiresAt).toISOString(),
      user: this.users.toPublic(user),
    };
  }

  logout(token: string) {
    const record = this.findRefresh(token);
    if (record) {
      record.consumedAt = Date.now();
      this.revokeFamily(record.familyId);
    }
  }

  validateAccessToken(signed: string): SessionToken {
    const [payloadEncoded, signature] = signed.split('.');
    if (!payloadEncoded || !signature)
      throw new UnauthorizedDomainError('AUTH_TOKEN_MALFORMED');
    const expected = this.sign(payloadEncoded);
    if (!safeEqualHex(signature, expected))
      throw new UnauthorizedDomainError('AUTH_TOKEN_INVALID');
    const payload = JSON.parse(
      Buffer.from(payloadEncoded, 'base64url').toString('utf8'),
    ) as SessionToken;
    if (payload.expiresAt < Date.now())
      throw new UnauthorizedDomainError('AUTH_TOKEN_EXPIRED');
    return payload;
  }

  requestPasswordReset(email: string) {
    const user = this.users.findByEmail(email);
    const token = randomBytes(24).toString('base64url');
    if (user) {
      this.resetTokens.set(token, {
        userId: user.id,
        expiresAt: Date.now() + 30 * 60 * 1000,
        consumed: false,
      });
      this.logger.log(`auth.password-reset.request user=${user.id}`);
    }
    return { ok: true };
  }

  confirmPasswordReset(token: string, newPassword: string) {
    const record = this.resetTokens.get(token);
    if (!record || record.consumed || record.expiresAt < Date.now()) {
      throw new UnauthorizedDomainError('AUTH_RESET_TOKEN_INVALID');
    }
    const user = this.users.findById(record.userId);
    if (!user) throw new UnauthorizedDomainError('AUTH_USER_GONE');
    this.users.update(user.id, {
      passwordHash: this.users.hashPassword(newPassword),
    });
    record.consumed = true;
    for (const refresh of this.refreshTokens.values()) {
      if (refresh.userId === user.id) refresh.consumedAt = Date.now();
    }
    this.logger.log(`auth.password-reset.confirm user=${user.id}`);
    return { ok: true };
  }

  private issueAccessToken(user: User) {
    const payload: SessionToken = {
      id: newId(),
      userId: user.id,
      role: user.role,
      clinicId: user.clinicId,
      fullName: user.fullName,
      email: user.email,
      expiresAt: Date.now() + ACCESS_TTL_MS,
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = this.sign(encoded);
    const signed = `${encoded}.${signature}`;
    this.tokens.set(payload.id, payload);
    return { payload, signed };
  }

  private issueRefreshToken(
    user: User,
    familyId: string | undefined,
    context: { ip?: string; userAgent?: string },
  ) {
    const token = randomBytes(32).toString('base64url');
    const record: RefreshTokenRecord = {
      id: newId(),
      userId: user.id,
      tokenHash: this.hashRefresh(token),
      familyId: familyId ?? newId(),
      expiresAt: Date.now() + REFRESH_TTL_MS,
      ip: context.ip,
      userAgent: context.userAgent,
    };
    this.refreshTokens.set(record.tokenHash, record);
    return { token, recordId: record.id };
  }

  private findRefresh(token: string): RefreshTokenRecord | undefined {
    return this.refreshTokens.get(this.hashRefresh(token));
  }

  private revokeFamily(familyId: string) {
    for (const record of this.refreshTokens.values()) {
      if (record.familyId === familyId) record.consumedAt = Date.now();
    }
  }

  private hashRefresh(token: string): string {
    return createHmac('sha256', this.secret).update(token).digest('hex');
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.secret).update(payload).digest('hex');
  }

  private registerFailure(ip: string) {
    const now = Date.now();
    const entry = this.throttle.get(ip);
    if (!entry || now - entry.windowStart > 60_000) {
      this.throttle.set(ip, { ip, count: 1, windowStart: now });
      return;
    }
    entry.count += 1;
  }

  private assertNotThrottled(ip: string) {
    const entry = this.throttle.get(ip);
    if (!entry) return;
    if (Date.now() - entry.windowStart > 60_000) {
      this.throttle.delete(ip);
      return;
    }
    if (entry.count >= 5) {
      throw new UnauthorizedDomainError(
        'AUTH_RATE_LIMITED',
        'Too many login attempts. Try again in 1 minute.',
      );
    }
  }
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}
