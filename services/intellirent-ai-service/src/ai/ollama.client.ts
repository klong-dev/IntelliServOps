import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type OllamaChatJsonResult<T> = {
  result: T;
  model: string;
  doneReason?: string;
  usage: {
    totalDuration?: number;
    promptEvalCount?: number;
    evalCount?: number;
  };
};

type OllamaTagsResponse = {
  models: Array<{
    name: string;
  }>;
};

@Injectable()
export class OllamaClient {
  constructor(private readonly configService: ConfigService) {}

  async getTags(): Promise<OllamaTagsResponse> {
    const baseUrl = this.getBaseUrl();
    const response = await fetch(`${baseUrl}/api/tags`);
    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(
        `Ollama tags request failed (${response.status}): ${responseText}`,
      );
    }

    return (await response.json()) as OllamaTagsResponse;
  }

  async chatJson<T>(params: {
    model: string;
    messages: Array<{
      role: 'system' | 'user';
      content: string;
    }>;
    temperature?: number;
    maxTokens?: number;
  }): Promise<OllamaChatJsonResult<T>> {
    const baseUrl = this.getBaseUrl();
    const timeoutMs = parseInt(
      this.configService.get<string>('AI_RESPONSE_TIMEOUT_MS') || '20000',
      10,
    );
    const think = this.parseBoolean(
      this.configService.get<string>('OLLAMA_THINK'),
      false,
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: params.model,
          stream: false,
          format: 'json',
          think,
          messages: params.messages,
          options: {
            temperature: params.temperature ?? 0.2,
            num_predict: params.maxTokens ?? 320,
          },
        }),
        signal: controller.signal,
      });

      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(
          `Ollama chat request failed (${response.status}): ${responseText}`,
        );
      }

      const parsed = JSON.parse(responseText) as {
        model?: string;
        done_reason?: string;
        total_duration?: number;
        prompt_eval_count?: number;
        eval_count?: number;
        message?: {
          content?: string;
        };
      };

      const content = parsed.message?.content;
      if (!content) {
        throw new Error('Ollama response did not contain message.content');
      }

      return {
        result: this.parseJson<T>(content),
        model: parsed.model || params.model,
        doneReason: parsed.done_reason,
        usage: {
          totalDuration: parsed.total_duration,
          promptEvalCount: parsed.prompt_eval_count,
          evalCount: parsed.eval_count,
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseJson<T>(value: string): T {
    try {
      return JSON.parse(value) as T;
    } catch {
      const objectMatch = value.match(/\{[\s\S]*\}/);
      if (!objectMatch) {
        throw new Error('Unable to parse JSON object from Ollama response');
      }

      return JSON.parse(objectMatch[0]) as T;
    }
  }

  private getBaseUrl(): string {
    return (
      this.configService.get<string>('OLLAMA_BASE_URL') ||
      'http://127.0.0.1:11434'
    ).replace(/\/+$/g, '');
  }

  private parseBoolean(
    value: string | undefined,
    defaultValue: boolean,
  ): boolean {
    if (value === undefined) {
      return defaultValue;
    }

    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
  }
}
