import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OllamaClient } from './ai/ollama.client';

@Controller()
export class HealthController {
  constructor(
    private readonly ollamaClient: OllamaClient,
    private readonly configService: ConfigService,
  ) {}

  @Get('health')
  async getHealth() {
    try {
      const tags = await this.ollamaClient.getTags();
      return {
        status: 'ok',
        service: 'intellirent-ai-service',
        timestamp: new Date().toISOString(),
        defaultModel: this.configService.get<string>('OLLAMA_MODEL') || null,
        fallbackModel:
          this.configService.get<string>('AI_FALLBACK_MODEL') || null,
        availableModels: tags.models.map((model) => model.name),
      };
    } catch (error) {
      throw new ServiceUnavailableException(
        error instanceof Error ? error.message : 'Ollama is not reachable',
      );
    }
  }
}
