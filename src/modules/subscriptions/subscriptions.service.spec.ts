import { DomainError } from '../../common/domain-errors';
import { ClinicsService } from '../clinics/clinics.service';
import { IngredientsService } from '../ingredients/ingredients.service';
import { OrderCodesService } from '../orders/order-codes.service';
import { OrderEventsService } from '../orders/order-events.service';
import { OrdersService } from '../orders/orders.service';
import { PatientsService } from '../patients/patients.service';
import { PricingService } from '../orders/pricing.service';
import { SubscriptionsService } from './subscriptions.service';
import { addDaysIso } from './subscriptions.service';

function expectDomainCode(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).getResponse()).toMatchObject({ code });
    return;
  }
  throw new Error(`Expected to throw domain error ${code}`);
}

interface Fixture {
  subscriptions: SubscriptionsService;
  orders: OrdersService;
  clinicId: string;
  nutritionistId: string;
  patientId: string;
  compositionId: string;
  packagingId: string;
}

function buildFixture(): Fixture {
  const clinics = new ClinicsService();
  const patients = new PatientsService();
  const catalog = new IngredientsService();
  const codes = new OrderCodesService();
  const events = new OrderEventsService();
  const pricing = new PricingService();
  const orders = new OrdersService(
    clinics,
    patients,
    catalog,
    codes,
    events,
    pricing,
  );
  const subscriptions = new SubscriptionsService(
    orders,
    patients,
    clinics,
    pricing,
    catalog,
  );

  const clinic = clinics.create({
    slug: 'demo',
    name: 'Demo Clinic',
    cnpj: '00.000.000/0001-00',
    primaryColor: '#000',
    secondaryColor: '#fff',
  });
  const nutritionistId = 'nutri-1';
  const patient = patients.create({
    clinicId: clinic.id,
    nutritionistId,
    fullName: 'Ana Souza',
    cpf: '12345678909',
  });
  const ingredient = catalog.createIngredient({
    clinicId: clinic.id,
    name: 'Frango',
    slug: 'frango',
    category: 'protein',
    unitPriceCents: 950,
    unitOfMeasure: 'g',
    baseQuantity: 120,
    isAvailable: true,
  });
  const packaging = catalog.createPackaging({
    clinicId: clinic.id,
    name: 'Marmita 800ml',
    capacityMl: 800,
    unitCostCents: 220,
  });
  const composition = catalog.createComposition({
    clinicId: clinic.id,
    name: 'Equilibrio',
    description: 'demo',
    basePriceCents: 2200,
    items: [
      {
        ingredientId: ingredient.id,
        quantity: 120,
        replaceable: true,
        mandatory: true,
      },
    ],
  });

  return {
    subscriptions,
    orders,
    clinicId: clinic.id,
    nutritionistId,
    patientId: patient.id,
    compositionId: composition.id,
    packagingId: packaging.id,
  };
}

describe('SubscriptionsService', () => {
  it('creates a subscription with estimated total and runs due to create an order', () => {
    const fx = buildFixture();
    const actor = {
      userId: fx.nutritionistId,
      role: 'nutritionist' as const,
      clinicId: fx.clinicId,
    };
    const today = new Date().toISOString().slice(0, 10);
    const sub = fx.subscriptions.create(actor, {
      patientId: fx.patientId,
      cadence: 'weekly',
      items: [
        {
          compositionId: fx.compositionId,
          packagingId: fx.packagingId,
          quantity: 4,
        },
      ],
      deliveryWindow: { slot: '12:00-12:30', regionCode: '0451' },
      startDate: today,
    });
    expect(sub.status).toBe('active');
    expect(sub.estimatedTotalCents).toBeGreaterThan(0);
    expect(sub.nextRunDate).toBe(today);

    const result = fx.subscriptions.runDue();
    expect(result.dueCount).toBe(1);
    expect(result.ordersCreated).toBe(1);
    expect(result.failures).toHaveLength(0);

    const updated = fx.subscriptions.findById(sub.id);
    expect(updated.generatedOrderIds).toHaveLength(1);
    expect(updated.lastRunDate).toBe(today);
    expect(updated.nextRunDate).toBe(addDaysIso(today, 7));

    const order = fx.orders.findById(updated.generatedOrderIds[0]);
    expect(order.status).toBe('AWAITING_PATIENT_REVIEW');
    expect(order.patientId).toBe(fx.patientId);
  });

  it('does not generate orders for paused subscriptions and resumes them', () => {
    const fx = buildFixture();
    const actor = {
      userId: fx.nutritionistId,
      role: 'nutritionist' as const,
      clinicId: fx.clinicId,
    };
    const today = new Date().toISOString().slice(0, 10);
    const sub = fx.subscriptions.create(actor, {
      patientId: fx.patientId,
      cadence: 'weekly',
      items: [{ packagingId: fx.packagingId, quantity: 2 }],
      deliveryWindow: { slot: '12:00-12:30' },
      startDate: today,
    });

    fx.subscriptions.pause(actor, sub.id);
    expect(fx.subscriptions.findById(sub.id).status).toBe('paused');
    const paused = fx.subscriptions.runDue();
    expect(paused.dueCount).toBe(0);
    expect(paused.ordersCreated).toBe(0);

    fx.subscriptions.resume(actor, sub.id);
    const resumed = fx.subscriptions.runDue();
    expect(resumed.ordersCreated).toBe(1);
  });

  it('cancels a subscription and blocks further runs', () => {
    const fx = buildFixture();
    const actor = {
      userId: fx.nutritionistId,
      role: 'nutritionist' as const,
      clinicId: fx.clinicId,
    };
    const sub = fx.subscriptions.create(actor, {
      patientId: fx.patientId,
      cadence: 'monthly',
      items: [{ packagingId: fx.packagingId, quantity: 1 }],
      deliveryWindow: { slot: '12:00-12:30' },
    });
    const cancelled = fx.subscriptions.cancel(actor, sub.id);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancelledAt).toBeDefined();
    expect(fx.subscriptions.runDue().ordersCreated).toBe(0);
  });

  it('enforces tenant ownership on create and mutations', () => {
    const fx = buildFixture();
    const foreignActor = {
      userId: 'nutri-2',
      role: 'nutritionist' as const,
      clinicId: 'other-clinic',
    };
    expectDomainCode(
      () =>
        fx.subscriptions.create(foreignActor, {
          patientId: fx.patientId,
          cadence: 'weekly',
          items: [{ packagingId: fx.packagingId, quantity: 1 }],
          deliveryWindow: { slot: '12:00-12:30' },
        }),
      'SUBSCRIPTION_PATIENT_FOREIGN_TENANT',
    );

    const owner = {
      userId: fx.nutritionistId,
      role: 'nutritionist' as const,
      clinicId: fx.clinicId,
    };
    const sub = fx.subscriptions.create(owner, {
      patientId: fx.patientId,
      cadence: 'weekly',
      items: [{ packagingId: fx.packagingId, quantity: 1 }],
      deliveryWindow: { slot: '12:00-12:30' },
    });
    expectDomainCode(
      () => fx.subscriptions.pause(foreignActor, sub.id),
      'SUBSCRIPTION_FOREIGN_TENANT',
    );
  });

  it('lists all subscriptions when clinicId is omitted (admin scope)', () => {
    const fx = buildFixture();
    const owner = {
      userId: fx.nutritionistId,
      role: 'nutritionist' as const,
      clinicId: fx.clinicId,
    };
    fx.subscriptions.create(owner, {
      patientId: fx.patientId,
      cadence: 'weekly',
      items: [{ packagingId: fx.packagingId, quantity: 1 }],
      deliveryWindow: { slot: '12:00-12:30' },
    });
    // Admin has no clinicId; an undefined clinicId filter must return all.
    expect(fx.subscriptions.list({})).toHaveLength(1);
    expect(fx.subscriptions.list({ clinicId: undefined })).toHaveLength(1);
    expect(fx.subscriptions.list({ clinicId: 'nope' })).toHaveLength(0);
  });

  it('reports stats for diagnostics', () => {
    const fx = buildFixture();
    const actor = {
      userId: fx.nutritionistId,
      role: 'nutritionist' as const,
      clinicId: fx.clinicId,
    };
    const sub = fx.subscriptions.create(actor, {
      patientId: fx.patientId,
      cadence: 'weekly',
      items: [{ packagingId: fx.packagingId, quantity: 1 }],
      deliveryWindow: { slot: '12:00-12:30' },
    });
    fx.subscriptions.pause(actor, sub.id);
    const stats = fx.subscriptions.stats(fx.clinicId);
    expect(stats.total).toBe(1);
    expect(stats.paused).toBe(1);
    expect(stats.active).toBe(0);
  });
});
