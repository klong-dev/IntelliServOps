import { Module } from '@nestjs/common';
import { ApartmentsModule } from '../apartments/apartments.module';
import { IoTModule } from '../iot/iot.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { ContractPdfService } from './contract-pdf.service';
import { SupabaseStorageService } from '../../shared/services/supabase-storage.service';

@Module({
  imports: [ApartmentsModule, NotificationsModule, IoTModule],
  controllers: [ContractsController],
  providers: [ContractsService, ContractPdfService, SupabaseStorageService],
  exports: [ContractsService, ContractPdfService],
})
export class ContractsModule {}
