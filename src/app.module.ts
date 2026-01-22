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

// Core Modules
import { PrismaModule } from './prisma';
import { RedisModule } from './redis';
import { QueueModule } from './queue';
import { AuthModule } from './auth';
import { JwtAuthGuard, RolesGuard } from './auth/guards';

// Controllers
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

    // Core Infrastructure
    PrismaModule,
    RedisModule,
    QueueModule,
    AuthModule,

    // Feature Modules (to be added)
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
