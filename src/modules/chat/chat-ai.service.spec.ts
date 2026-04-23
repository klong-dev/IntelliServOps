import { SenderType } from '@prisma/client';
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
      ['aiService.provider', 'service'],
      ['aiService.serviceUrl', 'http://pc.klong.dev:3007'],
      ['aiService.timeoutMs', 20_000],
      ['aiService.apiKey', 'test-api-key'],
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
});
