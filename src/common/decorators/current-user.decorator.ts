import {
  UnauthorizedException,
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import type { SafeUser } from '../types/domain.types';
import type { AuthenticatedRequest } from '../types/authenticated-request.type';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SafeUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.currentUser) {
      throw new UnauthorizedException('Usuario nao autenticado.');
    }
    return request.currentUser;
  },
);
