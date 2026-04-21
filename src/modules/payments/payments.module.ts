import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { IoTModule } from '../iot/iot.module';
import { SupabaseStorageService } from '../../shared/services/supabase-storage.service';

@Module({
  imports: [NotificationsModule, IoTModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, SupabaseStorageService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
