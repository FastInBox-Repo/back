import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';

interface LoginBody {
  email?: string;
  password?: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() body: LoginBody) {
    if (!body.email || !body.password) {
      throw new BadRequestException('email e password sao obrigatorios.');
    }

    return this.authService.login(body.email, body.password);
  }
}
