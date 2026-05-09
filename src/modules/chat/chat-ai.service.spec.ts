import { ApartmentStatus, FurnishingStatus, Prisma, SenderType } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { ChatAiService } from './chat-ai.service';
import { createPrismaMock } from '../../test-utils';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('ChatAiService', () => {
  let service: ChatAiService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let configService: ConfigService;

  beforeEach(() => {
    prisma = createPrismaMock();

    const configValues = new Map<string, unknown>([
      ['aiService.enabled', true],
      ['aiService.provider', 'gemini'],
      ['aiService.serviceUrl', 'http://pc.klong.dev:3007'],
      ['aiService.timeoutMs', 20_000],
      ['aiService.apiKey', 'test-api-key'],
      ['aiService.geminiApiKey', 'test-gemini-key'],
      ['aiService.geminiModel', 'gemini-2.5-flash'],
      ['aiService.confidenceThreshold', 0.72],
      ['aiService.maxContextChunks', 6],
      ['aiService.faqFile', 'documents/ai/faq.vi.jsonl'],
    ]);

    configService = {
      get: jest.fn((key: string) => configValues.get(key)),
      getOrThrow: jest.fn((key: string) => {
        const value = configValues.get(key);
        if (value === undefined || value === null) {
          throw new Error(`Missing config for ${key}`);
        }

        return value;
      }),
    } as unknown as ConfigService;

    service = new ChatAiService(configService, prisma as any);

    prisma.apartment.findMany.mockResolvedValue([]);
    prisma.policy.findMany.mockResolvedValue([]);
    prisma.chatConversation.findUnique.mockResolvedValue({
      metadata: {},
    } as any);
    prisma.chatConversation.update.mockResolvedValue({} as any);

    mockFetch.mockReset();
  });

  it('returns a fallback handoff response when the AI microservice is unreachable', async () => {
    const networkError = new TypeError('fetch failed') as TypeError & {
      cause?: Error;
    };
    networkError.cause = new Error(
      'connect ETIMEDOUT 14.169.38.69:3007',
    );
    mockFetch.mockRejectedValue(networkError);

    const result = await service.generateReply({
      conversationId: 'conversation-1',
      actorType: SenderType.user,
      message: 'Xin chao',
    });

    expect(result).toMatchObject({
      model: 'service_unavailable',
      confidence: 0,
      shouldHandoff: true,
      handoffReason: 'service_unavailable',
    });
    expect(result?.answer).toContain('AI');
    expect(result?.answer).toContain('hỗ trợ');
    expect(prisma.chatConversation.update).toHaveBeenCalled();
  });

  const mockGeminiResponse = (body: Record<string, unknown>) => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          candidates: [
            {
              finishReason: 'STOP',
              content: {
                parts: [{ text: JSON.stringify(body) }],
              },
            },
          ],
          usageMetadata: {},
        }),
      ),
    } as any);
  };

  it('injects apartment catalog context for Sai Gon listing requests', async () => {
    prisma.apartment.findMany.mockResolvedValue([
      {
        id: 'apt-1',
        buildingName: 'Saigon Pearl',
        apartmentNumber: 'Ruby-0811',
        slug: 'saigon-pearl-ruby-0811',
        streetAddress: '92 Nguyễn Hữu Cảnh, Phường 22, Quận Bình Thạnh',
        totalArea: new Prisma.Decimal(74),
        numberOfBedrooms: 2,
        numberOfBathrooms: 2,
        furnishingStatus: FurnishingStatus.semi_furnished,
        baseRentPrice: new Prisma.Decimal(19_500_000),
        depositAmount: new Prisma.Decimal(39_000_000),
        status: ApartmentStatus.available,
        description: 'Căn hộ phù hợp khách thuê làm việc khu trung tâm.',
      },
    ] as any);
    mockGeminiResponse({
      answer: 'Mình tìm thấy một số căn phù hợp ở Sài Gòn.',
      intent: 'ai_chat',
      confidence: 0.91,
      shouldHandoff: false,
      handoffReason: null,
      sourceIds: ['S1'],
      blocks: [
        { type: 'text', text: 'Mình tìm thấy một số căn phù hợp ở Sài Gòn.' },
        { type: 'apartment_card', apartmentId: 'apt-1' },
      ],
    });

    const result = await service.generateReply({
      conversationId: 'conversation-2',
      actorType: SenderType.user,
      message: 'Gửi danh sách nhà khu vực sài gòn cho tôi',
    });

    expect(result?.shouldHandoff).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [, requestInit] = mockFetch.mock.calls[0];
    const payload = JSON.parse((requestInit?.body as string) || '{}');
    expect(payload.contents[0].parts[0].text).toContain('Saigon Pearl');
    expect(payload.contents[0].parts[0].text).toContain('ID: apt-1');
  });

  it('adds apartment cards when Gemini mentions apartments without blocks', async () => {
    prisma.apartment.findMany.mockResolvedValue([
      {
        id: 'apt-fpt-1',
        buildingName: 'Sunrise Riverside Tower B',
        apartmentNumber: 'HIQ-010A',
        slug: 'sunrise-riverside-tower-b-hiq-010a',
        streetAddress: 'Gần Đại học FPT',
        totalArea: new Prisma.Decimal(200),
        numberOfBedrooms: 2,
        numberOfBathrooms: 2,
        furnishingStatus: FurnishingStatus.unfurnished,
        baseRentPrice: new Prisma.Decimal(2_000_000),
        depositAmount: new Prisma.Decimal(4_000_000),
        status: ApartmentStatus.available,
        description: 'Căn hộ gần đại học FPT.',
      },
      {
        id: 'apt-fpt-2',
        buildingName: 'Căn hộ HomeIQ',
        apartmentNumber: 'HIQ-001B',
        slug: 'can-ho-homeiq-hiq-001b',
        streetAddress: 'Gần Đại học FPT',
        totalArea: new Prisma.Decimal(36),
        numberOfBedrooms: 1,
        numberOfBathrooms: 1,
        furnishingStatus: FurnishingStatus.fully_furnished,
        baseRentPrice: new Prisma.Decimal(5_000),
        depositAmount: new Prisma.Decimal(10_000),
        status: ApartmentStatus.available,
        description: 'Căn hộ gần đại học FPT.',
      },
    ] as any);
    mockGeminiResponse({
      answer:
        'HomeIQ có hai căn gần Đại học FPT: Sunrise Riverside Tower B HIQ-010A và Căn hộ HomeIQ HIQ-001B.',
      intent: 'ai_chat',
      confidence: 0.91,
      shouldHandoff: false,
      handoffReason: null,
      sourceIds: ['S1'],
      blocks: [],
    });

    const result = await service.generateReply({
      conversationId: 'conversation-fpt',
      actorType: SenderType.user,
      message: 'Tìm nhà gần đại học FPT',
    });

    expect(result?.blocks).toEqual(
      expect.arrayContaining([
        { type: 'apartment_card', apartmentId: 'apt-fpt-1' },
        { type: 'apartment_card', apartmentId: 'apt-fpt-2' },
      ]),
    );
  });

  it('injects apartment context for availability questions', async () => {
    prisma.apartment.findMany.mockResolvedValue([
      {
        id: 'apt-dam-sen',
        buildingName: 'Đầm Sen Residence',
        apartmentNumber: 'HIQ-020A',
        slug: 'dam-sen-residence-hiq-020a',
        streetAddress: 'Đầm Sen',
        totalArea: new Prisma.Decimal(45),
        numberOfBedrooms: 1,
        numberOfBathrooms: 1,
        furnishingStatus: FurnishingStatus.fully_furnished,
        baseRentPrice: new Prisma.Decimal(6_000_000),
        depositAmount: new Prisma.Decimal(12_000_000),
        status: ApartmentStatus.available,
        description: 'Căn hộ khu Đầm Sen còn trống.',
      },
    ] as any);
    mockGeminiResponse({
      answer: 'Đầm Sen Residence HIQ-020A hiện đang sẵn sàng cho thuê.',
      intent: 'ai_chat',
      confidence: 0.9,
      shouldHandoff: false,
      handoffReason: null,
      sourceIds: ['S1'],
      blocks: [],
    });

    const result = await service.generateReply({
      conversationId: 'conversation-dam-sen',
      actorType: SenderType.user,
      message: 'Căn hộ đầm sen còn nhà không?',
    });

    expect(result?.shouldHandoff).toBe(false);
    expect(result?.blocks).toContainEqual({
      type: 'apartment_card',
      apartmentId: 'apt-dam-sen',
    });

    const [, requestInit] = mockFetch.mock.calls[0];
    const payload = JSON.parse((requestInit?.body as string) || '{}');
    expect(payload.contents[0].parts[0].text).toContain('Đầm Sen Residence');
  });

  it('injects cheap apartments for budget queries', async () => {
    prisma.apartment.findMany.mockResolvedValue([
      {
        id: 'apt-cheap',
        buildingName: 'Căn hộ HomeIQ',
        apartmentNumber: 'HIQ-001B',
        slug: 'can-ho-homeiq-hiq-001b',
        streetAddress: 'Quận 1',
        totalArea: new Prisma.Decimal(25),
        numberOfBedrooms: 1,
        numberOfBathrooms: 1,
        furnishingStatus: FurnishingStatus.fully_furnished,
        baseRentPrice: new Prisma.Decimal(5_000),
        depositAmount: new Prisma.Decimal(5_000),
        status: ApartmentStatus.available,
        description: 'Căn hộ giá rẻ.',
      },
    ] as any);
    mockGeminiResponse({
      answer: 'Có căn HomeIQ HIQ-001B dưới 1 triệu/tháng.',
      intent: 'ai_chat',
      confidence: 0.93,
      shouldHandoff: false,
      handoffReason: null,
      sourceIds: ['S1'],
      blocks: [
        { type: 'text', text: 'Có căn HomeIQ HIQ-001B dưới 1 triệu/tháng.' },
        { type: 'apartment_card', apartmentId: 'apt-cheap' },
      ],
    });

    const result = await service.generateReply({
      conversationId: 'conversation-3',
      actorType: SenderType.user,
      message: 'Tôi muốn tìm nhà dưới 1tr 1 tháng',
    });

    expect(result?.blocks).toContainEqual({
      type: 'apartment_card',
      apartmentId: 'apt-cheap',
    });
    expect(prisma.apartment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          baseRentPrice: { lte: new Prisma.Decimal(1_000_000) },
        }),
        orderBy: [{ baseRentPrice: 'asc' }, { updatedAt: 'desc' }],
      }),
    );

    const [, requestInit] = mockFetch.mock.calls[0];
    const payload = JSON.parse((requestInit?.body as string) || '{}');
    expect(payload.contents[0].parts[0].text).toContain('HIQ-001B');
    expect(payload.contents[0].parts[0].text).toContain('Gia thue: 5000 VND/thang');
  });
});
