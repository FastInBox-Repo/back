import { Body, Controller, Get, Headers, Ip, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

import { Public } from '../../common/decorators';
import { ValidationDomainError } from '../../common/domain-errors';
import { AuthService } from './auth.service';

interface AuthedRequest extends Request {
  user?: { userId: string; role: string };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  login(
    @Body() body: { email?: string; password?: string },
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    if (!body?.email || !body?.password) {
      throw new ValidationDomainError(
        'AUTH_PAYLOAD_INVALID',
        'email and password are required',
      );
    }
    return this.auth.login(body.email, body.password, { ip, userAgent });
  }

  @Public()
  @Post('refresh')
  refresh(
    @Body() body: { refreshToken?: string },
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    if (!body?.refreshToken) {
      throw new ValidationDomainError(
        'AUTH_PAYLOAD_INVALID',
        'refreshToken is required',
      );
    }
    return this.auth.rotateRefresh(body.refreshToken, { ip, userAgent });
  }

  @Public()
  @Post('logout')
  logout(@Body() body: { refreshToken?: string }) {
    if (body?.refreshToken) this.auth.logout(body.refreshToken);
    return { ok: true };
  }

  @Get('me')
  me(@Req() req: AuthedRequest) {
    return req.user;
  }

  @Public()
  @Post('password-reset/request')
  requestReset(@Body() body: { email?: string }) {
    if (!body?.email)
      throw new ValidationDomainError(
        'AUTH_PAYLOAD_INVALID',
        'email is required',
      );
    return this.auth.requestPasswordReset(body.email);
  }

  @Public()
  @Post('password-reset/confirm')
  confirmReset(@Body() body: { token?: string; newPassword?: string }) {
    if (!body?.token || !body?.newPassword) {
      throw new ValidationDomainError(
        'AUTH_PAYLOAD_INVALID',
        'token and newPassword are required',
      );
    }
    return this.auth.confirmPasswordReset(body.token, body.newPassword);
  }
}
