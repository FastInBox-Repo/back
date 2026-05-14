import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './common/guards/auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { InfraModule } from './infra/infra.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { IngredientsModule } from './modules/ingredients/ingredients.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PatientsModule } from './modules/patients/patients.module';

@Module({
  imports: [
    InfraModule,
    HealthModule,
    AuditModule,
    AuthModule,
    PatientsModule,
    IngredientsModule,
    OrdersModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
