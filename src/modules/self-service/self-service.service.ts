import { Injectable } from '@nestjs/common';

import { NotFoundDomainError } from '../../common/domain-errors';
import { newOrderCode, nowUtc } from '../../common/ids';
import type { SelfServiceCode } from './self-service-code.entity';

const DEFAULT_TTL_DAYS = 60;
const MAX_GENERATION_RETRIES = 5;
const CODE_PREFIX = 'NUT-';

@Injectable()
export class SelfServiceService {
  private readonly codes = new Map<string, SelfServiceCode>();

  generate(input: {
    clinicId: string;
    nutritionistId: string;
    ttlDays?: number;
  }): SelfServiceCode {
    let code = '';
    for (let i = 0; i < MAX_GENERATION_RETRIES; i += 1) {
      const candidate = `${CODE_PREFIX}${newOrderCode(6)}`;
      if (!this.codes.has(candidate)) {
        code = candidate;
        break;
      }
    }
    if (!code) {
      throw new Error('SELF_SERVICE_CODE_GENERATION_FAILED');
    }
    const ttlDays = input.ttlDays ?? DEFAULT_TTL_DAYS;
    const now = nowUtc();
    const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
    const record: SelfServiceCode = {
      code,
      clinicId: input.clinicId,
      nutritionistId: input.nutritionistId,
      active: true,
      expiresAt,
      createdAt: now,
      usageCount: 0,
    };
    this.codes.set(code, record);
    return record;
  }

  validateActive(rawCode: string): SelfServiceCode {
    const code = rawCode.trim().toUpperCase();
    const record = this.codes.get(code);
    if (!record || !record.active) {
      throw new NotFoundDomainError('SELF_SERVICE_CODE_INVALID');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new NotFoundDomainError('SELF_SERVICE_CODE_INVALID');
    }
    return record;
  }

  list(filter: {
    clinicId?: string;
    nutritionistId?: string;
  }): SelfServiceCode[] {
    return [...this.codes.values()]
      .filter((c) => !filter.clinicId || c.clinicId === filter.clinicId)
      .filter(
        (c) =>
          !filter.nutritionistId || c.nutritionistId === filter.nutritionistId,
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  deactivate(rawCode: string): SelfServiceCode {
    const code = rawCode.trim().toUpperCase();
    const record = this.codes.get(code);
    if (!record) throw new NotFoundDomainError('SELF_SERVICE_CODE_INVALID');
    record.active = false;
    return record;
  }

  incrementUsage(rawCode: string): SelfServiceCode {
    const code = rawCode.trim().toUpperCase();
    const record = this.codes.get(code);
    if (!record) throw new NotFoundDomainError('SELF_SERVICE_CODE_INVALID');
    record.usageCount += 1;
    return record;
  }

  countActive(): number {
    const now = Date.now();
    return [...this.codes.values()].filter(
      (c) => c.active && c.expiresAt.getTime() >= now,
    ).length;
  }
}
