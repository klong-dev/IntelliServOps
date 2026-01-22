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
        redisConfig,
        payosConfig,
        tuyaConfig,
      ],
      envFilePath: ['.env'],
    }),

    // Shared Infrastructure (Prisma, Redis, Queue)
    SharedModule,

    // Feature Modules
    AuthModule,

    // TODO: Add more feature modules as they are developed
    // UsersModule,
    // ApartmentsModule,
    // ContractsModule,
    // InvoicesModule,
    // PaymentsModule,
    // IotModule,
    // MaintenanceModule,
    // TicketsModule,
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
