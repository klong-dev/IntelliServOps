import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatRespondRequestDto, ContextChunkDto } from './dto';
import { OllamaClient } from './ollama.client';
import { PromptBuilderService } from './prompt-builder.service';
import { SafetyPolicyService } from './safety-policy.service';

type ModelOutput = {
  answer?: string;
  confidence?: number;
  shouldHandoff?: boolean;
  handoffReason?: string | null;
  sourceIds?: string[];
};

type AiResponse = {
  answer: string;
  model: string;
  finishReason?: string;
  confidence: number;
  shouldHandoff: boolean;
  handoffReason?: string | null;
  citations: Array<{
    sourceType: string;
    sourceId?: string;
    title: string;
  }>;
  usage: {
    totalDuration?: number;
    promptEvalCount?: number;
    evalCount?: number;
  };
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly ollamaClient: OllamaClient,
    private readonly promptBuilder: PromptBuilderService,
    private readonly safetyPolicy: SafetyPolicyService,
  ) {}

  async respond(request: ChatRespondRequestDto): Promise<AiResponse> {
    const selectedContext = [...request.context]
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
      .slice(
        0,
        parseInt(
          this.configService.get<string>('AI_MAX_CONTEXT_CHUNKS') || '6',
          10,
        ),
      );

    const safetyDecision = this.safetyPolicy.evaluate(
      request.message,
      selectedContext.length,
    );
    if (safetyDecision) {
      return {
        answer: safetyDecision.answer,
        model: 'policy',
        confidence: safetyDecision.confidence,
        shouldHandoff: true,
        handoffReason: safetyDecision.handoffReason,
        citations: [],
        usage: {},
      };
    }

    const normalizedRequest: ChatRespondRequestDto = {
      ...request,
      context: selectedContext,
    };

    const { messages, sourceMap } = this.promptBuilder.build(normalizedRequest);
    const modelsToTry = this.buildModelCandidates(request);
    let lastError: unknown = null;

    for (const model of modelsToTry) {
      try {
        const ollamaResult = await this.ollamaClient.chatJson<ModelOutput>({
          model,
          messages,
          temperature: request.options?.temperature,
          maxTokens: request.options?.maxTokens,
        });

        return this.normalizeResponse({
          modelOutput: ollamaResult.result,
          model: ollamaResult.model,
          finishReason: ollamaResult.doneReason,
          usage: ollamaResult.usage,
          sourceMap,
        });
      } catch (error) {
        lastError = error;
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown Ollama error';
        this.logger.warn(`Model ${model} failed: ${errorMessage}`);
      }
    }

    throw new ServiceUnavailableException(
      lastError instanceof Error
        ? lastError.message
        : 'All configured models failed',
    );
  }

  async getModels() {
    const tags = await this.ollamaClient.getTags();
    return {
      defaultModel: this.configService.get<string>('OLLAMA_MODEL') || null,
      fallbackModel:
        this.configService.get<string>('AI_FALLBACK_MODEL') || null,
      availableModels: tags.models.map((model) => model.name),
    };
  }

  private buildModelCandidates(request: ChatRespondRequestDto): string[] {
    return Array.from(
      new Set(
        [
          this.configService.get<string>('OLLAMA_MODEL') || 'qwen3:4b',
          request.options?.fallbackModel,
          this.configService.get<string>('AI_FALLBACK_MODEL'),
        ].filter((value): value is string => Boolean(value)),
      ),
    );
  }

  private normalizeResponse(params: {
    modelOutput: ModelOutput;
    model: string;
    finishReason?: string;
    usage: {
      totalDuration?: number;
      promptEvalCount?: number;
      evalCount?: number;
    };
    sourceMap: Map<string, ContextChunkDto>;
  }): AiResponse {
    const threshold = parseFloat(
      this.configService.get<string>('AI_CONFIDENCE_THRESHOLD') || '0.72',
    );
    const answer = (params.modelOutput.answer || '').trim();
    const confidence = this.clampNumber(params.modelOutput.confidence, 0, 1);
    let shouldHandoff = params.modelOutput.shouldHandoff === true;
    let handoffReason = params.modelOutput.handoffReason || null;

    const citations = (params.modelOutput.sourceIds || [])
      .filter((sourceId, index, values) => values.indexOf(sourceId) === index)
      .map((sourceId) => params.sourceMap.get(sourceId))
      .filter((chunk): chunk is ContextChunkDto => Boolean(chunk))
      .map((chunk) => ({
        sourceType: chunk.sourceType,
        sourceId: chunk.sourceId,
        title: chunk.title,
      }));

    if (!answer) {
      shouldHandoff = true;
      handoffReason = handoffReason || 'empty_answer';
    }

    if (!shouldHandoff && confidence < threshold) {
      shouldHandoff = true;
      handoffReason = handoffReason || 'low_confidence';
    }

    const finalAnswer = shouldHandoff
      ? answer ||
        'Mình đã ghi nhận yêu cầu và sẽ chuyển cho bộ phận hỗ trợ để phản hồi chi tiết hơn.'
      : answer;

    return {
      answer: finalAnswer,
      model: params.model,
      finishReason: params.finishReason,
      confidence,
      shouldHandoff,
      handoffReason,
      citations,
      usage: params.usage,
    };
  }

  private clampNumber(
    value: number | undefined,
    min: number,
    max: number,
  ): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return 0;
    }

    return Math.min(max, Math.max(min, value));
  }
}
