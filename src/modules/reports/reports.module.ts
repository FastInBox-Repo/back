import { Module } from '@nestjs/common';

import { OrdersModule } from '../orders/orders.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { ForecastService } from './forecast.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [OrdersModule, SubscriptionsModule],
  controllers: [ReportsController],
  providers: [ReportsService, ForecastService],
})
export class ReportsModule {}
