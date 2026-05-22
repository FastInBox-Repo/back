import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthGuard } from './common/auth.guard';
import { GlobalHttpExceptionFilter } from './common/http-exception.filter';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClinicsModule } from './modules/clinics/clinics.module';
import { IngredientsModule } from './modules/ingredients/ingredients.module';
import { KitchenModule } from './modules/kitchen/kitchen.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PatientsModule } from './modules/patients/patients.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ReportsModule } from './modules/reports/reports.module';
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
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    SeedService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: GlobalHttpExceptionFilter },
  ],
})
export class AppModule {}
