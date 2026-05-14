import { Injectable } from '@nestjs/common';
import type { AuditEventRecord } from '../../common/types/domain.types';
import { createId } from '../../common/utils/id.util';
import { DataStoreService } from '../../infra/data-store.service';

interface LogAuditInput {
  type: AuditEventRecord['type'];
  actorUserId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

@Injectable()
export class AuditService {
  constructor(private readonly dataStoreService: DataStoreService) {}

  async listEvents(): Promise<AuditEventRecord[]> {
    const data = await this.dataStoreService.readData();
    return [...data.auditEvents].sort((a, b) =>
      a.timestamp < b.timestamp ? 1 : -1,
    );
  }

  async logEvent(input: LogAuditInput): Promise<AuditEventRecord> {
    const event: AuditEventRecord = {
      id: createId('audit'),
      type: input.type,
      actorUserId: input.actorUserId,
      metadata: input.metadata,
      timestamp: new Date().toISOString(),
    };

    await this.dataStoreService.updateData((db) => {
      db.auditEvents.push(event);
    });

    return event;
  }
}
