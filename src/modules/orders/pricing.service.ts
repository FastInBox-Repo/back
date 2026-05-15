import { Injectable } from '@nestjs/common';

import type { Clinic } from '../clinics/clinic.entity';
import type { OrderItem } from './order.entity';

export interface PricingResult {
  subtotalCents: number;
  discountCents: number;
  commissionCents: number;
  totalCents: number;
  breakdown: {
    itemId: string;
    lineCents: number;
    quantity: number;
    unitPriceCents: number;
  }[];
}

@Injectable()
export class PricingService {
  calculate(
    items: OrderItem[],
    clinic: Clinic,
    discountCents = 0,
  ): PricingResult {
    const breakdown = items.map((item) => ({
      itemId: item.id,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      lineCents: item.unitPriceCents * item.quantity,
    }));
    const subtotalCents = breakdown.reduce((acc, l) => acc + l.lineCents, 0);
    const taxableBase = Math.max(0, subtotalCents - discountCents);
    const commissionCents = applyTiers(taxableBase, clinic.commissionTiers);
    const totalCents = taxableBase + commissionCents;
    return {
      subtotalCents,
      discountCents,
      commissionCents,
      totalCents,
      breakdown,
    };
  }
}

function applyTiers(
  amountCents: number,
  tiers: { upToCents: number; rate: number }[],
): number {
  const ordered = [...tiers].sort((a, b) => a.upToCents - b.upToCents);
  for (const tier of ordered) {
    if (amountCents <= tier.upToCents) {
      return roundHalfEven(amountCents * tier.rate);
    }
  }
  return roundHalfEven(amountCents * ordered[ordered.length - 1].rate);
}

function roundHalfEven(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}
