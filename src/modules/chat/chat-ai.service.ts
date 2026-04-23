import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, SenderType } from '@prisma/client';
import { existsSync, statSync } from 'fs';
import { readFile } from 'fs/promises';
import { isAbsolute, resolve } from 'path';
import { randomUUID } from 'crypto';
import { DEFAULT_AI_FAQ_ENTRIES } from './default-ai-faq';

type FaqEntry = {
  id: string;
  title: string;
  question: string;
  answer: string;
  tags?: string[];
};

export type AiContextChunk = {
  sourceType: string;
  sourceId?: string;
  title: string;
  content: string;
  priority: number;
};

type AiServiceResponse = {
  answer: string;
  model: string;
  finishReason?: string;
  confidence: number;
  shouldHandoff: boolean;
  handoffReason?: string | null;
  citations?: Array<{
    sourceType: string;
    sourceId?: string;
    title: string;
  }>;
  usage?: {
    totalDuration?: number;
    promptEvalCount?: number;
    evalCount?: number;
  };
};

type FaqCache = {
  path: string;
  mtimeMs: number;
  entries: FaqEntry[];
};

@Injectable()
export class ChatAiService {
  private readonly logger = new Logger(ChatAiService.name);
  private faqCache: FaqCache | null = null;
  private hasLoggedDisabledWarning = false;
  private hasLoggedFaqFallbackWarning = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async generateReply(params: {
    conversationId: string;
    actorType: SenderType;
    message: string;
    apartmentId?: string;
  }): Promise<AiServiceResponse | null> {
    const eligibleActors: SenderType[] = [SenderType.user, SenderType.guest];

    if (!this.isEnabled()) {
      return null;
    }

    if (!eligibleActors.includes(params.actorType)) {
      return null;
    }

    const message = params.message.trim();
    if (!message) {
      return null;
    }

    const context = await this.buildContext({
      message,
      apartmentId: params.apartmentId,
    });

    try {
      const response = await this.callAiService({
        conversationId: params.conversationId,
        actorType: params.actorType,
        message,
        context,
      });

      await this.updateConversationAiMetadata(params.conversationId, response);
      return response;
    } catch (error) {
      const errorMessage = this.describeError(error);
      this.logger.warn(`AI response skipped: ${errorMessage}`);

      const fallbackResponse: AiServiceResponse = {
        answer:
          'Mình đang tạm thời không kết nối được trợ lý AI. Mình sẽ chuyển cuộc trò chuyện này cho bộ phận hỗ trợ để phản hồi chi tiết hơn.',
        model: 'service_unavailable',
        confidence: 0,
        shouldHandoff: true,
        handoffReason: 'service_unavailable',
        citations: [],
      };

      await this.updateConversationAiMetadata(
        params.conversationId,
        fallbackResponse,
      );

      return fallbackResponse;
    }
  }

  private isEnabled(): boolean {
    const enabled = this.configService.get<boolean>('aiService.enabled');
    const provider = this.configService.get<string>('aiService.provider');
    const serviceUrl = this.configService.get<string>('aiService.serviceUrl');
    const apiKey = this.configService.get<string>('aiService.apiKey');

    const isConfigured =
      enabled === true &&
      provider === 'service' &&
      Boolean(serviceUrl) &&
      Boolean(apiKey);

    if (!isConfigured && !this.hasLoggedDisabledWarning) {
      this.logger.log(
        'AI service integration disabled or not fully configured; skipping auto-replies.',
      );
      this.hasLoggedDisabledWarning = true;
    }

    return isConfigured;
  }

  private async callAiService(payload: {
    conversationId: string;
    actorType: SenderType;
    message: string;
    context: AiContextChunk[];
  }): Promise<AiServiceResponse> {
    const serviceUrl = this.configService.getOrThrow<string>(
      'aiService.serviceUrl',
    );
    const timeoutMs = this.configService.get<number>('aiService.timeoutMs') ?? 0;
    const apiKey = this.configService.getOrThrow<string>('aiService.apiKey');

    const baseUrl = serviceUrl.replace(/\/+$/g, '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/v1/chat/respond`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-Source-Service': 'intellirentops-api',
          'X-Request-Id': randomUUID(),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(
          `AI service request failed (${response.status}): ${responseText}`,
        );
      }

      const parsed = JSON.parse(responseText) as AiServiceResponse;
      if (!parsed.answer && !parsed.shouldHandoff) {
        throw new Error('AI service returned an empty answer');
      }

      return {
        answer: parsed.answer,
        model: parsed.model,
        finishReason: parsed.finishReason,
        confidence: parsed.confidence,
        shouldHandoff: parsed.shouldHandoff,
        handoffReason: parsed.handoffReason ?? null,
        citations: parsed.citations ?? [],
        usage: parsed.usage,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async buildContext(params: {
    message: string;
    apartmentId?: string;
  }): Promise<AiContextChunk[]> {
    const maxChunks =
      this.configService.get<number>('aiService.maxContextChunks') ?? 6;

    const apartmentChunk = params.apartmentId
      ? await this.getApartmentChunk(params.apartmentId)
      : null;
    const policyChunks = await this.getPolicyChunks(
      params.message,
      params.apartmentId,
    );
    const faqChunks = await this.getFaqChunks(params.message);

    const chunks = [
      ...(apartmentChunk ? [apartmentChunk] : []),
      ...policyChunks,
      ...faqChunks,
    ];

    if (chunks.length === 0) {
      const fallbackChunk = await this.getFallbackFaqOverviewChunk();
      if (fallbackChunk) {
        chunks.push(fallbackChunk);
      }
    }

    return chunks
      .sort((a, b) => b.priority - a.priority)
      .slice(0, maxChunks)
      .map((chunk) => ({
        ...chunk,
        content: this.truncate(chunk.content, 1_500),
      }));
  }

  private async getApartmentChunk(
    apartmentId: string,
  ): Promise<AiContextChunk | null> {
    const apartment = await this.prisma.apartment.findUnique({
      where: { id: apartmentId },
      select: {
        id: true,
        slug: true,
        buildingName: true,
        apartmentNumber: true,
        status: true,
        baseRentPrice: true,
        depositAmount: true,
        totalArea: true,
        usableArea: true,
        maxOccupants: true,
        numberOfBedrooms: true,
        numberOfBathrooms: true,
        furnishingStatus: true,
        description: true,
        apartmentAmenities: {
          select: {
            amenity: {
              select: {
                name: true,
                description: true,
              },
            },
          },
        },
      },
    });

    if (!apartment) {
      return null;
    }

    const amenityNames = apartment.apartmentAmenities
      .map((item) => item.amenity.name)
      .filter(Boolean);

    return {
      sourceType: 'apartment',
      sourceId: apartment.id,
      title: apartment.buildingName
        ? `${apartment.buildingName} ${apartment.apartmentNumber}`
        : apartment.apartmentNumber,
      content: [
        `Slug: ${apartment.slug}`,
        `Trang thai cong khai: ${apartment.status}`,
        `Gia thue co ban: ${apartment.baseRentPrice.toString()} VND`,
        apartment.depositAmount
          ? `Tien coc: ${apartment.depositAmount.toString()} VND`
          : null,
        `Tong dien tich: ${apartment.totalArea.toString()} m2`,
        apartment.usableArea
          ? `Dien tich su dung: ${apartment.usableArea.toString()} m2`
          : null,
        `So phong ngu: ${apartment.numberOfBedrooms}`,
        `So phong tam: ${apartment.numberOfBathrooms}`,
        `So nguoi toi da: ${apartment.maxOccupants}`,
        `Noi that: ${apartment.furnishingStatus}`,
        amenityNames.length > 0
          ? `Tien ich: ${amenityNames.join(', ')}`
          : null,
        apartment.description ? `Mo ta: ${apartment.description}` : null,
      ]
        .filter((value): value is string => Boolean(value))
        .join('\n'),
      priority: 1_000,
    };
  }

  private async getPolicyChunks(
    message: string,
    apartmentId?: string,
  ): Promise<AiContextChunk[]> {
    const messageTokens = this.tokenize(message);
    const scoredChunks: AiContextChunk[] = [];

    const apartmentPolicies = apartmentId
      ? await this.prisma.apartmentPolicy.findMany({
          where: {
            apartmentId,
            policy: {
              isActive: true,
            },
          },
          select: {
            policy: {
              select: {
                id: true,
                title: true,
                policyType: true,
                content: true,
                version: true,
                language: true,
              },
            },
          },
        })
      : [];

    const activePolicies =
      apartmentPolicies.length > 0
        ? apartmentPolicies.map((item) => item.policy)
        : await this.prisma.policy.findMany({
            where: {
              isActive: true,
              language: 'vi',
            },
            select: {
              id: true,
              title: true,
              policyType: true,
              content: true,
              version: true,
              language: true,
              displayOrder: true,
            },
            orderBy: [{ displayOrder: 'asc' }, { updatedAt: 'desc' }],
            take: 12,
          });

    for (const policy of activePolicies) {
      const haystack = `${policy.title}\n${policy.policyType}\n${policy.content}`;
      const score = this.scoreHaystack(messageTokens, haystack);
      if (score <= 0 && apartmentPolicies.length === 0) {
        continue;
      }

      scoredChunks.push({
        sourceType: 'policy',
        sourceId: policy.id,
        title: policy.title,
        content: [
          `Loai chinh sach: ${policy.policyType}`,
          `Phien ban: ${policy.version}`,
          `Noi dung: ${policy.content}`,
        ].join('\n'),
        priority: 500 + score,
      });
    }

    return scoredChunks.sort((a, b) => b.priority - a.priority).slice(0, 3);
  }

  private async getFaqChunks(message: string): Promise<AiContextChunk[]> {
    const entries = await this.loadFaqEntries();
    const messageTokens = this.tokenize(message);

    return entries
      .map((entry) => {
        const haystack = `${entry.title}\n${entry.question}\n${entry.answer}\n${(entry.tags ?? []).join(' ')}`;
        return {
          sourceType: 'faq',
          sourceId: entry.id,
          title: entry.title,
          content: `Cau hoi: ${entry.question}\nTra loi: ${entry.answer}`,
          priority: 300 + this.scoreHaystack(messageTokens, haystack),
        } satisfies AiContextChunk;
      })
      .filter((entry) => entry.priority > 300)
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3);
  }

  private async loadFaqEntries(): Promise<FaqEntry[]> {
    const configuredPath =
      this.configService.get<string>('aiService.faqFile') ||
      'documents/ai/faq.vi.jsonl';
    const faqPath = this.resolveFaqPath(configuredPath);

    if (!faqPath) {
      this.logFaqFallback(
        `AI FAQ file not found for configured path "${configuredPath}". Falling back to embedded FAQ seed.`,
      );
      return this.getEmbeddedFaqEntries();
    }

    const stats = statSync(faqPath);
    if (
      this.faqCache &&
      this.faqCache.path === faqPath &&
      this.faqCache.mtimeMs === stats.mtimeMs
    ) {
      return this.faqCache.entries;
    }

    try {
      const content = await readFile(faqPath, 'utf8');
      const entries = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line) as FaqEntry)
        .filter(
          (entry) =>
            Boolean(entry.id) &&
            Boolean(entry.title) &&
            Boolean(entry.question) &&
            Boolean(entry.answer),
        );

      if (entries.length === 0) {
        this.logFaqFallback(
          `AI FAQ file "${faqPath}" did not contain valid entries. Falling back to embedded FAQ seed.`,
        );
        return this.getEmbeddedFaqEntries();
      }

      this.faqCache = {
        path: faqPath,
        mtimeMs: stats.mtimeMs,
        entries,
      };

      return entries;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown FAQ read error';
      this.logFaqFallback(
        `AI FAQ file "${faqPath}" could not be loaded (${errorMessage}). Falling back to embedded FAQ seed.`,
      );
      return this.getEmbeddedFaqEntries();
    }
  }

  private tokenize(input: string): string[] {
    return Array.from(
      new Set(
        input
          .toLowerCase()
          .normalize('NFD')
          .replace(/\p{Diacritic}/gu, '')
          .split(/[^\p{L}\p{N}]+/u)
          .map((token) => token.trim())
          .filter((token) => token.length >= 2),
      ),
    );
  }

  private scoreHaystack(tokens: string[], haystack: string): number {
    if (tokens.length === 0) {
      return 0;
    }

    const normalizedHaystack = haystack
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');

    let score = 0;
    for (const token of tokens) {
      if (normalizedHaystack.includes(token)) {
        score += token.length >= 5 ? 4 : 2;
      }
    }

    return score;
  }

  private truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
      return value;
    }

    return `${value.slice(0, maxLength - 3)}...`;
  }

  private describeError(error: unknown): string {
    if (!(error instanceof Error)) {
      return 'Unknown AI service error';
    }

    const messages = [error.message];
    const cause = (error as Error & { cause?: unknown }).cause;

    if (cause instanceof Error && cause.message) {
      messages.push(cause.message);
    } else if (typeof cause === 'string' && cause.trim()) {
      messages.push(cause.trim());
    }

    return Array.from(new Set(messages.filter(Boolean))).join(' | caused by: ');
  }

  private async getFallbackFaqOverviewChunk(): Promise<AiContextChunk | null> {
    const entries = await this.loadFaqEntries();
    if (entries.length === 0) {
      return null;
    }

    return {
      sourceType: 'faq_catalog',
      title: 'Tong quan cac chu de ho tro co san',
      content: entries
        .slice(0, 6)
        .map(
          (entry, index) =>
            `${index + 1}. ${entry.title}: ${entry.question} -> ${entry.answer}`,
        )
        .join('\n'),
      priority: 120,
    };
  }

  private resolveFaqPath(configuredPath: string): string | null {
    const candidatePaths = isAbsolute(configuredPath)
      ? [configuredPath]
      : [
          resolve(process.cwd(), configuredPath),
          resolve(__dirname, '../../..', configuredPath),
        ];

    for (const candidatePath of Array.from(new Set(candidatePaths))) {
      if (existsSync(candidatePath)) {
        return candidatePath;
      }
    }

    return null;
  }

  private getEmbeddedFaqEntries(): FaqEntry[] {
    return DEFAULT_AI_FAQ_ENTRIES.map((entry) => ({
      id: entry.id,
      title: entry.title,
      question: entry.question,
      answer: entry.answer,
      tags: [...entry.tags],
    }));
  }

  private logFaqFallback(message: string) {
    if (this.hasLoggedFaqFallbackWarning) {
      return;
    }

    this.hasLoggedFaqFallbackWarning = true;
    this.logger.warn(message);
  }

  private async updateConversationAiMetadata(
    conversationId: string,
    response: Pick<
      AiServiceResponse,
      'model' | 'confidence' | 'shouldHandoff' | 'handoffReason' | 'citations'
    >,
  ) {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
      select: { metadata: true },
    });

    if (!conversation) {
      return;
    }

    const existingMetadata = this.asJsonObject(conversation.metadata);
    const aiMetadata = this.asJsonObject(existingMetadata.ai);

    aiMetadata.lastResponseAt = new Date().toISOString();
    aiMetadata.lastModel = response.model || null;
    aiMetadata.lastConfidence = response.confidence;
    aiMetadata.needsHuman = response.shouldHandoff;
    aiMetadata.handoffReason = response.handoffReason ?? null;
    aiMetadata.citations = response.citations ?? [];

    existingMetadata.ai = aiMetadata;

    await this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: {
        metadata: JSON.parse(
          JSON.stringify(existingMetadata),
        ) as Prisma.InputJsonValue,
      },
    });
  }

  private asJsonObject(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return { ...(value as Record<string, unknown>) };
    }

    return {};
  }
}
