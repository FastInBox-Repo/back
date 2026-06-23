import { ClinicsService } from '../clinics/clinics.service';
import { IngredientsService } from '../ingredients/ingredients.service';
import { OrderCodesService } from '../orders/order-codes.service';
import { OrderEventsService } from '../orders/order-events.service';
import { OrdersService } from '../orders/orders.service';
import { PatientsService } from '../patients/patients.service';
import { PricingService } from '../orders/pricing.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { ForecastService } from './forecast.service';

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('ForecastService', () => {
  function setup() {
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
      name: 'Demo',
      cnpj: '00.000.000/0001-00',
      primaryColor: '#000',
      secondaryColor: '#fff',
    });
    const nutritionistId = 'nutri-1';
    const patient = patients.create({
      clinicId: clinic.id,
      nutritionistId,
      fullName: 'Ana',
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
      name: 'Marmita',
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

    const forecast = new ForecastService(orders, subscriptions);
    return {
      forecast,
      orders,
      subscriptions,
      clinic,
      nutritionistId,
      patientId: patient.id,
      compositionId: composition.id,
      packagingId: packaging.id,
    };
  }

  it('returns windows with bounds enclosing expectedMeals and correct horizon', () => {
    const fx = setup();
    const actor = {
      userId: fx.nutritionistId,
      role: 'nutritionist' as const,
      clinicId: fx.clinic.id,
    };

    // Active subscription starting today gives forward signal.
    fx.subscriptions.create(actor, {
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
      startDate: isoDaysFromNow(0),
    });

    // Historical paid orders provide a baseline for the same slot.
    for (let i = 0; i < 2; i += 1) {
      const order = fx.orders.create(actor, {
        patientId: fx.patientId,
        deliveryWindow: { date: isoDaysFromNow(0), slot: '12:00-12:30' },
        items: [{ packagingId: fx.packagingId, quantity: 3 }],
      });
      fx.orders.submit(actor, order.id);
      fx.orders.patientConfirm({ role: 'patient' }, order.id);
      fx.orders.markAsPaid(order.id);
    }

    const result = fx.forecast.forecast({ clinicId: fx.clinic.id, days: 7 });
    expect(result.horizonDays).toBe(7);
    expect(result.windows.length).toBeGreaterThan(0);
    for (const w of result.windows) {
      expect(w.lowerBound).toBeLessThanOrEqual(w.expectedMeals);
      expect(w.expectedMeals).toBeLessThanOrEqual(w.upperBound);
      expect(w.lowerBound).toBeGreaterThanOrEqual(0);
      expect(w.expectedMeals).toBe(w.fromHistory + w.fromSubscriptions);
    }
    expect(result.totals.expectedMeals).toBeGreaterThan(0);
    expect(result.totals.lowerBound).toBeLessThanOrEqual(
      result.totals.expectedMeals,
    );
    expect(result.totals.upperBound).toBeGreaterThanOrEqual(
      result.totals.expectedMeals,
    );
  });

  it('projects a subscription run into the horizon with its meal count', () => {
    const fx = setup();
    const actor = {
      userId: fx.nutritionistId,
      role: 'nutritionist' as const,
      clinicId: fx.clinic.id,
    };
    fx.subscriptions.create(actor, {
      patientId: fx.patientId,
      cadence: 'weekly',
      items: [{ packagingId: fx.packagingId, quantity: 5 }],
      deliveryWindow: { slot: '19:00-19:30', regionCode: '0451' },
      startDate: isoDaysFromNow(0),
    });

    const result = fx.forecast.forecast({ clinicId: fx.clinic.id, days: 7 });
    const today = result.windows.find(
      (w) => w.date === isoDaysFromNow(0) && w.slot === '19:00-19:30',
    );
    expect(today).toBeDefined();
    expect(today?.fromSubscriptions).toBe(5);
    expect(today?.regionCode).toBe('0451');
  });

  it('includes a weekly run that is exactly `days` away (inclusive horizon)', () => {
    const fx = setup();
    const actor = {
      userId: fx.nutritionistId,
      role: 'nutritionist' as const,
      clinicId: fx.clinic.id,
    };
    // Mirror the seed: create weekly starting today, then run the scheduler,
    // which pushes nextRunDate to today+7. A 7-day horizon must still see it.
    fx.subscriptions.create(actor, {
      patientId: fx.patientId,
      cadence: 'weekly',
      items: [{ packagingId: fx.packagingId, quantity: 4 }],
      deliveryWindow: { slot: '12:00-12:30', regionCode: '0451' },
      startDate: isoDaysFromNow(0),
    });
    fx.subscriptions.runDue();

    const result = fx.forecast.forecast({ clinicId: fx.clinic.id, days: 7 });
    const future = result.windows.find(
      (w) => w.date === isoDaysFromNow(7) && w.slot === '12:00-12:30',
    );
    expect(future).toBeDefined();
    expect(future?.fromSubscriptions).toBe(4);
    expect(result.windows.length).toBeGreaterThan(0);
  });
});
