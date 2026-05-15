import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthService } from '../modules/auth/auth.service';
import { UnauthorizedDomainError, ForbiddenDomainError } from './domain-errors';
import { PUBLIC_KEY, ROLES_KEY } from './decorators';
import type { UserRole } from '../modules/users/user.entity';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: ReturnType<AuthService['validateAccessToken']>;
    }>();
    const header = req.headers['authorization'] as string | undefined;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedDomainError('AUTH_TOKEN_MISSING');
    }
    const token = header.slice('Bearer '.length).trim();
    const session = this.auth.validateAccessToken(token);
    req.user = session;

    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles && roles.length > 0 && !roles.includes(session.role)) {
      throw new ForbiddenDomainError('AUTH_INSUFFICIENT_ROLE');
    }
    return true;
  }
}
