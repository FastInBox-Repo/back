import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';

import { Roles } from '../../common/decorators';
import { OrderEventsService } from './order-events.service';
import { OrdersService } from './orders.service';
import type { OrderStatus } from './order.entity';

interface AuthedRequest extends Request {
  user?: {
    userId: string;
    role: 'admin' | 'nutritionist' | 'kitchen' | 'patient';
    clinicId?: string;
  };
}

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly events: OrderEventsService,
  ) {}

  @Roles('admin', 'nutritionist')
  @Post()
  create(@Req() req: AuthedRequest, @Body() body: any) {
    return this.orders.create(req.user as any, body);
  }

  @Roles('admin', 'nutritionist')
  @Post(':id/submit')
  submit(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.orders.submit(req.user as any, id);
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
    return this.orders.startProduction(req.user as any, id);
  }

  @Roles('admin', 'kitchen')
  @Post(':id/mark-ready')
  markReady(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.orders.markReady(req.user as any, id);
  }

  @Roles('admin', 'kitchen')
  @Post(':id/mark-delivered')
  markDelivered(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.orders.markDelivered(req.user as any, id);
  }

  @Roles('admin', 'nutritionist')
  @Post(':id/cancel')
  cancel(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.orders.cancel(
      req.user as any,
      id,
      body?.reason ?? 'Cancelado pelo operador',
    );
  }
}
