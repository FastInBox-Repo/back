import { Controller, Get, Query } from '@nestjs/common';

import { Roles } from '../../common/decorators';
import { AuditService } from './audit.service';

@Controller('admin/audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Roles('admin')
  @Get()
  list(
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('outcome') outcome?: 'allowed' | 'denied',
  ) {
    return this.audit.list({ action, actorId, outcome });
  }
}
