import { Module } from '@nestjs/common';
import { ApartmentPoliciesController } from './apartment-policies.controller';
import { ApartmentPoliciesService } from './apartment-policies.service';

@Module({
  controllers: [ApartmentPoliciesController],
  providers: [ApartmentPoliciesService],
  exports: [ApartmentPoliciesService],
})
export class ApartmentPoliciesModule {}
