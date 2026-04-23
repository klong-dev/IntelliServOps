import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from './ai/ai.module';
import { HealthController } from './health.controller';
import { OllamaClient } from './ai/ollama.client';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    AiModule,
  ],
  controllers: [HealthController],
  providers: [OllamaClient],
})
export class AppModule {}
