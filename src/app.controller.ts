import { Controller, Get } from '@nestjs/common';

import { Public, Roles, SkipRateLimit } from './common/decorators';
import { AppService } from './app.service';
import { AuditService } from './modules/audit/audit.service';
import { ClinicsService } from './modules/clinics/clinics.service';
import { OrdersService } from './modules/orders/orders.service';
import { PaymentsService } from './modules/payments/payments.service';
import { SelfServiceService } from './modules/self-service/self-service.service';
import { SubscriptionsService } from './modules/subscriptions/subscriptions.service';
import { UsersService } from './modules/users/users.service';

@Controller()
export class AppController {
  private readonly bootAt = new Date();

  constructor(
    private readonly appService: AppService,
    private readonly orders: OrdersService,
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
    private readonly subscriptions: SubscriptionsService,
    private readonly selfService: SelfServiceService,
    private readonly clinics: ClinicsService,
    private readonly users: UsersService,
  ) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @SkipRateLimit()
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'fastinbox-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @SkipRateLimit()
  @Get('ready')
  ready() {
    const seedOk =
      this.clinics.list().length > 0 && this.users.list().length > 0;
    const uptimeMs = Date.now() - this.bootAt.getTime();
    return {
      status: 'ready',
      checks: {
        seed: seedOk ? 'ok' : 'pending',
        uptimeMs,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Roles('admin')
  @Get('admin/diagnostics')
  diagnostics() {
    const ordersAll = this.orders.listAll();
    const intents = this.payments.listIntents();
    const events = this.payments.listEvents();
    const auditEntries = this.audit.list();
    const uptimeMs = Date.now() - this.bootAt.getTime();
    return {
      status: 'ok',
      bootAt: this.bootAt.toISOString(),
      uptimeMs,
      modules: {
        orders: {
          status: 'ok',
          total: ordersAll.length,
          inProduction: ordersAll.filter((o) => o.status === 'IN_PRODUCTION')
            .length,
          delivered: ordersAll.filter((o) => o.status === 'DELIVERED').length,
        },
        payments: {
          status: 'ok',
          intents: intents.length,
          approved: intents.filter((i) => i.status === 'approved').length,
          failed: intents.filter((i) => i.status === 'failed').length,
          webhooksProcessed: events.filter(
            (e) => e.processingResult === 'processed',
          ).length,
          webhooksRejected: events.filter(
            (e) => e.processingResult === 'failed_terminal',
          ).length,
        },
        audit: {
          status: 'ok',
          totalEntries: auditEntries.length,
        },
        subscriptions: {
          status: 'ok',
          ...this.subscriptions.stats(),
        },
        selfService: {
          status: 'ok',
          codes: this.selfService.countActive(),
        },
      },
      timestamp: new Date().toISOString(),
    };
  }
}
