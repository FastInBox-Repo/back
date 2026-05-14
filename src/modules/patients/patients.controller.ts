import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { SafeUser } from '../../common/types/domain.types';
import { PatientsService } from './patients.service';

interface CreatePatientBody {
  name?: string;
  email?: string;
  dietaryNotes?: string;
}

interface UpdatePatientBody {
  name?: string;
  email?: string;
  dietaryNotes?: string;
}

@Controller('patients')
@Roles('nutricionista')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  listPatients(@CurrentUser() user: SafeUser) {
    return this.patientsService.listByNutritionist(user.id);
  }

  @Post()
  createPatient(@CurrentUser() user: SafeUser, @Body() body: CreatePatientBody) {
    return this.patientsService.createPatient(user.id, body);
  }

  @Patch(':id')
  updatePatient(
    @CurrentUser() user: SafeUser,
    @Param('id') patientId: string,
    @Body() body: UpdatePatientBody,
  ) {
    return this.patientsService.updatePatient(patientId, user.id, body);
  }
}
