import { Module } from '@nestjs/common';
import { RevenueController } from './revenue.controller';
import { RevenueService } from './revenue.service';
import { SupabaseStorageService } from '../../shared/services/supabase-storage.service';

@Module({
  controllers: [RevenueController],
  providers: [RevenueService, SupabaseStorageService],
  exports: [RevenueService],
})
export class RevenueModule {}
