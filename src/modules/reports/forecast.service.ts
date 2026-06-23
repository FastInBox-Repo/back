import { Injectable } from '@nestjs/common';

import { OrdersService } from '../orders/orders.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CADENCE_DAYS } from '../subscriptions/subscription.entity';
import type { Order } from '../orders/order.entity';

const HISTORY_DAYS = 28;
const DEFAULT_HORIZON_DAYS = 7;
const BAND_FLOOR = 1;

const WEEKDAY_LABELS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

const PAID_STATUSES: ReadonlySet<Order['status']> = new Set([
  'PAID',
  'IN_PRODUCTION',
  'READY_FOR_DELIVERY',
  'DELIVERED',
]);

export interface ForecastFilter {
  clinicId?: string;
  days?: number;
}

export interface ForecastWindow {
  date: string;
  weekday: string;
  slot: string;
  regionCode?: string;
  expectedMeals: number;
  lowerBound: number;
  upperBound: number;
  fromHistory: number;
  fromSubscriptions: number;
}

export interface ForecastResult {
  generatedAt: string;
  horizonDays: number;
  windows: ForecastWindow[];
  totals: {
    expectedMeals: number;
    lowerBound: number;
    upperBound: number;
  };
}

interface HistoryBucket {
  samples: number[];
}

@Injectable()
export class ForecastService {
  constructor(
    private readonly orders: OrdersService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  forecast(filter: ForecastFilter = {}): ForecastResult {
    const now = new Date();
    const horizonDays = Math.max(1, filter.days ?? DEFAULT_HORIZON_DAYS);

    const history = this.buildHistory(filter.clinicId, now);
    const subscriptionContribution = this.buildSubscriptionProjection(
      filter.clinicId,
      now,
      horizonDays,
    );

    const slots = new Set<string>([
      ...[...history.keys()].map((k) => k.split('|')[1]),
      ...[...subscriptionContribution.keys()].map((k) => k.split('|')[1]),
    ]);

    const windows: ForecastWindow[] = [];
    // Horizon is inclusive of today .. today + horizonDays, so a weekly
    // subscription whose next run is exactly `days` away still contributes.
    for (let offset = 0; offset <= horizonDays; offset += 1) {
      const date = addDays(now, offset);
      const dateIso = date.toISOString().slice(0, 10);
      const weekdayIndex = date.getUTCDay();
      const weekday = WEEKDAY_LABELS[weekdayIndex];

      for (const slot of [...slots].sort()) {
        const histKey = `${weekdayIndex}|${slot}`;
        const subKey = `${dateIso}|${slot}`;
        const bucket = history.get(histKey);
        const sub = subscriptionContribution.get(subKey);

        const historyAvg = bucket ? average(bucket.samples) : 0;
        const fromSubscriptions = sub?.meals ?? 0;
        if (historyAvg === 0 && fromSubscriptions === 0) continue;

        const stddev = bucket ? stdDeviation(bucket.samples) : 0;
        const band = stddev + BAND_FLOOR;
        const expected = Math.round(historyAvg + fromSubscriptions);
        const lowerBound = Math.max(0, Math.round(expected - band));
        const upperBound = Math.round(expected + band);

        windows.push({
          date: dateIso,
          weekday,
          slot,
          regionCode: sub?.regionCode,
          expectedMeals: expected,
          lowerBound,
          upperBound,
          fromHistory: Math.round(historyAvg),
          fromSubscriptions,
        });
      }
    }

    const totals = windows.reduce(
      (acc, w) => {
        acc.expectedMeals += w.expectedMeals;
        acc.lowerBound += w.lowerBound;
        acc.upperBound += w.upperBound;
        return acc;
      },
      { expectedMeals: 0, lowerBound: 0, upperBound: 0 },
    );

    return {
      generatedAt: now.toISOString(),
      horizonDays,
      windows,
      totals,
    };
  }

  private buildHistory(
    clinicId: string | undefined,
    now: Date,
  ): Map<string, HistoryBucket> {
    const cutoff = addDays(now, -HISTORY_DAYS).getTime();
    const buckets = new Map<string, HistoryBucket>();
    for (const order of this.orders.listAll()) {
      if (clinicId && order.clinicId !== clinicId) continue;
      if (!PAID_STATUSES.has(order.status)) continue;
      if (order.createdAt.getTime() < cutoff) continue;
      const slot = order.deliveryWindow?.slot;
      if (!slot) continue;
      const reference = order.deliveryWindow?.date
        ? new Date(`${order.deliveryWindow.date}T00:00:00.000Z`)
        : order.createdAt;
      const weekdayIndex = reference.getUTCDay();
      const meals = order.items.reduce((acc, it) => acc + it.quantity, 0);
      const key = `${weekdayIndex}|${slot}`;
      const bucket = buckets.get(key) ?? { samples: [] };
      bucket.samples.push(meals);
      buckets.set(key, bucket);
    }
    return buckets;
  }

  private buildSubscriptionProjection(
    clinicId: string | undefined,
    now: Date,
    horizonDays: number,
  ): Map<string, { meals: number; regionCode?: string }> {
    const horizonEnd = addDays(now, horizonDays).toISOString().slice(0, 10);
    const todayIso = now.toISOString().slice(0, 10);
    const projection = new Map<
      string,
      { meals: number; regionCode?: string }
    >();

    for (const sub of this.subscriptions.listAll()) {
      if (clinicId && sub.clinicId !== clinicId) continue;
      if (sub.status !== 'active') continue;
      const meals = sub.items.reduce((acc, it) => acc + it.quantity, 0);
      const step = CADENCE_DAYS[sub.cadence];
      let runDate = sub.nextRunDate;
      // Catch up past-due runs to the present without projecting backwards.
      let guard = 0;
      while (runDate < todayIso && guard < 1000) {
        runDate = addDaysIso(runDate, step);
        guard += 1;
      }
      while (runDate <= horizonEnd && guard < 1000) {
        const key = `${runDate}|${sub.deliveryWindow.slot}`;
        const entry = projection.get(key) ?? {
          meals: 0,
          regionCode: sub.deliveryWindow.regionCode,
        };
        entry.meals += meals;
        if (!entry.regionCode && sub.deliveryWindow.regionCode) {
          entry.regionCode = sub.deliveryWindow.regionCode;
        }
        projection.set(key, entry);
        runDate = addDaysIso(runDate, step);
        guard += 1;
      }
    }
    return projection;
  }
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

function stdDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = average(values);
  const variance =
    values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
