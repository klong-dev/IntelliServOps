import { Module } from '@nestjs/common';
import { UserApartmentsController } from './user-apartments.controller';
import { UserApartmentsService } from './user-apartments.service';

@Module({
  controllers: [UserApartmentsController],
  providers: [UserApartmentsService],
  exports: [UserApartmentsService],
})
export class UserApartmentsModule {}
