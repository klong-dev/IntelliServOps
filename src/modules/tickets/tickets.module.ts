import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { IoTModule } from '../iot/iot.module';
import { ContractsModule } from '../contracts/contracts.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SupabaseStorageService } from '../../shared/services/supabase-storage.service';

@Module({
  imports: [IoTModule, ContractsModule, NotificationsModule],
  controllers: [TicketsController],
  providers: [TicketsService, SupabaseStorageService],
  exports: [TicketsService],
})
export class TicketsModule {}
