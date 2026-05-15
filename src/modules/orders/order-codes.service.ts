import { Injectable } from '@nestjs/common';

import { NotFoundDomainError } from '../../common/domain-errors';
import { newOrderCode, nowUtc } from '../../common/ids';
import type { OrderCodeRecord } from './order.entity';

const CODE_TTL_DAYS = 30;
const MAX_GENERATION_RETRIES = 4;

@Injectable()
export class OrderCodesService {
  private readonly codes = new Map<string, OrderCodeRecord>();
  private readonly byOrder = new Map<string, string>();

  generate(orderId: string): OrderCodeRecord {
    const existing = this.byOrder.get(orderId);
    if (existing) {
      const record = this.codes.get(existing);
      if (record) return record;
    }
    let code = '';
    for (let i = 0; i < MAX_GENERATION_RETRIES; i += 1) {
      const candidate = newOrderCode(8);
      if (!this.codes.has(candidate)) {
        code = candidate;
        break;
      }
    }
    if (!code) {
      throw new Error('CODE_GENERATION_FAILED');
    }
    const now = nowUtc();
    const expiresAt = new Date(
      now.getTime() + CODE_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
    const record: OrderCodeRecord = {
      code,
      orderId,
      createdAt: now,
      expiresAt,
    };
    this.codes.set(code, record);
    this.byOrder.set(orderId, code);
    return record;
  }

  validate(rawCode: string): OrderCodeRecord {
    const code = rawCode.trim().toUpperCase();
    const record = this.codes.get(code);
    if (!record) throw new NotFoundDomainError('ORDER_CODE_NOT_AVAILABLE');
    if (record.expiresAt.getTime() < Date.now())
      throw new NotFoundDomainError('ORDER_CODE_NOT_AVAILABLE');
    return record;
  }

  consume(code: string) {
    const record = this.codes.get(code);
    if (record && !record.consumedAt) record.consumedAt = nowUtc();
  }

  list(): OrderCodeRecord[] {
    return [...this.codes.values()];
  }
}
