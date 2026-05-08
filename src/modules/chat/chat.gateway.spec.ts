import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MessageType, SenderType } from '@prisma/client';
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-guest-session-id'),
}));
import { ChatGateway } from './chat.gateway';

describe('ChatGateway', () => {
  let gateway: ChatGateway;

  const chatService = {
    sendMessage: jest.fn(),
    sendSystemMessage: jest.fn(),
    hasHumanHandoff: jest.fn(),
    clearHumanHandoff: jest.fn(),
    markHumanHandoff: jest.fn(),
    markMessagesRead: jest.fn(),
  };

  const chatAiService = {
    generateReply: jest.fn(),
  };

  const jwtService = {
    verify: jest.fn(),
  };

  const configService = {
    get: jest.fn(),
  };

  const cacheManager = {
    set: jest.fn(),
    del: jest.fn(),
  };

  const emittedEvents: Array<{
    room: string;
    event: string;
    payload: unknown;
  }> = [];

  const createServer = () =>
    ({
      to: jest.fn((room: string) => ({
        emit: (event: string, payload: unknown) => {
          emittedEvents.push({ room, event, payload });
        },
      })),
    }) as any;

  const createClient = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'socket-1',
      data: {
        actorType: SenderType.user,
        actorId: 'user-123',
        fullName: 'Nguyen Van A',
      },
      join: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      ...overrides,
    }) as any;

  beforeEach(() => {
    gateway = new ChatGateway(
      chatService as any,
      chatAiService as any,
      jwtService as any,
      configService as any,
      cacheManager as any,
    );
    gateway.server = createServer();
    emittedEvents.length = 0;
    jest.clearAllMocks();
    chatService.hasHumanHandoff.mockResolvedValue(false);
    chatService.clearHumanHandoff.mockResolvedValue(undefined);
    chatService.markHumanHandoff.mockResolvedValue(undefined);
  });

  it('routes human-support intent to staff', async () => {
    const message = {
      id: 1,
      content: 'Toi can ho tro gap nhan vien',
      timestamp: new Date('2026-04-24T08:00:00.000Z'),
    };
    chatService.sendMessage.mockResolvedValue(message);
    chatAiService.generateReply.mockResolvedValue({
      answer: 'Mình sẽ chuyển bạn tới bộ phận hỗ trợ.',
      model: 'gemini-2.5-flash',
      intent: 'human_support',
      confidence: 0.95,
      shouldHandoff: true,
      handoffReason: 'human_support_requested',
      citations: [],
      blocks: [],
    });

    const client = createClient();

    await gateway.handleSendMessage(client, {
      conversationId: 'conv-123',
      content: 'Toi can ho tro gap nhan vien',
      messageType: MessageType.text,
    });

    expect(chatService.sendMessage).toHaveBeenCalledTimes(1);
    expect(
      emittedEvents.find(
        (entry) =>
          entry.room === 'conversation:conv-123' &&
          entry.event === 'chat:handoff_status',
      )?.payload,
    ).toMatchObject({
      conversationId: 'conv-123',
      handoffReason: 'human_support_requested',
      status: 'connecting',
      source: 'ai',
      actorType: SenderType.user,
    });
    expect(
      emittedEvents.find(
        (entry) =>
          entry.room === 'staff:inbox' &&
          entry.event === 'chat:handoff_requested',
      )?.payload,
    ).toMatchObject({
      conversationId: 'conv-123',
      handoffReason: 'human_support_requested',
      status: 'connecting',
      source: 'ai',
    });
  });

  it('does not call AI after human handoff is active', async () => {
    chatService.sendMessage.mockResolvedValue({
      id: 1,
      content: 'Xin chao',
      timestamp: new Date('2026-04-24T08:00:00.000Z'),
    });
    chatService.hasHumanHandoff.mockResolvedValue(true);

    await gateway.handleSendMessage(createClient(), {
      conversationId: 'conv-123',
      content: 'Tôi nhắn tiếp',
      messageType: MessageType.text,
    });

    expect(chatAiService.generateReply).not.toHaveBeenCalled();
  });

  it('suppresses duplicate direct-to-staff handoff events within the cooldown window', async () => {
    chatService.sendMessage.mockResolvedValue({
      id: 1,
      content: 'Xin chao',
      timestamp: new Date('2026-04-24T08:00:00.000Z'),
    });
    chatAiService.generateReply.mockResolvedValue({
      answer: 'Mình sẽ chuyển bạn tới bộ phận hỗ trợ.',
      model: 'gemini-2.5-flash',
      intent: 'human_support',
      confidence: 0.95,
      shouldHandoff: true,
      handoffReason: 'human_support_requested',
      citations: [],
      blocks: [],
    });

    const client = createClient();

    await gateway.handleSendMessage(client, {
      conversationId: 'conv-123',
      content: 'Xin chao',
      messageType: MessageType.text,
    });
    await gateway.handleSendMessage(client, {
      conversationId: 'conv-123',
      content: 'Toi dang doi staff',
      messageType: MessageType.text,
    });

    expect(
      emittedEvents.filter(
        (entry) =>
          entry.room === 'conversation:conv-123' &&
          entry.event === 'chat:handoff_status',
      ),
    ).toHaveLength(1);
    expect(
      emittedEvents.filter(
        (entry) =>
          entry.room === 'staff:inbox' &&
          entry.event === 'chat:handoff_requested',
      ),
    ).toHaveLength(1);
  });
});
