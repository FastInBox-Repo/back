import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedRequest } from '../types/authenticated-request.type';
import { toSafeUser } from '../utils/user.util';
import { DataStoreService } from '../../infra/data-store.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly dataStoreService: DataStoreService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const rawAuthorization = request.headers.authorization;

    if (!rawAuthorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token.');
    }

    const token = rawAuthorization.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Invalid token format.');
    }

    const data = await this.dataStoreService.readData();
    const session = data.sessions.find((item) => item.token === token);
    if (!session) {
      throw new UnauthorizedException('Session not found.');
    }

    const user = data.users.find((item) => item.id === session.userId);
    if (!user) {
      throw new UnauthorizedException('User for session not found.');
    }

    request.currentUser = toSafeUser(user);
    request.authToken = token;
    return true;
  }
}
