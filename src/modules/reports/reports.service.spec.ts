import { Test, TestingModule } from '@nestjs/testing';

import { OrdersService } from '../orders/orders.service';
import { ReportsService } from './reports.service';
import type { Order } from '../orders/order.entity';

function makeOrder(partial: Partial<Order>): Order {
  const base: Order = {
    id: 'o1',
    code: 'FIB',
    clinicId: 'c1',
    nutritionistId: 'n1',
    patientId: 'p1',
    status: 'DRAFT',
    paymentStatus: 'pending',
    items: [],
    subtotalCents: 10000,
    discountCents: 0,
    commissionCents: 2000,
    totalCents: 10000,
    createdAt: new Date('2026-05-01T12:00:00Z'),
    updatedAt: new Date('2026-05-01T12:00:00Z'),
    version: 1,
  };
  return { ...base, ...partial };
}

describe('ReportsService', () => {
  let reports: ReportsService;
  const orders: Order[] = [
    makeOrder({ id: 'o1', status: 'DELIVERED' }),
    makeOrder({ id: 'o2', status: 'PAID', totalCents: 20000, commissionCents: 4000 }),
    makeOrder({ id: 'o3', status: 'CANCELLED' }),
    makeOrder({ id: 'o4', status: 'IN_PRODUCTION', nutritionistId: 'n2', totalCents: 5000, commissionCents: 1000 }),
  ];

  beforeEach(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: OrdersService, useValue: { listAll: () => orders } },
      ],
    }).compile();
    reports = mod.get(ReportsService);
  });

  it('summarises operations and revenue', () => {
    const s = reports.operationsSummary({});
    expect(s.totalOrders).toBe(4);
    expect(s.paidOrders).toBe(3);
    expect(s.deliveredOrders).toBe(1);
    expect(s.revenueCents).toBe(10000 + 20000 + 5000);
    expect(s.commissionCents).toBe(2000 + 4000 + 1000);
    expect(s.payoutCents).toBe(35000 - 7000);
  });

  it('groups commissions by nutritionist', () => {
    const rows = reports.commissionsByNutritionist({});
    expect(rows).toHaveLength(2);
    const top = rows[0];
    expect(top.nutritionistId).toBe('n1');
    expect(top.ordersCount).toBe(2);
    expect(top.commissionCents).toBe(6000);
  });

  it('exports commissions as csv', () => {
    const rows = reports.commissionsByNutritionist({});
    const csv = reports.toCsvCommissions(rows);
    expect(csv.split('\n')[0]).toContain('clinicId,nutritionistId');
    expect(csv).toContain('n1');
    expect(csv).toContain('n2');
  });
});
