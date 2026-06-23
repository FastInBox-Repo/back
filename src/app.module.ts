import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthGuard } from './common/auth.guard';
import { GlobalHttpExceptionFilter } from './common/http-exception.filter';
import { RateLimitGuard } from './common/rate-limit.guard';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClinicsModule } from './modules/clinics/clinics.module';
import { IngredientsModule } from './modules/ingredients/ingredients.module';
import { KitchenModule } from './modules/kitchen/kitchen.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PatientsModule } from './modules/patients/patients.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SelfServiceModule } from './modules/self-service/self-service.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { UsersModule } from './modules/users/users.module';
import { SeedService } from './seed.service';

@Module({
  imports: [
    UsersModule,
    AuthModule,
    ClinicsModule,
    PatientsModule,
    IngredientsModule,
    OrdersModule,
    PaymentsModule,
    KitchenModule,
    AuditModule,
    SelfServiceModule,
    SubscriptionsModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    SeedService,
    // Guard order matters: rate limiting runs before authentication so that
    // unauthenticated floods are rejected with 429 before any token work.
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: GlobalHttpExceptionFilter },
  ],
})
export class AppModule {}
