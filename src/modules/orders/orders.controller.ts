import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { OrderItemRecord, SafeUser } from '../../common/types/domain.types';
import { OrdersService } from './orders.service';

interface CreateOrderBody {
  patientId?: string;
  kitchenId?: string;
  items?: OrderItemRecord[];
  notes?: string;
}

interface UpdateOrderStatusBody {
  status?: string;
}

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Roles('nutricionista')
  createOrder(@CurrentUser() user: SafeUser, @Body() body: CreateOrderBody) {
    return this.ordersService.createOrder(user, body);
  }

  @Get()
  @Roles('admin', 'nutricionista', 'paciente', 'cozinha')
  listOrders(@CurrentUser() user: SafeUser) {
    return this.ordersService.listOrdersByProfile(user);
  }

  @Public()
  @Get('code/:code')
  getByCode(@Param('code') code: string) {
    return this.ordersService.getOrderByCodeSafe(code);
  }

  @Patch(':id/status')
  @Roles('cozinha', 'admin')
  updateStatus(
    @Param('id') orderId: string,
    @CurrentUser() user: SafeUser,
    @Body() body: UpdateOrderStatusBody,
  ) {
    return this.ordersService.updateStatus(orderId, user, body);
  }

  @Patch(':id/confirm')
  @Roles('paciente')
  confirmOrder(@Param('id') orderId: string, @CurrentUser() user: SafeUser) {
    return this.ordersService.confirmOrder(orderId, user);
  }
}
