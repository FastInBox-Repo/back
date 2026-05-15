import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { Public, Roles } from '../../common/decorators';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from './payments.service';

interface AuthedRequest extends Request {
  user?: { userId: string; role: string };
  rawBody?: string;
}

@Controller()
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly orders: OrdersService,
  ) {}

  @Public()
  @Post('public/orders/:code/payment-intent')
  createIntentByCode(@Param('code') code: string) {
    const order = this.orders.findByCode(code);
    return this.payments.createIntent(order.id);
  }

  @Public()
  @Post('payments/webhook')
  webhook(
    @Req() req: AuthedRequest,
    @Headers('x-signature') signature: string,
    @Headers('x-timestamp') timestamp: string,
  ) {
    const raw = req.rawBody ?? '';
    return this.payments.processWebhook(raw, signature, timestamp);
  }

  @Public()
  @Post('payments/simulate/:providerIntentId/approve')
  simulateApprove(@Param('providerIntentId') providerIntentId: string) {
    return this.payments.simulateApproval(providerIntentId);
  }

  @Public()
  @Post('payments/simulate/:providerIntentId/fail')
  simulateFail(@Param('providerIntentId') providerIntentId: string) {
    return this.payments.simulateFailure(providerIntentId);
  }

  @Roles('admin')
  @Get('payments/intents')
  list() {
    return this.payments.listIntents();
  }

  @Roles('admin')
  @Get('payments/events')
  events() {
    return this.payments.listEvents();
  }
}
