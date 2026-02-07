import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SmsService } from './sms.service';
import { SmsProcessor } from './sms.processor';
import { QUEUE_NAMES } from '../../queue/queue.module';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.SMS })],
  providers: [SmsService, SmsProcessor],
  exports: [SmsService],
})
export class SmsModule {}
