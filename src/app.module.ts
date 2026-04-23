import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';

// Config
import {
  appConfig,
  aiServiceConfig,
  databaseConfig,
  jwtConfig,
  redisConfig,
  payosConfig,
  tuyaConfig,
  supabaseConfig,
  fptAiConfig,
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
import { ViewingRequestsModule } from './modules/viewing-requests';
import { IoTModule } from './modules/iot';
import { NotificationsModule } from './modules/notifications';
import { ActivityLogsModule } from './modules/activity-logs';
import { UserApartmentsModule } from './modules/user-apartments';
import { ApartmentPoliciesModule } from './modules/apartment-policies';
import { ReservationsModule } from './modules/reservations';
import { ChatModule } from './modules/chat';
import { AmenitiesModule } from './modules/amenities';

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
        aiServiceConfig,
        databaseConfig,
        jwtConfig,
        redisConfig,
        payosConfig,
        tuyaConfig,
        supabaseConfig,
        fptAiConfig,
      ],
      envFilePath: ['.env'],
    }),

    // Event System (for centralized notification triggers)
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),

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
    ViewingRequestsModule,
    IoTModule,
    NotificationsModule,
    ActivityLogsModule,
    UserApartmentsModule,
    ApartmentPoliciesModule,
    ReservationsModule,
    ChatModule,
    AmenitiesModule,
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
