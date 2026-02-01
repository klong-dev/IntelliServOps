import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

// Config
import {
  appConfig,
  databaseConfig,
  jwtConfig,
  redisConfig,
  payosConfig,
  tuyaConfig,
} from './config';

// Shared Infrastructure
import { SharedModule } from './shared';

// Common Guards
import { JwtAuthGuard, RolesGuard } from './common/guards';

// Feature Modules
import { AuthModule } from './modules/auth';
import { UsersModule } from './modules/users';
import { ApartmentsModule } from './modules/apartments';
import { ContractsModule } from './modules/contracts';
import { InvoicesModule } from './modules/invoices';
import { PaymentsModule } from './modules/payments';
import { MaintenanceModule } from './modules/maintenance';
import { TicketsModule } from './modules/tickets';
import { ViewingRequestsModule } from './modules/viewing-requests';

// App Core
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        jwtConfig,
        // redisConfig,
        payosConfig,
        tuyaConfig,
      ],
      envFilePath: ['.env'],
    }),

    // Shared Infrastructure (Prisma, Redis, Queue)
    SharedModule,

    // Feature Modules
    AuthModule,
    UsersModule,
    ApartmentsModule,
    ContractsModule,
    InvoicesModule,
    PaymentsModule,
    MaintenanceModule,
    TicketsModule,
    ViewingRequestsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global Guards
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
