import { Injectable } from '@nestjs/common';

import { OrdersService } from '../orders/orders.service';
import type { Order } from '../orders/order.entity';

export interface QueueGroup {
  windowDate: string;
  windowSlot: string;
  regionCode: string;
  orders: Order[];
}

@Injectable()
export class KitchenQueueService {
  constructor(private readonly orders: OrdersService) {}

  listQueue(kitchenId: string): QueueGroup[] {
    const all = this.orders
      .listAll()
      .filter(
        (o) =>
          o.kitchenId === kitchenId &&
          ['PAID', 'IN_PRODUCTION', 'READY_FOR_DELIVERY'].includes(o.status),
      );
    const map = new Map<string, QueueGroup>();
    for (const order of all) {
      const date = order.deliveryWindow?.date ?? 'sem-data';
      const slot = order.deliveryWindow?.slot ?? 'sem-slot';
      const region = order.deliveryWindow?.regionCode ?? 'geral';
      const key = `${date}|${slot}|${region}`;
      const group = map.get(key) ?? {
        windowDate: date,
        windowSlot: slot,
        regionCode: region,
        orders: [],
      };
      group.orders.push(order);
      map.set(key, group);
    }
    return [...map.values()].sort((a, b) =>
      `${a.windowDate}${a.windowSlot}`.localeCompare(
        `${b.windowDate}${b.windowSlot}`,
      ),
    );
  }

  countPendingByWindow(kitchenId: string, date: string, slot: string): number {
    return this.orders
      .listAll()
      .filter(
        (o) =>
          o.kitchenId === kitchenId &&
          o.status !== 'DELIVERED' &&
          o.status !== 'CANCELLED' &&
          o.deliveryWindow?.date === date &&
          o.deliveryWindow?.slot === slot,
      ).length;
  }
}
