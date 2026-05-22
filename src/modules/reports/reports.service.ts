import { Injectable } from '@nestjs/common';

import { OrdersService } from '../orders/orders.service';
import type { Order, OrderStatus } from '../orders/order.entity';

export interface PeriodFilter {
  from?: Date;
  to?: Date;
  clinicId?: string;
  status?: OrderStatus;
}

export interface CommissionRow {
  clinicId: string;
  nutritionistId: string;
  ordersCount: number;
  subtotalCents: number;
  commissionCents: number;
  payoutCents: number;
}

export interface OperationsSummary {
  ordersByStatus: Record<OrderStatus, number>;
  revenueCents: number;
  commissionCents: number;
  payoutCents: number;
  totalOrders: number;
  averageTicketCents: number;
  paidOrders: number;
  deliveredOrders: number;
  conversionPct: number;
}

@Injectable()
export class ReportsService {
  constructor(private readonly orders: OrdersService) {}

  private applyFilter(filter: PeriodFilter): Order[] {
    return this.orders.listAll().filter((o) => {
      if (filter.clinicId && o.clinicId !== filter.clinicId) return false;
      if (filter.status && o.status !== filter.status) return false;
      if (filter.from && o.createdAt < filter.from) return false;
      if (filter.to && o.createdAt > filter.to) return false;
      return true;
    });
  }

  operationsSummary(filter: PeriodFilter): OperationsSummary {
    const orders = this.applyFilter(filter);
    const ordersByStatus = {
      DRAFT: 0,
      AWAITING_PATIENT_REVIEW: 0,
      AWAITING_PAYMENT: 0,
      PAYMENT_FAILED: 0,
      PAID: 0,
      IN_PRODUCTION: 0,
      READY_FOR_DELIVERY: 0,
      DELIVERED: 0,
      CANCELLED: 0,
    } as Record<OrderStatus, number>;
    let revenueCents = 0;
    let commissionCents = 0;
    let payoutCents = 0;
    let paid = 0;
    let delivered = 0;
    for (const o of orders) {
      ordersByStatus[o.status] += 1;
      if (
        o.status === 'PAID' ||
        o.status === 'IN_PRODUCTION' ||
        o.status === 'READY_FOR_DELIVERY' ||
        o.status === 'DELIVERED'
      ) {
        paid += 1;
        revenueCents += o.totalCents;
        commissionCents += o.commissionCents;
        payoutCents += o.totalCents - o.commissionCents;
      }
      if (o.status === 'DELIVERED') delivered += 1;
    }
    const totalOrders = orders.length;
    const averageTicketCents = paid > 0 ? Math.round(revenueCents / paid) : 0;
    const conversionPct =
      totalOrders > 0 ? Math.round((paid / totalOrders) * 1000) / 10 : 0;
    return {
      ordersByStatus,
      revenueCents,
      commissionCents,
      payoutCents,
      totalOrders,
      averageTicketCents,
      paidOrders: paid,
      deliveredOrders: delivered,
      conversionPct,
    };
  }

  commissionsByNutritionist(filter: PeriodFilter): CommissionRow[] {
    const orders = this.applyFilter(filter).filter(
      (o) =>
        o.status === 'PAID' ||
        o.status === 'IN_PRODUCTION' ||
        o.status === 'READY_FOR_DELIVERY' ||
        o.status === 'DELIVERED',
    );
    const rows = new Map<string, CommissionRow>();
    for (const o of orders) {
      const key = `${o.clinicId}|${o.nutritionistId}`;
      const row = rows.get(key) ?? {
        clinicId: o.clinicId,
        nutritionistId: o.nutritionistId,
        ordersCount: 0,
        subtotalCents: 0,
        commissionCents: 0,
        payoutCents: 0,
      };
      row.ordersCount += 1;
      row.subtotalCents += o.subtotalCents;
      row.commissionCents += o.commissionCents;
      row.payoutCents += o.totalCents - o.commissionCents;
      rows.set(key, row);
    }
    return [...rows.values()].sort((a, b) => b.commissionCents - a.commissionCents);
  }

  toCsvCommissions(rows: CommissionRow[]): string {
    const header =
      'clinicId,nutritionistId,ordersCount,subtotalCents,commissionCents,payoutCents';
    const lines = rows.map((r) =>
      [
        r.clinicId,
        r.nutritionistId,
        r.ordersCount,
        r.subtotalCents,
        r.commissionCents,
        r.payoutCents,
      ].join(','),
    );
    return [header, ...lines].join('\n');
  }
}
