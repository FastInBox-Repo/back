import { Module } from '@nestjs/common';

import { ClinicsModule } from '../clinics/clinics.module';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { OrdersModule } from '../orders/orders.module';
import { PatientsModule } from '../patients/patients.module';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [OrdersModule, PatientsModule, ClinicsModule, IngredientsModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
