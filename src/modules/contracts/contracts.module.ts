import { Module } from '@nestjs/common';
import { ApartmentsModule } from '../apartments/apartments.module';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { ContractPdfService } from './contract-pdf.service';

@Module({
  imports: [ApartmentsModule],
  controllers: [ContractsController],
  providers: [ContractsService, ContractPdfService],
  exports: [ContractsService, ContractPdfService],
})
export class ContractsModule {}
