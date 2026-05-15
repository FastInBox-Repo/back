import { Global, Module } from '@nestjs/common';

import { OrderCodesService } from './order-codes.service';
import { OrderEventsService } from './order-events.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PatientsModule } from '../patients/patients.module';
import { PricingService } from './pricing.service';
import { PublicOrdersController } from './public-orders.controller';

@Global()
@Module({
  imports: [PatientsModule],
  controllers: [OrdersController, PublicOrdersController],
  providers: [
    OrdersService,
    OrderCodesService,
    OrderEventsService,
    PricingService,
  ],
  exports: [
    OrdersService,
    OrderCodesService,
    OrderEventsService,
    PricingService,
  ],
})
export class OrdersModule {}
