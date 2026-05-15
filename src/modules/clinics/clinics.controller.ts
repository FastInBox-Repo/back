import { Controller, Get, Param } from '@nestjs/common';

import { Public } from '../../common/decorators';
import { ClinicsService } from './clinics.service';

@Controller('clinics')
export class ClinicsController {
  constructor(private readonly clinics: ClinicsService) {}

  @Public()
  @Get(':id')
  get(@Param('id') id: string) {
    return this.clinics.findById(id);
  }

  @Get()
  list() {
    return this.clinics.list();
  }
}
