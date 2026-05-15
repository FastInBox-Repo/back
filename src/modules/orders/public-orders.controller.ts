import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import { Public } from '../../common/decorators';
import { ClinicsService } from '../clinics/clinics.service';
import { OrdersService } from './orders.service';
import type { Order } from './order.entity';

@Controller('public/orders')
export class PublicOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly clinics: ClinicsService,
  ) {}

  @Public()
  @Get(':code')
  view(@Param('code') code: string) {
    const order = this.orders.findByCode(code);
    return this.project(order);
  }

  @Public()
  @Patch(':code/items/:itemId')
  edit(
    @Param('code') code: string,
    @Param('itemId') itemId: string,
    @Body() body: { quantity: number },
  ) {
    const order = this.orders.editItemQuantity(
      { role: 'patient' },
      code,
      itemId,
      body.quantity,
    );
    return this.project(order);
  }

  @Public()
  @Post(':code/confirm')
  confirm(@Param('code') code: string) {
    const order = this.orders.findByCode(code);
    const updated = this.orders.patientConfirm({ role: 'patient' }, order.id);
    return this.project(updated);
  }

  private project(order: Order) {
    const clinic = this.clinics.findById(order.clinicId);
    return {
      code: order.code,
      status: order.status,
      paymentStatus: order.paymentStatus,
      clinic: {
        id: clinic.id,
        name: clinic.name,
        logoUrl: clinic.logoUrl,
        primaryColor: clinic.primaryColor,
        secondaryColor: clinic.secondaryColor,
      },
      items: order.items.map((it) => ({
        id: it.id,
        compositionId: it.compositionId,
        packagingId: it.packagingId,
        quantity: it.quantity,
        unitPriceCents: it.unitPriceCents,
      })),
      subtotalCents: order.subtotalCents,
      commissionCents: order.commissionCents,
      totalCents: order.totalCents,
      deliveryWindow: order.deliveryWindow,
      allowedActions:
        order.status === 'AWAITING_PATIENT_REVIEW'
          ? ['edit', 'confirm']
          : order.status === 'AWAITING_PAYMENT'
            ? ['pay']
            : ['view'],
    };
  }
}
