import { Injectable, Logger } from '@nestjs/common';

import {
  ConflictDomainError,
  ForbiddenDomainError,
  NotFoundDomainError,
  ValidationDomainError,
} from '../../common/domain-errors';
import { newId, nowUtc } from '../../common/ids';
import { ClinicsService } from '../clinics/clinics.service';
import { IngredientsService } from '../ingredients/ingredients.service';
import { PatientsService } from '../patients/patients.service';
import { OrderCodesService } from './order-codes.service';
import { OrderEventsService } from './order-events.service';
import { PricingService } from './pricing.service';
import {
  STATUS_TRANSITIONS,
  type Order,
  type OrderItem,
  type OrderStatus,
} from './order.entity';

interface ActorContext {
  userId?: string;
  role?: 'admin' | 'nutritionist' | 'kitchen' | 'patient' | 'public';
  clinicId?: string;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly orders = new Map<string, Order>();
  private kitchenRoundRobin = new Map<string, number>();

  constructor(
    private readonly clinics: ClinicsService,
    private readonly patients: PatientsService,
    private readonly catalog: IngredientsService,
    private readonly codes: OrderCodesService,
    private readonly events: OrderEventsService,
    private readonly pricing: PricingService,
  ) {}

  create(
    actor: ActorContext,
    input: {
      patientId: string;
      deliveryWindow?: Order['deliveryWindow'];
      items: {
        compositionId?: string;
        packagingId: string;
        quantity: number;
        customizations?: OrderItem['customizations'];
      }[];
      notes?: string;
    },
  ): Order {
    if (
      !actor.clinicId ||
      !actor.userId ||
      (actor.role !== 'nutritionist' && actor.role !== 'admin')
    ) {
      throw new ForbiddenDomainError('ORDER_CREATE_FORBIDDEN');
    }
    const patient = this.patients.findById(input.patientId);
    if (patient.clinicId !== actor.clinicId)
      throw new ForbiddenDomainError('ORDER_PATIENT_FOREIGN_TENANT');

    const clinic = this.clinics.findById(actor.clinicId);
    const items = input.items.map<OrderItem>((it) => {
      const packaging = this.catalog.findPackaging(it.packagingId);
      const composition = it.compositionId
        ? this.catalog.findComposition(it.compositionId)
        : undefined;
      const unitPriceCents =
        (composition?.basePriceCents ?? 0) + packaging.unitCostCents;
      return {
        id: newId(),
        compositionId: composition?.id,
        packagingId: packaging.id,
        quantity: Math.max(1, it.quantity),
        unitPriceCents,
        customizations: it.customizations ?? [],
        priceVersionSnapshot: {
          effectiveAt: nowUtc().toISOString(),
          pricingRulesVersion: 'v1.0',
        },
      };
    });

    const totals = this.pricing.calculate(items, clinic);
    const now = nowUtc();
    const order: Order = {
      id: newId(),
      code: '',
      clinicId: actor.clinicId,
      nutritionistId:
        actor.role === 'nutritionist' ? actor.userId : patient.nutritionistId,
      patientId: patient.id,
      status: 'DRAFT',
      paymentStatus: 'pending',
      items,
      subtotalCents: totals.subtotalCents,
      discountCents: totals.discountCents,
      commissionCents: totals.commissionCents,
      totalCents: totals.totalCents,
      deliveryWindow: input.deliveryWindow,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    this.orders.set(order.id, order);
    this.events.record({
      orderId: order.id,
      eventType: 'order.created',
      actorId: actor.userId,
      actorRole: actor.role,
      nextStatus: 'DRAFT',
    });
    return order;
  }

  submit(actor: ActorContext, orderId: string): Order {
    const order = this.findById(orderId);
    this.assertSameTenant(actor, order);
    if (order.status !== 'DRAFT')
      throw new ConflictDomainError('ORDER_INVALID_TRANSITION');
    const code = this.codes.generate(order.id);
    const next = this.transition(order, 'AWAITING_PATIENT_REVIEW', actor, {
      code: code.code,
    });
    next.code = code.code;
    return next;
  }

  patientConfirm(actor: ActorContext, orderId: string): Order {
    const order = this.findById(orderId);
    if (order.status !== 'AWAITING_PATIENT_REVIEW')
      throw new ConflictDomainError('ORDER_INVALID_TRANSITION');
    const next = this.transition(order, 'AWAITING_PAYMENT', actor);
    next.confirmedAt = nowUtc();
    return next;
  }

  markPaymentFailure(orderId: string, reason: string): Order {
    const order = this.findById(orderId);
    if (order.status !== 'AWAITING_PAYMENT')
      throw new ConflictDomainError('ORDER_INVALID_TRANSITION');
    order.paymentStatus = 'failed';
    return this.transition(
      order,
      'PAYMENT_FAILED',
      { role: 'public' },
      { reason },
    );
  }

  markAsPaid(orderId: string): Order {
    const order = this.findById(orderId);
    if (
      order.status !== 'AWAITING_PAYMENT' &&
      order.status !== 'PAYMENT_FAILED'
    ) {
      throw new ConflictDomainError('ORDER_INVALID_TRANSITION');
    }
    if (!order.kitchenId) {
      order.kitchenId = this.assignKitchen(order.clinicId);
    }
    order.paymentStatus = 'approved';
    order.paidAt = nowUtc();
    return this.transition(
      order,
      'PAID',
      { role: 'public' },
      { kitchenId: order.kitchenId },
    );
  }

  startProduction(actor: ActorContext, orderId: string): Order {
    const order = this.findById(orderId);
    if (actor.role !== 'kitchen' && actor.role !== 'admin')
      throw new ForbiddenDomainError('ORDER_KITCHEN_FORBIDDEN');
    if (order.status !== 'PAID')
      throw new ConflictDomainError('ORDER_INVALID_TRANSITION');
    return this.transition(order, 'IN_PRODUCTION', actor);
  }

  markReady(actor: ActorContext, orderId: string): Order {
    const order = this.findById(orderId);
    if (actor.role !== 'kitchen' && actor.role !== 'admin')
      throw new ForbiddenDomainError('ORDER_KITCHEN_FORBIDDEN');
    if (order.status !== 'IN_PRODUCTION')
      throw new ConflictDomainError('ORDER_INVALID_TRANSITION');
    order.producedAt = nowUtc();
    return this.transition(order, 'READY_FOR_DELIVERY', actor);
  }

  markDelivered(actor: ActorContext, orderId: string): Order {
    const order = this.findById(orderId);
    if (actor.role !== 'kitchen' && actor.role !== 'admin')
      throw new ForbiddenDomainError('ORDER_KITCHEN_FORBIDDEN');
    if (order.status !== 'READY_FOR_DELIVERY')
      throw new ConflictDomainError('ORDER_INVALID_TRANSITION');
    order.deliveredAt = nowUtc();
    return this.transition(order, 'DELIVERED', actor);
  }

  cancel(actor: ActorContext, orderId: string, reason: string): Order {
    const order = this.findById(orderId);
    if (order.status === 'DELIVERED' || order.status === 'CANCELLED') {
      throw new ConflictDomainError('ORDER_INVALID_TRANSITION');
    }
    order.cancelledAt = nowUtc();
    return this.transition(order, 'CANCELLED', actor, { reason });
  }

  editItemQuantity(
    actor: ActorContext,
    code: string,
    itemId: string,
    nextQuantity: number,
  ): Order {
    const record = this.codes.validate(code);
    const order = this.findById(record.orderId);
    if (order.status !== 'AWAITING_PATIENT_REVIEW')
      throw new ConflictDomainError('ORDER_LOCKED');
    if (nextQuantity < 1 || nextQuantity > 5) {
      throw new ValidationDomainError(
        'ORDER_QUANTITY_OUT_OF_RANGE',
        'Quantidade deve estar entre 1 e 5',
      );
    }
    const item = order.items.find((it) => it.id === itemId);
    if (!item) throw new NotFoundDomainError('ORDER_ITEM_NOT_FOUND');
    const previous = item.quantity;
    item.quantity = nextQuantity;
    this.recalculate(order);
    if (order.totalCents > Math.round(this.subtotalCap(order) * 1.25)) {
      item.quantity = previous;
      this.recalculate(order);
      throw new ValidationDomainError(
        'ORDER_EDIT_EXCEEDS_CAP',
        'Edicao excede o teto permitido pelo nutricionista',
      );
    }
    order.updatedAt = nowUtc();
    order.version += 1;
    this.events.record({
      orderId: order.id,
      eventType: 'order.item.updated',
      actorId: actor.userId,
      actorRole: actor.role,
      metadata: { itemId, previousQuantity: previous, nextQuantity },
    });
    return order;
  }

  findById(id: string): Order {
    const order = this.orders.get(id);
    if (!order) throw new NotFoundDomainError('ORDER_NOT_FOUND');
    return order;
  }

  findByCode(rawCode: string): Order {
    const record = this.codes.validate(rawCode);
    return this.findById(record.orderId);
  }

  list(filter: {
    clinicId: string;
    nutritionistId?: string;
    status?: OrderStatus;
    kitchenId?: string;
  }): Order[] {
    return [...this.orders.values()]
      .filter((o) => o.clinicId === filter.clinicId)
      .filter(
        (o) =>
          !filter.nutritionistId || o.nutritionistId === filter.nutritionistId,
      )
      .filter((o) => !filter.status || o.status === filter.status)
      .filter((o) => !filter.kitchenId || o.kitchenId === filter.kitchenId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  listAll(): Order[] {
    return [...this.orders.values()];
  }

  setKitchenForExistingOrder(orderId: string, kitchenId: string) {
    const order = this.findById(orderId);
    order.kitchenId = kitchenId;
  }

  private assignKitchen(clinicId: string): string {
    const kitchens = [
      'kitchen-' + clinicId.slice(0, 8) + '-A',
      'kitchen-' + clinicId.slice(0, 8) + '-B',
    ];
    const counter =
      (this.kitchenRoundRobin.get(clinicId) ?? 0) % kitchens.length;
    this.kitchenRoundRobin.set(clinicId, counter + 1);
    return kitchens[counter];
  }

  private transition(
    order: Order,
    next: OrderStatus,
    actor: ActorContext,
    metadata?: Record<string, unknown>,
  ): Order {
    const allowed = STATUS_TRANSITIONS[order.status];
    if (!allowed.includes(next))
      throw new ConflictDomainError('ORDER_INVALID_TRANSITION');
    const previous = order.status;
    order.status = next;
    order.updatedAt = nowUtc();
    order.version += 1;
    this.events.record({
      orderId: order.id,
      eventType: `order.${previous.toLowerCase()}->${next.toLowerCase()}`,
      actorId: actor.userId,
      actorRole: actor.role,
      previousStatus: previous,
      nextStatus: next,
      metadata,
    });
    return order;
  }

  private recalculate(order: Order) {
    const clinic = this.clinics.findById(order.clinicId);
    const totals = this.pricing.calculate(
      order.items,
      clinic,
      order.discountCents,
    );
    order.subtotalCents = totals.subtotalCents;
    order.commissionCents = totals.commissionCents;
    order.totalCents = totals.totalCents;
  }

  private subtotalCap(order: Order): number {
    return order.items.reduce((acc, it) => acc + it.unitPriceCents, 0);
  }

  private assertSameTenant(actor: ActorContext, order: Order) {
    if (actor.role === 'admin') return;
    if (actor.clinicId !== order.clinicId)
      throw new ForbiddenDomainError('ORDER_FOREIGN_TENANT');
  }
}
