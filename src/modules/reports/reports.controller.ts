import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import type { Response } from 'express';

import { Roles } from '../../common/decorators';
import { ReportsService } from './reports.service';
import type { OrderStatus } from '../orders/order.entity';

function parseDate(input?: string): Date | undefined {
  if (!input) return undefined;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

@Controller('admin/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Roles('admin')
  @Get('operations')
  operations(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('clinicId') clinicId?: string,
    @Query('status') status?: OrderStatus,
  ) {
    return this.reports.operationsSummary({
      from: parseDate(from),
      to: parseDate(to),
      clinicId,
      status,
    });
  }

  @Roles('admin')
  @Get('commissions')
  commissions(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('clinicId') clinicId?: string,
  ) {
    return this.reports.commissionsByNutritionist({
      from: parseDate(from),
      to: parseDate(to),
      clinicId,
    });
  }

  @Roles('admin')
  @Get('commissions.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="commissions.csv"')
  commissionsCsv(
    @Res({ passthrough: true }) res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('clinicId') clinicId?: string,
  ) {
    const rows = this.reports.commissionsByNutritionist({
      from: parseDate(from),
      to: parseDate(to),
      clinicId,
    });
    return this.reports.toCsvCommissions(rows);
  }
}
