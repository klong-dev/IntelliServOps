import { Injectable } from '@nestjs/common';
import { ChatRespondRequestDto, ContextChunkDto } from './dto';

type PromptBuildResult = {
  messages: Array<{
    role: 'system' | 'user';
    content: string;
  }>;
  sourceMap: Map<string, ContextChunkDto>;
};

@Injectable()
export class PromptBuilderService {
  build(request: ChatRespondRequestDto): PromptBuildResult {
    const sourceMap = new Map<string, ContextChunkDto>();
    const contextSections = request.context.map((chunk, index) => {
      const sourceKey = `S${index + 1}`;
      sourceMap.set(sourceKey, chunk);

      return [
        `[${sourceKey}] ${chunk.title}`,
        `sourceType: ${chunk.sourceType}`,
        chunk.sourceId ? `sourceId: ${chunk.sourceId}` : null,
        chunk.content,
      ]
        .filter((value): value is string => Boolean(value))
        .join('\n');
    });

    const language = request.options?.language || 'vi';
    const systemPrompt = [
      'You are HomeIQ Assistant for a property rental support platform.',
      `Answer in ${language === 'vi' ? 'Vietnamese' : language}.`,
      'Use only the provided context.',
      'Do not invent facts that are not present in the context.',
      'If the question is sensitive, account-specific, billing-specific, contract-specific, or the context is not enough, set shouldHandoff=true.',
      'Return strict JSON only with this shape:',
      '{"answer":"string","confidence":0.0,"shouldHandoff":false,"handoffReason":"string|null","sourceIds":["S1"]}',
      'sourceIds must only contain source keys that exist in the provided context.',
    ].join(' ');

    const userPrompt = [
      'QUESTION:',
      request.message.trim(),
      '',
      'CONTEXT:',
      contextSections.length > 0
        ? contextSections.join('\n\n')
        : 'No context was provided.',
      '',
      'Return JSON only. No markdown.',
    ].join('\n');

    return {
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      sourceMap,
    };
  }
}
