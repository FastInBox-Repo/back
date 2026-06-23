import { Module } from '@nestjs/common';

import { PatientsModule } from '../patients/patients.module';
import { SelfServiceController } from './self-service.controller';
import { SelfServiceService } from './self-service.service';

@Module({
  imports: [PatientsModule],
  controllers: [SelfServiceController],
  providers: [SelfServiceService],
  exports: [SelfServiceService],
})
export class SelfServiceModule {}
