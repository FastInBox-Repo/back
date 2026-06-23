import { Test, TestingModule } from '@nestjs/testing';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditService } from './modules/audit/audit.service';
import { ClinicsService } from './modules/clinics/clinics.service';
import { OrdersService } from './modules/orders/orders.service';
import { PaymentsService } from './modules/payments/payments.service';
import { SelfServiceService } from './modules/self-service/self-service.service';
import { SubscriptionsService } from './modules/subscriptions/subscriptions.service';
import { UsersService } from './modules/users/users.service';

async function buildController(
  opts: {
    clinics?: unknown[];
    users?: unknown[];
  } = {},
): Promise<AppController> {
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
      {
        provide: SubscriptionsService,
        useValue: {
          stats: () => ({ total: 0, active: 0, paused: 0, cancelled: 0 }),
        },
      },
      { provide: SelfServiceService, useValue: { countActive: () => 0 } },
      {
        provide: ClinicsService,
        useValue: { list: () => opts.clinics ?? [{ id: 'c1' }] },
      },
      {
        provide: UsersService,
        useValue: { list: () => opts.users ?? [{ id: 'u1' }] },
      },
    ],
  }).compile();
  return app.get<AppController>(AppController);
}

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    appController = await buildController();
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
    expect(diag.modules.subscriptions.status).toBe('ok');
    expect(diag.modules.selfService.status).toBe('ok');
  });

  it('reports readiness as ok when seed data is present', () => {
    const ready = appController.ready();
    expect(ready.status).toBe('ready');
    expect(ready.checks.seed).toBe('ok');
    expect(typeof ready.checks.uptimeMs).toBe('number');
    expect(ready.checks.uptimeMs).toBeGreaterThanOrEqual(0);
  });

  it('reports readiness as pending when seed data is missing', async () => {
    const empty = await buildController({ clinics: [], users: [] });
    const ready = empty.ready();
    expect(ready.checks.seed).toBe('pending');
  });
});
