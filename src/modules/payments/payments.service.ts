import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  ConflictDomainError,
  UnauthorizedDomainError,
} from '../../common/domain-errors';
import { newId, nowUtc } from '../../common/ids';
import { OrderEventsService } from '../orders/order-events.service';
import { OrdersService } from '../orders/orders.service';
import { MockPaymentProvider } from './mock-provider';
import type { PaymentIntent, WebhookEvent } from './payment.entity';

const WEBHOOK_SECRET =
  process.env.PAYMENT_WEBHOOK_SECRET ?? 'fastinbox-webhook-secret';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly intents = new Map<string, PaymentIntent>();
  private readonly intentByOrder = new Map<string, string>();
  private readonly events = new Map<string, WebhookEvent>();

  constructor(
    private readonly orders: OrdersService,
    private readonly orderEvents: OrderEventsService,
    private readonly provider: MockPaymentProvider,
  ) {}

  createIntent(orderId: string): PaymentIntent {
    const order = this.orders.findById(orderId);
    if (order.status !== 'AWAITING_PAYMENT') {
      throw new ConflictDomainError('PAYMENT_ORDER_NOT_READY');
    }
    const existingId = this.intentByOrder.get(orderId);
    if (existingId) {
      const existing = this.intents.get(existingId);
      if (existing && existing.status === 'pending') return existing;
    }
    const providerIntent = this.provider.createIntent(
      order.id,
      order.totalCents,
    );
    const now = nowUtc();
    const intent: PaymentIntent = {
      id: newId(),
      providerIntentId: providerIntent.providerIntentId,
      orderId: order.id,
      amountCents: order.totalCents,
      currency: 'BRL',
      status: 'pending',
      redirectUrl: providerIntent.redirectUrl,
      expiresAt: providerIntent.expiresAt,
      createdAt: now,
      updatedAt: now,
    };
    this.intents.set(intent.id, intent);
    this.intentByOrder.set(order.id, intent.id);
    this.orderEvents.record({
      orderId: order.id,
      eventType: 'payment.intent.created',
      metadata: {
        intentId: intent.id,
        providerIntentId: intent.providerIntentId,
        amountCents: intent.amountCents,
      },
    });
    return intent;
  }

  getIntentByOrder(orderId: string): PaymentIntent | undefined {
    const id = this.intentByOrder.get(orderId);
    return id ? this.intents.get(id) : undefined;
  }

  simulateApproval(providerIntentId: string) {
    return this.processSimulatedEvent(providerIntentId, 'payment.approved');
  }

  simulateFailure(providerIntentId: string) {
    return this.processSimulatedEvent(providerIntentId, 'payment.failed');
  }

  processWebhook(
    rawBody: string,
    signature: string | undefined,
    timestamp: string | undefined,
  ) {
    if (!signature)
      throw new UnauthorizedDomainError('WEBHOOK_SIGNATURE_MISSING');
    const expected = signWebhook(rawBody, timestamp ?? '', WEBHOOK_SECRET);
    if (!safeEqualHex(signature, expected))
      throw new UnauthorizedDomainError('WEBHOOK_SIGNATURE_INVALID');
    const ts = Number.parseInt(timestamp ?? '0', 10);
    if (!ts || Math.abs(Date.now() - ts) > 5 * 60_000) {
      throw new UnauthorizedDomainError('WEBHOOK_TIMESTAMP_INVALID');
    }
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      throw new UnauthorizedDomainError('WEBHOOK_PAYLOAD_INVALID');
    }
    return this.processEvent(payload, true);
  }

  private processSimulatedEvent(providerIntentId: string, eventType: string) {
    return this.processEvent(
      {
        id: `evt_${newId()}`,
        type: eventType,
        data: { providerIntentId },
      },
      false,
    );
  }

  private processEvent(
    payload: Record<string, unknown>,
    signatureValid: boolean,
  ) {
    const idCandidate =
      typeof payload.id === 'string' ? payload.id : `evt_${newId()}`;
    const providerEventId = idCandidate;
    const existing = this.events.get(providerEventId);
    if (existing) {
      existing.attempts += 1;
      return { duplicated: true, providerEventId };
    }
    const eventType =
      typeof payload.type === 'string' ? payload.type : 'unknown';
    const data: { providerIntentId?: string } =
      payload.data && typeof payload.data === 'object'
        ? (payload.data as { providerIntentId?: string })
        : {};
    const intent = this.findIntentByProvider(
      String(data.providerIntentId ?? ''),
    );
    const event: WebhookEvent = {
      id: newId(),
      providerEventId,
      eventType,
      payload,
      signatureValid,
      processingResult: 'pending',
      attempts: 1,
      createdAt: nowUtc(),
    };
    this.events.set(providerEventId, event);

    if (!intent) {
      event.processingResult = 'failed_terminal';
      event.processedAt = nowUtc();
      return { duplicated: false, providerEventId, status: 'unknown_intent' };
    }

    if (eventType === 'payment.approved') {
      intent.status = 'approved';
      intent.updatedAt = nowUtc();
      this.orders.markAsPaid(intent.orderId);
    } else if (eventType === 'payment.failed') {
      intent.status = 'failed';
      intent.updatedAt = nowUtc();
      this.orders.markPaymentFailure(intent.orderId, 'webhook_failed');
    } else if (eventType === 'payment.refunded') {
      intent.status = 'refunded';
      intent.updatedAt = nowUtc();
    } else {
      this.logger.log(`Unhandled webhook event type ${eventType}`);
    }
    event.processingResult = 'processed';
    event.processedAt = nowUtc();
    return { duplicated: false, providerEventId, status: intent.status };
  }

  private findIntentByProvider(
    providerIntentId: string,
  ): PaymentIntent | undefined {
    for (const intent of this.intents.values()) {
      if (intent.providerIntentId === providerIntentId) return intent;
    }
    return undefined;
  }

  listEvents(): WebhookEvent[] {
    return [...this.events.values()];
  }

  listIntents(): PaymentIntent[] {
    return [...this.intents.values()];
  }
}

function signWebhook(body: string, timestamp: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}
