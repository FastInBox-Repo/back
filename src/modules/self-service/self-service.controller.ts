import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

import { ForbiddenDomainError } from '../../common/domain-errors';
import { Public, Roles } from '../../common/decorators';
import type { SessionToken } from '../auth/auth.service';
import { ClinicsService } from '../clinics/clinics.service';
import { PatientsService } from '../patients/patients.service';
import { UsersService } from '../users/users.service';
import { SelfServiceService } from './self-service.service';
import type { Clinic } from '../clinics/clinic.entity';

interface AuthedRequest extends Request {
  user?: SessionToken;
}

interface RegisterBody {
  fullName: string;
  cpf: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  preferences?: string[];
  restrictions?: string[];
  preferredDeliveryWindow?: string;
}

@Controller()
export class SelfServiceController {
  constructor(
    private readonly selfService: SelfServiceService,
    private readonly clinics: ClinicsService,
    private readonly patients: PatientsService,
    private readonly users: UsersService,
  ) {}

  @Public()
  @Get('public/self-service/:code')
  whitelabel(@Param('code') code: string) {
    const record = this.selfService.validateActive(code);
    const clinic = this.clinics.findById(record.clinicId);
    const nutritionist = this.users.findById(record.nutritionistId);
    return {
      code: record.code,
      clinic: this.projectClinic(clinic),
      nutritionist: {
        fullName: nutritionist?.fullName ?? 'Nutricionista',
      },
    };
  }

  @Public()
  @Post('public/self-service/:code/register')
  register(@Param('code') code: string, @Body() body: RegisterBody) {
    const record = this.selfService.validateActive(code);
    const patient = this.patients.create({
      clinicId: record.clinicId,
      nutritionistId: record.nutritionistId,
      fullName: body.fullName,
      cpf: body.cpf,
      email: body.email,
      phone: body.phone,
      birthDate: body.birthDate,
      preferences: body.preferences,
      restrictions: body.restrictions,
      preferredDeliveryWindow: body.preferredDeliveryWindow,
    });
    this.selfService.incrementUsage(record.code);
    const clinic = this.clinics.findById(record.clinicId);
    return {
      patient: {
        id: patient.id,
        fullName: patient.fullName,
        clinicId: patient.clinicId,
        nutritionistId: patient.nutritionistId,
      },
      clinic: this.projectClinic(clinic),
    };
  }

  @Roles('admin', 'nutritionist')
  @Post('self-service/codes')
  createCode(
    @Req() req: AuthedRequest,
    @Body()
    body: { nutritionistId?: string; clinicId?: string; ttlDays?: number },
  ) {
    const user = req.user!;
    if (user.role === 'nutritionist') {
      if (!user.clinicId) {
        throw new ForbiddenDomainError('SELF_SERVICE_CLINIC_MISSING');
      }
      return this.selfService.generate({
        clinicId: user.clinicId,
        nutritionistId: user.userId,
        ttlDays: body?.ttlDays,
      });
    }
    if (!body?.clinicId || !body?.nutritionistId) {
      throw new ForbiddenDomainError('SELF_SERVICE_TARGET_REQUIRED');
    }
    return this.selfService.generate({
      clinicId: body.clinicId,
      nutritionistId: body.nutritionistId,
      ttlDays: body?.ttlDays,
    });
  }

  @Roles('admin', 'nutritionist')
  @Get('self-service/codes')
  listCodes(@Req() req: AuthedRequest) {
    const user = req.user!;
    return this.selfService.list({
      clinicId: user.clinicId,
      nutritionistId: user.role === 'nutritionist' ? user.userId : undefined,
    });
  }

  @Roles('admin', 'nutritionist')
  @Post('self-service/codes/:code/deactivate')
  deactivateCode(@Req() req: AuthedRequest, @Param('code') code: string) {
    const user = req.user!;
    const record = this.selfService.validateActive(code);
    if (user.role !== 'admin' && record.clinicId !== user.clinicId) {
      throw new ForbiddenDomainError('SELF_SERVICE_FOREIGN_TENANT');
    }
    if (user.role === 'nutritionist' && record.nutritionistId !== user.userId) {
      throw new ForbiddenDomainError('SELF_SERVICE_FOREIGN_OWNER');
    }
    return this.selfService.deactivate(code);
  }

  private projectClinic(clinic: Clinic) {
    return {
      id: clinic.id,
      name: clinic.name,
      logoUrl: clinic.logoUrl,
      primaryColor: clinic.primaryColor,
      secondaryColor: clinic.secondaryColor,
    };
  }
}
