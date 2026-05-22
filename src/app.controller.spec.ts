import { Test, TestingModule } from '@nestjs/testing';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditService } from './modules/audit/audit.service';
import { OrdersService } from './modules/orders/orders.service';
import { PaymentsService } from './modules/payments/payments.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: OrdersService, useValue: { listAll: () => [] } },
        {
          provide: PaymentsService,
          useValue: { listIntents: () => [], listEvents: () => [] },
        },
        { provide: AuditService, useValue: { list: () => [] } },
      ],
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

  it('returns admin diagnostics summary', () => {
    const diag = appController.diagnostics();
    expect(diag.status).toBe('ok');
    expect(diag.modules.orders.status).toBe('ok');
    expect(diag.modules.payments.status).toBe('ok');
    expect(diag.modules.audit.status).toBe('ok');
  });
});
