import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';

import { Roles } from '../../common/decorators';
import type { SessionToken } from '../auth/auth.service';
import { OrderEventsService } from './order-events.service';
import { OrdersService, type CreateOrderInput } from './orders.service';
import type { OrderStatus } from './order.entity';

interface AuthedRequest extends Request {
  user?: SessionToken;
}

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly events: OrderEventsService,
  ) {}

  @Roles('admin', 'nutritionist')
  @Post()
  create(@Req() req: AuthedRequest, @Body() body: CreateOrderInput) {
    return this.orders.create(req.user!, body);
  }

  @Roles('admin', 'nutritionist')
  @Post(':id/submit')
  submit(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.orders.submit(req.user!, id);
  }

  @Roles('admin', 'nutritionist', 'kitchen')
  @Get()
  list(
    @Req() req: AuthedRequest,
    @Query('status') status?: OrderStatus,
    @Query('kitchenId') kitchenId?: string,
  ) {
    const role = req.user!.role;
    return this.orders.list({
      clinicId: req.user!.clinicId!,
      nutritionistId: role === 'nutritionist' ? req.user!.userId : undefined,
      status,
      kitchenId,
    });
  }

  @Roles('admin', 'nutritionist', 'kitchen')
  @Get(':id')
  get(@Param('id') id: string) {
    return this.orders.findById(id);
  }

  @Roles('admin', 'nutritionist', 'kitchen')
  @Get(':id/history')
  history(@Param('id') id: string) {
    return this.events.list(id);
  }

  @Roles('admin', 'kitchen')
  @Post(':id/start-production')
  startProduction(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.orders.startProduction(req.user!, id);
  }

  @Roles('admin', 'kitchen')
  @Post(':id/mark-ready')
  markReady(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.orders.markReady(req.user!, id);
  }

  @Roles('admin', 'kitchen')
  @Post(':id/mark-delivered')
  markDelivered(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.orders.markDelivered(req.user!, id);
  }

  @Roles('admin', 'nutritionist')
  @Post(':id/cancel')
  cancel(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.orders.cancel(
      req.user!,
      id,
      body?.reason ?? 'Cancelado pelo operador',
    );
  }
}
