import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { OllamaClient } from './ollama.client';
import { PromptBuilderService } from './prompt-builder.service';
import { SafetyPolicyService } from './safety-policy.service';
import { ApiKeyGuard } from '../common/guards/api-key.guard';

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    OllamaClient,
    PromptBuilderService,
    SafetyPolicyService,
    ApiKeyGuard,
  ],
})
export class AiModule {}
