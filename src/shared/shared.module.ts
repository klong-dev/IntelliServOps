import { Module, Global } from '@nestjs/common';
import { PrismaModule } from '../prisma';
import { RedisModule } from '../redis';
import { QueueModule } from '../queue';
import { FptAiService } from './services/fpt-ai.service';

/**
 * SharedModule contains all shared infrastructure modules
 * that are used across multiple feature modules.
 *
 * This module should be imported once in AppModule
 * and provides global access to common services.
 */
@Global()
@Module({
  imports: [PrismaModule, RedisModule, QueueModule],
  providers: [FptAiService],
  exports: [PrismaModule, RedisModule, QueueModule, FptAiService],
})
export class SharedModule {}
