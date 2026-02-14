import { Module, Logger } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

const logger = new Logger('QueueModule');

export const QUEUE_NAMES = {
  EMAIL: 'email-queue',
  NOTIFICATION: 'notification-queue',
  PAYMENT: 'payment-queue',
  IOT: 'iot-queue',
  INVOICE: 'invoice-queue',
  SMS: 'sms-queue',
} as const;

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const password = configService.get('redis.password');
        return {
          connection: {
            host: configService.get('redis.host'),
            port: configService.get('redis.port'),
            password: password && password.trim() ? password : undefined,
            maxRetriesPerRequest: null, // Required for BullMQ
            retryStrategy: (times: number) => {
              if (times > 20) {
                logger.error(
                  `BullMQ Redis: Too many reconnect attempts (${times}). Giving up.`,
                );
                return null;
              }
              const delay = Math.min(times * 500, 5000);
              logger.warn(
                `BullMQ Redis: Reconnecting in ${delay}ms... (attempt ${times})`,
              );
              return delay;
            },
          },
        };
      },
    }),
    // Register queues
    BullModule.registerQueue(
      { name: QUEUE_NAMES.EMAIL },
      { name: QUEUE_NAMES.NOTIFICATION },
      { name: QUEUE_NAMES.PAYMENT },
      { name: QUEUE_NAMES.IOT },
      { name: QUEUE_NAMES.INVOICE },
      { name: QUEUE_NAMES.SMS },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
