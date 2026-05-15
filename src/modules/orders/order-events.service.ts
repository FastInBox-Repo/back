import { Injectable } from '@nestjs/common';

import { newId, nowUtc } from '../../common/ids';
import type { OrderEvent, OrderStatus } from './order.entity';

@Injectable()
export class OrderEventsService {
  private readonly events: OrderEvent[] = [];

  record(input: {
    orderId: string;
    eventType: string;
    actorId?: string;
    actorRole?: string;
    previousStatus?: OrderStatus;
    nextStatus?: OrderStatus;
    metadata?: Record<string, unknown>;
  }): OrderEvent {
    const event: OrderEvent = { id: newId(), occurredAt: nowUtc(), ...input };
    this.events.push(event);
    return event;
  }

  list(orderId: string): OrderEvent[] {
    return this.events
      .filter((e) => e.orderId === orderId)
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  }

  listAll(filter: { actorId?: string; eventType?: string } = {}): OrderEvent[] {
    return this.events
      .filter((e) => !filter.actorId || e.actorId === filter.actorId)
      .filter((e) => !filter.eventType || e.eventType === filter.eventType);
  }
}
