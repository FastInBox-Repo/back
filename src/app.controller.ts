import { Controller, Get } from '@nestjs/common';

import { Public, Roles } from './common/decorators';
import { AppService } from './app.service';
import { AuditService } from './modules/audit/audit.service';
import { OrdersService } from './modules/orders/orders.service';
import { PaymentsService } from './modules/payments/payments.service';

@Controller()
export class AppController {
  private readonly bootAt = new Date();

  constructor(
    private readonly appService: AppService,
    private readonly orders: OrdersService,
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
  ) {}

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
      },
      timestamp: new Date().toISOString(),
    };
  }
}
