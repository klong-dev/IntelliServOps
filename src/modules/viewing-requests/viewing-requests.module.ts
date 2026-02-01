import { Module } from '@nestjs/common';
import { ViewingRequestsController } from './viewing-requests.controller';
import { ViewingRequestsService } from './viewing-requests.service';

@Module({
  controllers: [ViewingRequestsController],
  providers: [ViewingRequestsService],
  exports: [ViewingRequestsService],
})
export class ViewingRequestsModule {}
