import { Module } from '@nestjs/common';
import { ApartmentsController } from './apartments.controller';
import { ApartmentsService } from './apartments.service';
import { SupabaseStorageService } from '../../shared/services/supabase-storage.service';
import { ContractPdfService } from '../contracts/contract-pdf.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ApartmentsController],
  providers: [ApartmentsService, SupabaseStorageService, ContractPdfService],
  exports: [ApartmentsService],
})
export class ApartmentsModule {}
