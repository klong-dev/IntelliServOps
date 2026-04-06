import { Module } from '@nestjs/common';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { SupabaseStorageService } from '../../shared/services/supabase-storage.service';

@Module({
  imports: [NotificationsModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceService, SupabaseStorageService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
