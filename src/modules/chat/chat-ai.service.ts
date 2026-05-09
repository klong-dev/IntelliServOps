import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ApartmentStatus,
  FurnishingStatus,
  Prisma,
  SenderType,
} from '@prisma/client';
import { existsSync, statSync } from 'fs';
import { readFile } from 'fs/promises';
import { isAbsolute, resolve } from 'path';
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

export type AiIntent = 'ai_chat' | 'human_support';

export type ChatBlock =
  | { type: 'text'; text: string }
  | { type: 'apartment_card'; apartmentId: string };

type GeminiModelOutput = {
  answer?: string;
  intent?: AiIntent;
  confidence?: number;
  shouldHandoff?: boolean;
  handoffReason?: string | null;
  sourceIds?: string[];
  blocks?: ChatBlock[];
};

export type AiServiceResponse = {
  answer: string;
  model: string;
  finishReason?: string;
  intent: AiIntent;
  confidence: number;
  shouldHandoff: boolean;
  handoffReason?: string | null;
  citations?: Array<{
    sourceType: string;
    sourceId?: string;
    title: string;
  }>;
  blocks?: ChatBlock[];
  usage?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

type FaqCache = {
  path: string;
  mtimeMs: number;
  entries: FaqEntry[];
};

const PUBLIC_LISTING_STATUSES: ApartmentStatus[] = [
  ApartmentStatus.available,
  ApartmentStatus.reserved,
  ApartmentStatus.pending,
];

const APARTMENT_DISCOVERY_PHRASES = [
  'danh sach nha',
  'danh sach can ho',
  'danh sach phong',
  'tim nha',
  'tim can ho',
  'tim phong',
  'thue nha',
  'thue can ho',
  'thue phong',
  'goi y can ho',
  'goi y nha',
  'co can ho nao',
  'co nha nao',
  'con nha khong',
  'con phong khong',
  'con can ho khong',
  'gan',
  'gan dai hoc',
  'dai hoc',
  'fpt',
  'dam sen',
  'khu vuc',
  'quan',
  'district',
];

const HO_CHI_MINH_ALIASES = [
  'sai gon',
  'saigon',
  'tp hcm',
  'tphcm',
  'tp ho chi minh',
  'thanh pho ho chi minh',
  'ho chi minh',
  'hcm',
];

const BUDGET_PHRASES = [
  'duoi',
  'toi da',
  'khong qua',
  'nho hon',
  're hon',
  'tam gia',
  'ngan sach',
  'budget',
  'under',
  'below',
  'max',
];

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
      const response = await this.callAiProvider({
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
        intent: 'human_support',
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
    const geminiApiKey = this.configService.get<string>('aiService.geminiApiKey');
    const openAiApiKey = this.configService.get<string>('aiService.openAiApiKey');
    const openAiBaseUrl = this.configService.get<string>('aiService.openAiBaseUrl');

    const isConfigured =
      enabled === true &&
      ((provider === 'gemini' && Boolean(geminiApiKey)) ||
        (provider === 'openai' && Boolean(openAiApiKey) && Boolean(openAiBaseUrl)));

    if (!isConfigured && !this.hasLoggedDisabledWarning) {
      this.logger.log(
        'AI chat integration disabled or not fully configured; skipping auto-replies.',
      );
      this.hasLoggedDisabledWarning = true;
    }

    return isConfigured;
  }

  private async callAiProvider(payload: {
    actorType: SenderType;
    message: string;
    context: AiContextChunk[];
  }): Promise<AiServiceResponse> {
    const provider = this.configService.get<string>('aiService.provider');

    if (provider === 'openai') {
      return this.callOpenAiCompatible(payload);
    }

    return this.callGemini(payload);
  }

  private async callGemini(payload: {
    actorType: SenderType;
    message: string;
    context: AiContextChunk[];
  }): Promise<AiServiceResponse> {
    const apiKey = this.configService.getOrThrow<string>(
      'aiService.geminiApiKey',
    );
    const model =
      this.configService.get<string>('aiService.geminiModel') || 'gemini-2.5-flash';
    const timeoutMs = this.configService.get<number>('aiService.timeoutMs') ?? 0;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.buildGeminiRequest(payload)),
          signal: controller.signal,
        },
      );

      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(`Gemini request failed (${response.status}): ${responseText}`);
      }

      const parsed = JSON.parse(responseText) as {
        candidates?: Array<{
          finishReason?: string;
          content?: { parts?: Array<{ text?: string }> };
        }>;
        usageMetadata?: AiServiceResponse['usage'];
      };
      const rawText =
        parsed.candidates?.[0]?.content?.parts
          ?.map((part) => part.text ?? '')
          .join('') ?? '';
      const modelOutput = this.parseModelOutput(rawText);

      return this.normalizeGeminiResponse({
        model,
        finishReason: parsed.candidates?.[0]?.finishReason,
        modelOutput,
        context: payload.context,
        usage: parsed.usageMetadata,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async callOpenAiCompatible(payload: {
    actorType: SenderType;
    message: string;
    context: AiContextChunk[];
  }): Promise<AiServiceResponse> {
    const apiKey = this.configService.getOrThrow<string>('aiService.openAiApiKey');
    const baseUrl = this.configService
      .getOrThrow<string>('aiService.openAiBaseUrl')
      .replace(/\/+$/, '');
    const model = this.configService.get<string>('aiService.openAiModel') || 'main';
    const wireApi = this.configService.get<string>('aiService.openAiWireApi') || 'chat';
    const timeoutMs = this.configService.get<number>('aiService.timeoutMs') ?? 0;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(
        wireApi === 'responses' ? `${baseUrl}/responses` : `${baseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
            wireApi === 'responses'
              ? {
                  model,
                  temperature: 0.2,
                  input: this.buildAiPrompt(payload),
                  text: { format: { type: 'json_object' } },
                }
              : {
                  model,
                  temperature: 0.2,
                  response_format: { type: 'json_object' },
                  messages: [
                    {
                      role: 'user',
                      content: this.buildAiPrompt(payload),
                    },
                  ],
                },
          ),
          signal: controller.signal,
        },
      );

      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(`OpenAI-compatible request failed (${response.status}): ${responseText}`);
      }

      const parsed = JSON.parse(responseText) as {
        output_text?: string;
        output?: Array<{ content?: Array<{ text?: string }> }>;
        choices?: Array<{ finish_reason?: string; message?: { content?: string } }>;
        usage?: {
          input_tokens?: number;
          output_tokens?: number;
          total_tokens?: number;
          prompt_tokens?: number;
          completion_tokens?: number;
        };
      };
      const rawText =
        parsed.output_text ??
        parsed.output
          ?.flatMap((item) => item.content ?? [])
          .map((item) => item.text ?? '')
          .join('') ??
        parsed.choices?.[0]?.message?.content ??
        '';
      const modelOutput = this.parseModelOutput(rawText);

      return this.normalizeGeminiResponse({
        model,
        finishReason: parsed.choices?.[0]?.finish_reason,
        modelOutput,
        context: payload.context,
        usage: parsed.usage
          ? {
              promptTokenCount: parsed.usage.input_tokens ?? parsed.usage.prompt_tokens,
              candidatesTokenCount: parsed.usage.output_tokens ?? parsed.usage.completion_tokens,
              totalTokenCount: parsed.usage.total_tokens,
            }
          : undefined,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildGeminiRequest(payload: {
    actorType: SenderType;
    message: string;
    context: AiContextChunk[];
  }) {
    return {
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: this.buildAiPrompt(payload) }],
        },
      ],
    };
  }

  private buildAiPrompt(payload: {
    actorType: SenderType;
    message: string;
    context: AiContextChunk[];
  }) {
    const sourceSections = payload.context.map((chunk, index) =>
      [
        `[S${index + 1}] ${chunk.title}`,
        `sourceType: ${chunk.sourceType}`,
        chunk.sourceId ? `sourceId: ${chunk.sourceId}` : null,
        chunk.content,
      ]
        .filter((value): value is string => Boolean(value))
        .join('\n'),
    );

    return [
      'Bạn là HomeIQ Assistant cho nền tảng cho thuê căn hộ.',
      'Mặc định trả lời bằng tiếng Việt như AI tư vấn.',
      'Chỉ chuyển CSKH khi người dùng yêu cầu gặp người thật/CSKH/nhân viên, khiếu nại, hoặc câu hỏi nhạy cảm về tài khoản/thanh toán/hợp đồng riêng.',
      'Chỉ dùng CONTEXT, không bịa dữ liệu.',
      'Nếu gợi ý căn hộ, có thể thêm block apartment_card với apartmentId bằng sourceId từ context sourceType apartment hoặc ID xuất hiện trong apartment_catalog.',
      'Trả JSON strict: {"answer":"string","intent":"ai_chat|human_support","confidence":0.0,"shouldHandoff":false,"handoffReason":null,"sourceIds":["S1"],"blocks":[{"type":"text","text":"string"},{"type":"apartment_card","apartmentId":"string"}]}',
      '',
      `ACTOR: ${payload.actorType}`,
      `QUESTION: ${payload.message}`,
      '',
      'CONTEXT:',
      sourceSections.length > 0
        ? sourceSections.join('\n\n')
        : 'No context was provided.',
    ].join('\n');
  }

  private parseModelOutput(rawText: string): GeminiModelOutput {
    const trimmed = rawText.trim();
    if (!trimmed) {
      throw new Error('Gemini returned an empty response');
    }

    const jsonText = trimmed
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    return JSON.parse(jsonText) as GeminiModelOutput;
  }

  private normalizeGeminiResponse(params: {
    model: string;
    finishReason?: string;
    modelOutput: GeminiModelOutput;
    context: AiContextChunk[];
    usage?: AiServiceResponse['usage'];
  }): AiServiceResponse {
    const sourceMap = new Map<string, AiContextChunk>(
      params.context.map((chunk, index) => [`S${index + 1}`, chunk]),
    );
    const allowedApartmentIds = new Set(
      params.context
        .filter((chunk) => ['apartment', 'apartment_catalog'].includes(chunk.sourceType))
        .flatMap((chunk) => [
          ...(chunk.sourceId ? [chunk.sourceId] : []),
          ...Array.from(chunk.content.matchAll(/ID: ([^\n]+)/g)).map((match) => match[1]),
        ]),
    );

    for (const chunk of params.context) {
      if (chunk.sourceType === 'apartment' && chunk.sourceId) {
        allowedApartmentIds.add(chunk.sourceId);
      }
      const idMatches = chunk.content.matchAll(/ID: ([^\n]+)/g);
      for (const match of idMatches) {
        allowedApartmentIds.add(match[1]);
      }
    }

    const answer = (params.modelOutput.answer ?? '').trim();
    const confidence =
      typeof params.modelOutput.confidence === 'number'
        ? this.clampNumber(params.modelOutput.confidence, 0, 1)
        : 0.8;
    const intent = params.modelOutput.intent === 'human_support' ? 'human_support' : 'ai_chat';
    let shouldHandoff = params.modelOutput.shouldHandoff === true || intent === 'human_support';
    let handoffReason = params.modelOutput.handoffReason ?? null;

    if (!answer) {
      shouldHandoff = true;
      handoffReason = handoffReason || 'empty_answer';
    }

    const citations = (params.modelOutput.sourceIds ?? [])
      .filter((sourceId, index, values) => values.indexOf(sourceId) === index)
      .map((sourceId) => sourceMap.get(sourceId))
      .filter((chunk): chunk is AiContextChunk => Boolean(chunk))
      .map((chunk) => ({
        sourceType: chunk.sourceType,
        sourceId: chunk.sourceId,
        title: chunk.title,
      }));

    const blocks = this.normalizeBlocks(
      params.modelOutput.blocks,
      allowedApartmentIds,
      answer,
      params.context,
    );

    return {
      answer: shouldHandoff
        ? answer ||
          'Mình sẽ chuyển cuộc trò chuyện này cho bộ phận hỗ trợ để phản hồi chi tiết hơn.'
        : answer,
      model: params.model,
      finishReason: params.finishReason,
      intent: shouldHandoff ? 'human_support' : 'ai_chat',
      confidence,
      shouldHandoff,
      handoffReason,
      citations,
      blocks,
      usage: params.usage,
    };
  }

  private normalizeBlocks(
    blocks: ChatBlock[] | undefined,
    allowedApartmentIds: Set<string>,
    answer: string,
    context: AiContextChunk[],
  ): ChatBlock[] {
    const normalized: ChatBlock[] = [];

    for (const block of blocks ?? []) {
      if (block.type === 'text' && block.text.trim()) {
        normalized.push({ type: 'text', text: block.text.trim() });
      }

      if (
        block.type === 'apartment_card' &&
        allowedApartmentIds.has(String(block.apartmentId))
      ) {
        normalized.push({ type: 'apartment_card', apartmentId: String(block.apartmentId) });
      }
    }

    if (!normalized.some((block) => block.type === 'text') && answer.trim()) {
      normalized.unshift({ type: 'text', text: answer.trim() });
    }

    const existingCardIds = new Set(
      normalized
        .filter((block): block is { type: 'apartment_card'; apartmentId: string } =>
          block.type === 'apartment_card',
        )
        .map((block) => block.apartmentId),
    );

    for (const apartmentId of this.extractApartmentIdsForCards(context, answer)) {
      if (!allowedApartmentIds.has(apartmentId) || existingCardIds.has(apartmentId)) {
        continue;
      }

      normalized.push({ type: 'apartment_card', apartmentId });
      existingCardIds.add(apartmentId);
    }

    return normalized;
  }

  private extractApartmentIdsForCards(
    context: AiContextChunk[],
    answer: string,
  ): string[] {
    const normalizedAnswer = this.normalizeText(answer);
    const apartmentRefs = context
      .filter((chunk) => ['apartment', 'apartment_catalog'].includes(chunk.sourceType))
      .flatMap((chunk) => {
        const refs: Array<{ id: string; label: string; codes: string[] }> = [];

        if (chunk.sourceId) {
          const label = `${chunk.title}\n${chunk.content}`;
          refs.push({ id: chunk.sourceId, label, codes: this.extractApartmentCodes(label) });
        }

        const entries = chunk.content.split(/\n\n+/);
        for (const entry of entries) {
          const id = entry.match(/ID: ([^\n]+)/)?.[1]?.trim();
          if (!id) {
            continue;
          }

          refs.push({ id, label: entry, codes: this.extractApartmentCodes(entry) });
        }

        return refs;
      });

    const selectedIds = apartmentRefs
      .filter((ref) => {
        const normalizedLabel = this.normalizeText(ref.label);
        return (
          normalizedAnswer.includes(this.normalizeText(ref.id)) ||
          ref.codes.some((code) => normalizedAnswer.includes(code)) ||
          normalizedLabel
            .split(' ')
            .filter((token) => token.length >= 4)
            .some((token) => normalizedAnswer.includes(token))
        );
      })
      .map((ref) => ref.id);

    const uniqueSelectedIds = Array.from(new Set(selectedIds));
    if (uniqueSelectedIds.length > 0) {
      return uniqueSelectedIds.slice(0, 3);
    }

    return Array.from(new Set(apartmentRefs.map((ref) => ref.id))).slice(0, 3);
  }

  private extractApartmentCodes(input: string): string[] {
    return this.extractApartmentCodeQueries(input)
      .map((code) => this.normalizeText(code))
      .filter((code, index, values) => values.indexOf(code) === index);
  }

  private extractApartmentCodeQueries(input: string): string[] {
    return Array.from(input.matchAll(/\bHIQ\s*-?\s*\d+[A-Z]?\b/gi))
      .flatMap((match) => {
        const compact = match[0].replace(/\s+/g, '').toUpperCase();
        const normalized = compact.replace(/-/g, '');
        return [compact, normalized];
      })
      .filter((code, index, values) => values.indexOf(code) === index);
  }

  private extractPriceReferencesVnd(input: string): number[] {
    return Array.from(input.matchAll(/(\d+(?:[.,]\d+)?)\s*(trieu|tr|m|k|nghin|ngan|d|dong|vnd|đ)?/gi))
      .map((match) => {
        const amount = Number(match[1].replace(',', '.'));
        if (!Number.isFinite(amount) || amount <= 0) {
          return null;
        }

        const unit = this.normalizeText(match[2] ?? '');
        if (['trieu', 'tr', 'm'].includes(unit)) {
          return Math.round(amount * 1_000_000);
        }
        if (['k', 'nghin', 'ngan'].includes(unit)) {
          return Math.round(amount * 1_000);
        }
        if (['d', 'dong', 'vnd'].includes(unit)) {
          return Math.round(amount);
        }

        return amount < 1_000 ? Math.round(amount * 1_000) : Math.round(amount);
      })
      .filter((price): price is number => price !== null)
      .filter((price, index, values) => values.indexOf(price) === index);
  }

  private clampNumber(value: number | undefined, min: number, max: number): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return 0;
    }

    return Math.min(max, Math.max(min, value));
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
    const apartmentCatalogChunks = await this.getApartmentCatalogChunks(
      params.message,
      params.apartmentId,
    );
    const policyChunks = await this.getPolicyChunks(
      params.message,
      params.apartmentId,
    );
    const faqChunks = await this.getFaqChunks(params.message);

    const chunks = [
      ...(apartmentChunk ? [apartmentChunk] : []),
      ...apartmentCatalogChunks,
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

  private async getApartmentCatalogChunks(
    message: string,
    apartmentId?: string,
  ): Promise<AiContextChunk[]> {
    if (apartmentId) {
      return [];
    }

    const normalizedMessage = this.normalizeText(message);
    const maxBudgetVnd = this.extractMaxBudgetVnd(normalizedMessage);
    const apartmentCodes = this.extractApartmentCodes(message);
    const apartmentCodeQueries = this.extractApartmentCodeQueries(message);
    const priceReferences = this.extractPriceReferencesVnd(message);
    if (
      !this.isApartmentDiscoveryMessage(normalizedMessage, maxBudgetVnd) &&
      apartmentCodes.length === 0 &&
      priceReferences.length === 0
    ) {
      return [];
    }

    const isHoChiMinhQuery = HO_CHI_MINH_ALIASES.some((alias) =>
      normalizedMessage.includes(alias),
    );
    const apartmentSelect = {
      id: true,
      buildingName: true,
      apartmentNumber: true,
      slug: true,
      streetAddress: true,
      totalArea: true,
      numberOfBedrooms: true,
      numberOfBathrooms: true,
      furnishingStatus: true,
      baseRentPrice: true,
      depositAmount: true,
      status: true,
      description: true,
    } satisfies Prisma.ApartmentSelect;

    const apartmentWhere = {
      status: { in: PUBLIC_LISTING_STATUSES },
      ...(isHoChiMinhQuery ? { provinceCode: 79 } : {}),
      ...(maxBudgetVnd
        ? { baseRentPrice: { lte: new Prisma.Decimal(maxBudgetVnd) } }
        : {}),
      ...(apartmentCodeQueries.length > 0
        ? {
            OR: apartmentCodeQueries.flatMap((code) => [
              { apartmentNumber: { contains: code, mode: 'insensitive' as const } },
              { slug: { contains: code, mode: 'insensitive' as const } },
              { buildingName: { contains: code, mode: 'insensitive' as const } },
            ]),
          }
        : {}),
    } satisfies Prisma.ApartmentWhereInput;
    const apartmentOrderBy = maxBudgetVnd
      ? [{ baseRentPrice: 'asc' as const }, { updatedAt: 'desc' as const }]
      : [{ updatedAt: 'desc' as const }];

    let apartments = await this.prisma.apartment.findMany({
      where: apartmentWhere,
      select: apartmentSelect,
      orderBy: apartmentOrderBy,
      take: maxBudgetVnd || apartmentCodes.length > 0 || priceReferences.length > 0 ? 30 : 18,
    });

    if (apartments.length === 0 && isHoChiMinhQuery) {
      apartments = await this.prisma.apartment.findMany({
        where: {
          status: { in: PUBLIC_LISTING_STATUSES },
          ...(maxBudgetVnd
            ? { baseRentPrice: { lte: new Prisma.Decimal(maxBudgetVnd) } }
            : {}),
        },
        select: apartmentSelect,
        orderBy: apartmentOrderBy,
        take: maxBudgetVnd ? 30 : 18,
      });
    }

    if (apartments.length === 0 && priceReferences.length > 0) {
      apartments = await this.prisma.apartment.findMany({
        where: {
          status: { in: PUBLIC_LISTING_STATUSES },
          OR: priceReferences.flatMap((price) => [
            { baseRentPrice: new Prisma.Decimal(price) },
            { depositAmount: new Prisma.Decimal(price) },
          ]),
        },
        select: apartmentSelect,
        orderBy: apartmentOrderBy,
        take: 30,
      });
    }

    if (apartments.length === 0) {
      return [];
    }

    const messageTokens = this.tokenize(message);
    const scoredApartments = apartments
      .map((apartment) => {
        const haystack = [
          apartment.buildingName,
          apartment.apartmentNumber,
          apartment.streetAddress,
          apartment.description,
          apartment.slug,
        ]
          .filter((value): value is string => Boolean(value))
          .join('\n');

        const exactCodeScore = apartmentCodes.some((code) =>
          this.normalizeText(haystack).includes(code),
        )
          ? 100
          : 0;
        const priceReferenceScore = priceReferences.some(
          (price) =>
            Number(apartment.baseRentPrice) === price ||
            Number(apartment.depositAmount) === price,
        )
          ? 80
          : 0;
        const priceScore = maxBudgetVnd ? 50 : 0;
        const score =
          this.scoreHaystack(messageTokens, haystack) +
          exactCodeScore +
          priceReferenceScore +
          (isHoChiMinhQuery ? 20 : 0) +
          priceScore;

        return {
          apartment,
          score,
        };
      })
      .filter(({ score }) => score > 0 || Boolean(maxBudgetVnd))
      .sort((a, b) => {
        if (maxBudgetVnd) {
          return Number(a.apartment.baseRentPrice) - Number(b.apartment.baseRentPrice);
        }

        return b.score - a.score;
      })
      .slice(0, 5);

    if (scoredApartments.length === 0) {
      return [];
    }

    return [
      {
        sourceType: 'apartment_catalog',
        title: maxBudgetVnd
          ? `Danh sach can ho phu hop ngan sach duoi ${maxBudgetVnd} VND/thang`
          : isHoChiMinhQuery
            ? 'Danh sach can ho tai khu vuc Sai Gon'
            : 'Danh sach can ho phu hop voi yeu cau tim kiem',
        content: scoredApartments
          .map(({ apartment }, index) =>
            [
              `${index + 1}. ${apartment.buildingName ? `${apartment.buildingName} ${apartment.apartmentNumber}` : apartment.apartmentNumber}`,
              `ID: ${apartment.id}`,
              `Slug: ${apartment.slug}`,
              apartment.streetAddress
                ? `Dia chi: ${apartment.streetAddress}`
                : null,
              `Trang thai: ${this.getApartmentStatusLabel(apartment.status)}`,
              `Gia thue: ${apartment.baseRentPrice.toString()} VND/thang`,
              apartment.depositAmount
                ? `Tien coc: ${apartment.depositAmount.toString()} VND`
                : null,
              `Phong ngu: ${apartment.numberOfBedrooms}`,
              `Phong tam: ${apartment.numberOfBathrooms}`,
              `Dien tich: ${apartment.totalArea.toString()} m2`,
              `Noi that: ${this.getFurnishingLabel(apartment.furnishingStatus)}`,
              apartment.description ? `Mo ta: ${apartment.description}` : null,
            ]
              .filter((value): value is string => Boolean(value))
              .join('\n'),
          )
          .join('\n\n'),
        priority: 900 + scoredApartments[0].score,
      },
    ];
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
        this.normalizeText(input)
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

    const normalizedHaystack = this.normalizeText(haystack);

    let score = 0;
    for (const token of tokens) {
      if (normalizedHaystack.includes(token)) {
        score += token.length >= 5 ? 4 : 2;
      }
    }

    return score;
  }

  private normalizeText(input: string): string {
    return input
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isApartmentDiscoveryMessage(
    normalizedMessage: string,
    maxBudgetVnd?: number | null,
  ): boolean {
    return (
      Boolean(maxBudgetVnd) ||
      APARTMENT_DISCOVERY_PHRASES.some((phrase) =>
        normalizedMessage.includes(phrase),
      ) ||
      HO_CHI_MINH_ALIASES.some((alias) => normalizedMessage.includes(alias))
    );
  }

  private extractMaxBudgetVnd(normalizedMessage: string): number | null {
    const hasBudgetIntent = BUDGET_PHRASES.some((phrase) =>
      normalizedMessage.includes(phrase),
    );

    if (!hasBudgetIntent) {
      return null;
    }

    const match = normalizedMessage.match(
      /(?:duoi|toi da|khong qua|nho hon|re hon|tam gia|ngan sach|budget|under|below|max)?\s*(\d+(?:[.,]\d+)?)\s*(trieu|tr|m|k|nghin|ngan)?/,
    );

    if (!match) {
      return null;
    }

    const amount = Number(match[1].replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      return null;
    }

    const unit = match[2] ?? '';
    if (['trieu', 'tr', 'm'].includes(unit)) {
      return Math.round(amount * 1_000_000);
    }
    if (['k', 'nghin', 'ngan'].includes(unit)) {
      return Math.round(amount * 1_000);
    }

    return amount < 1_000 ? Math.round(amount * 1_000_000) : Math.round(amount);
  }

  private getApartmentStatusLabel(status: ApartmentStatus): string {
    switch (status) {
      case ApartmentStatus.available:
        return 'San sang cho thue';
      case ApartmentStatus.reserved:
        return 'Dang duoc giu cho';
      case ApartmentStatus.pending:
        return 'Dang cho duyet';
      case ApartmentStatus.occupied:
        return 'Da co khach thue';
      case ApartmentStatus.maintenance:
        return 'Dang bao tri';
      case ApartmentStatus.inactive:
        return 'Tam an';
      default:
        return status;
    }
  }

  private getFurnishingLabel(status: FurnishingStatus): string {
    switch (status) {
      case FurnishingStatus.fully_furnished:
        return 'Day du';
      case FurnishingStatus.semi_furnished:
        return 'Ban day du';
      case FurnishingStatus.unfurnished:
        return 'Khong noi that';
      default:
        return status;
    }
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
      | 'model'
      | 'intent'
      | 'confidence'
      | 'shouldHandoff'
      | 'handoffReason'
      | 'citations'
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
    aiMetadata.lastIntent = response.intent;
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
