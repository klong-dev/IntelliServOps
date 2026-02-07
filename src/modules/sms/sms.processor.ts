import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SmsService } from './sms.service';
import { QUEUE_NAMES } from '../../queue/queue.module';

@Processor(QUEUE_NAMES.SMS)
export class SmsProcessor extends WorkerHost {
  private readonly logger = new Logger(SmsProcessor.name);

  constructor(private readonly smsService: SmsService) {
    super();
  }

  async process(job: Job<{ phone: string }>): Promise<void> {
    const jobId = job.id;
    const phone = job.data.phone;
    this.logger.log(`Processing SMS job ${jobId} for phone: ${phone}`);

    try {
      await this.smsService.sendOtp(phone);
      this.logger.log(`SMS job ${jobId} completed successfully`);
    } catch (error) {
      this.logger.error(`SMS job ${jobId} failed:`, error);
      throw error;
    }
  }
}
