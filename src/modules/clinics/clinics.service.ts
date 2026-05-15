import { Injectable } from '@nestjs/common';

import { NotFoundDomainError } from '../../common/domain-errors';
import { newId, nowUtc } from '../../common/ids';
import type { Clinic } from './clinic.entity';

const DEFAULT_TIERS = [
  { upToCents: 30_000, rate: 0.05 },
  { upToCents: 70_000, rate: 0.07 },
  { upToCents: 150_000, rate: 0.09 },
  { upToCents: Number.MAX_SAFE_INTEGER, rate: 0.12 },
];

@Injectable()
export class ClinicsService {
  private readonly clinics = new Map<string, Clinic>();

  create(
    input: Omit<
      Clinic,
      'id' | 'createdAt' | 'updatedAt' | 'status' | 'commissionTiers'
    > &
      Partial<Pick<Clinic, 'commissionTiers' | 'status'>>,
  ): Clinic {
    const now = nowUtc();
    const clinic: Clinic = {
      ...input,
      id: newId(),
      status: input.status ?? 'active',
      commissionTiers: input.commissionTiers ?? DEFAULT_TIERS,
      createdAt: now,
      updatedAt: now,
    };
    this.clinics.set(clinic.id, clinic);
    return clinic;
  }

  findById(id: string): Clinic {
    const c = this.clinics.get(id);
    if (!c) throw new NotFoundDomainError('CLINIC_NOT_FOUND');
    return c;
  }

  findByIdOrUndefined(id: string): Clinic | undefined {
    return this.clinics.get(id);
  }

  list(): Clinic[] {
    return [...this.clinics.values()];
  }
}
