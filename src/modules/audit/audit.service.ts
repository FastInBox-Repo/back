import { Injectable } from '@nestjs/common';

import { newId, nowUtc } from '../../common/ids';

export interface AuditEntry {
  id: string;
  actorId?: string;
  actorRole?: string;
  action: string;
  resource: string;
  resourceId?: string;
  outcome: 'allowed' | 'denied';
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

@Injectable()
export class AuditService {
  private readonly entries: AuditEntry[] = [];

  record(entry: Omit<AuditEntry, 'id' | 'createdAt'>): AuditEntry {
    const recorded: AuditEntry = { ...entry, id: newId(), createdAt: nowUtc() };
    this.entries.push(recorded);
    return recorded;
  }

  list(
    filter: {
      actorId?: string;
      action?: string;
      resource?: string;
      outcome?: 'allowed' | 'denied';
      from?: Date;
      to?: Date;
    } = {},
  ): AuditEntry[] {
    return this.entries
      .filter((e) => !filter.actorId || e.actorId === filter.actorId)
      .filter((e) => !filter.action || e.action === filter.action)
      .filter((e) => !filter.resource || e.resource === filter.resource)
      .filter((e) => !filter.outcome || e.outcome === filter.outcome)
      .filter((e) => !filter.from || e.createdAt >= filter.from)
      .filter((e) => !filter.to || e.createdAt <= filter.to)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
