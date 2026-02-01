import { Module, Global } from '@nestjs/common';
import { PrismaModule } from '../prisma';
import { RedisModule } from '../redis';
import { QueueModule } from '../queue';

/**
 * SharedModule contains all shared infrastructure modules
 * that are used across multiple feature modules.
 *
 * This module should be imported once in AppModule
 * and provides global access to common services.
 */
@Global()
@Module({
  imports: [PrismaModule, /*RedisModule,*/ /*QueueModule*/],
  exports: [PrismaModule, /*RedisModule,*/ /*QueueModule*/],
})
export class SharedModule {}
