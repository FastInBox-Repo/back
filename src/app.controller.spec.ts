import { Test, TestingModule } from '@nestjs/testing';

import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('returns the bootstrap message', () => {
    expect(appController.getHello()).toContain('FastInBox API');
  });

  it('returns health payload', () => {
    const health = appController.health();
    expect(health.status).toBe('ok');
    expect(health.service).toBe('fastinbox-api');
  });
});
