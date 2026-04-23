import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SupabaseStorageService } from '../../shared/services/supabase-storage.service';

@Module({
  imports: [PaymentsModule, NotificationsModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, SupabaseStorageService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
