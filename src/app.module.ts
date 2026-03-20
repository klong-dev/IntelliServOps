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
import { TicketsModule } from './modules/tickets';
import { ViewingRequestsModule } from './modules/viewing-requests';
import { IoTModule } from './modules/iot';
import { TasksModule } from './modules/tasks';
import { PartnersModule } from './modules/partners';
import { NotificationsModule } from './modules/notifications';
import { PoliciesModule } from './modules/policies';
import { ActivityLogsModule } from './modules/activity-logs';
import { StaffNotesModule } from './modules/staff-notes';
import { UserRoomsModule } from './modules/user-rooms';
import { ApartmentPoliciesModule } from './modules/apartment-policies';
import { ReservationsModule } from './modules/reservations';
import { ChatModule } from './modules/chat';

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
        supabaseConfig,
        fptAiConfig,
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
    IoTModule,
    TasksModule,
    PartnersModule,
    NotificationsModule,
    PoliciesModule,
    ActivityLogsModule,
    StaffNotesModule,
    UserRoomsModule,
    ApartmentPoliciesModule,
    ReservationsModule,
    ChatModule,
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
