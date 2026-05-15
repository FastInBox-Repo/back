import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { Roles } from '../../common/decorators';
import { ForbiddenDomainError } from '../../common/domain-errors';
import { PatientsService } from './patients.service';

interface AuthedRequest extends Request {
  user?: {
    userId: string;
    role: 'admin' | 'nutritionist' | 'kitchen' | 'patient';
    clinicId?: string;
  };
}

@Controller('patients')
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Roles('admin', 'nutritionist')
  @Get()
  list(@Req() req: AuthedRequest, @Query('q') q?: string) {
    if (!req.user?.clinicId)
      throw new ForbiddenDomainError('PATIENT_TENANT_MISSING');
    return this.patients.list({
      clinicId: req.user.clinicId,
      nutritionistId:
        req.user.role === 'nutritionist' ? req.user.userId : undefined,
      q,
    });
  }

  @Roles('admin', 'nutritionist')
  @Post()
  create(
    @Req() req: AuthedRequest,
    @Body() body: Record<string, unknown> & { nutritionistId?: string },
  ) {
    if (!req.user?.clinicId)
      throw new ForbiddenDomainError('PATIENT_TENANT_MISSING');
    const merged = {
      ...body,
      clinicId: req.user.clinicId,
      nutritionistId:
        req.user.role === 'nutritionist'
          ? req.user.userId
          : (body.nutritionistId ?? ''),
    } as Parameters<PatientsService['create']>[0];
    return this.patients.create(merged);
  }

  @Roles('admin', 'nutritionist')
  @Get(':id')
  get(@Req() req: AuthedRequest, @Param('id') id: string) {
    if (!req.user?.clinicId)
      throw new ForbiddenDomainError('PATIENT_TENANT_MISSING');
    const patient = this.patients.findById(id);
    if (req.user.role !== 'admin' && req.user.clinicId !== patient.clinicId) {
      throw new ForbiddenDomainError('PATIENT_FOREIGN_TENANT');
    }
    return patient;
  }

  @Roles('admin', 'nutritionist')
  @Patch(':id')
  update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.patients.update(
      id,
      {
        userId: req.user!.userId,
        role: req.user!.role,
        clinicId: req.user!.clinicId,
      },
      body,
    );
  }

  @Roles('admin', 'nutritionist')
  @Delete(':id')
  remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.patients.softDelete(id, {
      role: req.user!.role,
      clinicId: req.user!.clinicId,
    });
  }
}
