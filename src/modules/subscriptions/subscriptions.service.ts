import { Injectable, Logger } from '@nestjs/common';

import {
  ForbiddenDomainError,
  NotFoundDomainError,
  ValidationDomainError,
} from '../../common/domain-errors';
import { newId, nowUtc } from '../../common/ids';
import { ClinicsService } from '../clinics/clinics.service';
import { IngredientsService } from '../ingredients/ingredients.service';
import { OrdersService } from '../orders/orders.service';
import { PatientsService } from '../patients/patients.service';
import { PricingService } from '../orders/pricing.service';
import type { CreateOrderInput } from '../orders/orders.service';
import type { OrderItem } from '../orders/order.entity';
import {
  CADENCE_DAYS,
  type Subscription,
  type SubscriptionCadence,
  type SubscriptionItem,
} from './subscription.entity';

export interface SubscriptionActor {
  userId: string;
  role: 'admin' | 'nutritionist';
  clinicId?: string;
}

export interface CreateSubscriptionInput {
  patientId: string;
  cadence: SubscriptionCadence;
  items: SubscriptionItem[];
  deliveryWindow: { slot: string; regionCode?: string };
  startDate?: string;
  clinicId?: string;
}

export interface RunDueResult {
  processedAt: string;
  dueCount: number;
  ordersCreated: number;
  failures: { subscriptionId: string; reason: string }[];
}

export interface SubscriptionStats {
  total: number;
  active: number;
  paused: number;
  cancelled: number;
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  private readonly subscriptions = new Map<string, Subscription>();

  constructor(
    private readonly orders: OrdersService,
    private readonly patients: PatientsService,
    private readonly clinics: ClinicsService,
    private readonly pricing: PricingService,
    private readonly catalog: IngredientsService,
  ) {}

  create(
    actor: SubscriptionActor,
    input: CreateSubscriptionInput,
  ): Subscription {
    const clinicId = actor.role === 'admin' ? input.clinicId : actor.clinicId;
    if (!clinicId) {
      throw new ValidationDomainError(
        'SUBSCRIPTION_CLINIC_REQUIRED',
        'clinicId obrigatorio para esta operacao',
      );
    }
    if (!input.items || input.items.length === 0) {
      throw new ValidationDomainError(
        'SUBSCRIPTION_ITEMS_REQUIRED',
        'Assinatura precisa de ao menos um item',
      );
    }

    const patient = this.patients.findById(input.patientId);
    if (patient.clinicId !== clinicId) {
      throw new ForbiddenDomainError('SUBSCRIPTION_PATIENT_FOREIGN_TENANT');
    }

    const estimatedTotalCents = this.estimateTotal(clinicId, input.items);
    const startDate = input.startDate ?? todayIso();
    const now = nowUtc();
    const subscription: Subscription = {
      id: newId(),
      clinicId,
      nutritionistId:
        actor.role === 'nutritionist' ? actor.userId : patient.nutritionistId,
      patientId: patient.id,
      status: 'active',
      cadence: input.cadence,
      items: input.items.map((it) => ({
        compositionId: it.compositionId,
        packagingId: it.packagingId,
        quantity: Math.max(1, it.quantity),
      })),
      deliveryWindow: input.deliveryWindow,
      estimatedTotalCents,
      startDate,
      nextRunDate: startDate,
      generatedOrderIds: [],
      createdAt: now,
      updatedAt: now,
    };
    this.subscriptions.set(subscription.id, subscription);
    return subscription;
  }

  findById(id: string): Subscription {
    const sub = this.subscriptions.get(id);
    if (!sub) throw new NotFoundDomainError('SUBSCRIPTION_NOT_FOUND');
    return sub;
  }

  list(filter: {
    clinicId?: string;
    nutritionistId?: string;
    status?: Subscription['status'];
  }): Subscription[] {
    return [...this.subscriptions.values()]
      .filter((s) => !filter.clinicId || s.clinicId === filter.clinicId)
      .filter(
        (s) =>
          !filter.nutritionistId || s.nutritionistId === filter.nutritionistId,
      )
      .filter((s) => !filter.status || s.status === filter.status)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  listAll(): Subscription[] {
    return [...this.subscriptions.values()];
  }

  getScoped(actor: SubscriptionActor, id: string): Subscription {
    return this.requireOwned(actor, id);
  }

  pause(actor: SubscriptionActor, id: string): Subscription {
    const sub = this.requireOwned(actor, id);
    if (sub.status !== 'active') {
      throw new ValidationDomainError(
        'SUBSCRIPTION_NOT_ACTIVE',
        'Apenas assinaturas ativas podem ser pausadas',
      );
    }
    sub.status = 'paused';
    sub.updatedAt = nowUtc();
    return sub;
  }

  resume(actor: SubscriptionActor, id: string): Subscription {
    const sub = this.requireOwned(actor, id);
    if (sub.status !== 'paused') {
      throw new ValidationDomainError(
        'SUBSCRIPTION_NOT_PAUSED',
        'Apenas assinaturas pausadas podem ser retomadas',
      );
    }
    sub.status = 'active';
    sub.updatedAt = nowUtc();
    return sub;
  }

  cancel(actor: SubscriptionActor, id: string): Subscription {
    const sub = this.requireOwned(actor, id);
    if (sub.status === 'cancelled') {
      throw new ValidationDomainError(
        'SUBSCRIPTION_ALREADY_CANCELLED',
        'Assinatura ja cancelada',
      );
    }
    sub.status = 'cancelled';
    sub.cancelledAt = nowUtc();
    sub.updatedAt = nowUtc();
    return sub;
  }

  runDue(now: Date = nowUtc()): RunDueResult {
    const today = isoFromDate(now);
    const failures: { subscriptionId: string; reason: string }[] = [];
    let ordersCreated = 0;
    let dueCount = 0;

    for (const sub of this.subscriptions.values()) {
      if (sub.status !== 'active') continue;
      if (sub.nextRunDate > today) continue;
      dueCount += 1;
      try {
        const input: CreateOrderInput = {
          patientId: sub.patientId,
          deliveryWindow: {
            date: sub.nextRunDate,
            slot: sub.deliveryWindow.slot,
            regionCode: sub.deliveryWindow.regionCode,
          },
          items: sub.items.map((it) => ({
            compositionId: it.compositionId,
            packagingId: it.packagingId,
            quantity: it.quantity,
          })),
          notes: `Pedido gerado pela assinatura ${sub.id}`,
        };
        const actor = {
          userId: sub.nutritionistId,
          role: 'nutritionist' as const,
          clinicId: sub.clinicId,
        };
        const order = this.orders.create(actor, input);
        this.orders.submit(actor, order.id);
        sub.generatedOrderIds.push(order.id);
        sub.lastRunDate = sub.nextRunDate;
        sub.nextRunDate = addDaysIso(
          sub.nextRunDate,
          CADENCE_DAYS[sub.cadence],
        );
        sub.updatedAt = nowUtc();
        ordersCreated += 1;
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `subscription.runDue.failed id=${sub.id} reason=${reason}`,
        );
        failures.push({ subscriptionId: sub.id, reason });
      }
    }

    return {
      processedAt: now.toISOString(),
      dueCount,
      ordersCreated,
      failures,
    };
  }

  stats(clinicId?: string): SubscriptionStats {
    const subs = [...this.subscriptions.values()].filter(
      (s) => !clinicId || s.clinicId === clinicId,
    );
    return {
      total: subs.length,
      active: subs.filter((s) => s.status === 'active').length,
      paused: subs.filter((s) => s.status === 'paused').length,
      cancelled: subs.filter((s) => s.status === 'cancelled').length,
    };
  }

  private estimateTotal(clinicId: string, items: SubscriptionItem[]): number {
    const clinic = this.clinics.findById(clinicId);
    const pseudoItems = items.map<OrderItem>((it) => {
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
        customizations: [],
        priceVersionSnapshot: {
          effectiveAt: nowUtc().toISOString(),
          pricingRulesVersion: 'v1.0',
        },
      };
    });
    return this.pricing.calculate(pseudoItems, clinic).totalCents;
  }

  private requireOwned(actor: SubscriptionActor, id: string): Subscription {
    const sub = this.findById(id);
    if (actor.role === 'admin') return sub;
    if (sub.clinicId !== actor.clinicId) {
      throw new ForbiddenDomainError('SUBSCRIPTION_FOREIGN_TENANT');
    }
    return sub;
  }
}

export function todayIso(): string {
  return isoFromDate(new Date());
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isoFromDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
