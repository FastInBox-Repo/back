import { Controller, Get } from '@nestjs/common';

import { Public } from './common/decorators';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'fastinbox-api',
      timestamp: new Date().toISOString(),
    };
  }
}
