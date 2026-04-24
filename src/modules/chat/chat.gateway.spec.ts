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
    markMessagesRead: jest.fn(),
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
      jwtService as any,
      configService as any,
      cacheManager as any,
    );
    gateway.server = createServer();
    emittedEvents.length = 0;
    jest.clearAllMocks();
  });

  it('routes user messages directly to staff without generating AI replies', async () => {
    const message = {
      id: 1,
      content: 'Toi can ho tro gap nhan vien',
      timestamp: new Date('2026-04-24T08:00:00.000Z'),
    };
    chatService.sendMessage.mockResolvedValue(message);

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
      handoffReason: 'ai_temporarily_disabled',
      status: 'connecting',
      source: 'direct',
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
      handoffReason: 'ai_temporarily_disabled',
      status: 'connecting',
      source: 'direct',
    });
  });

  it('suppresses duplicate direct-to-staff handoff events within the cooldown window', async () => {
    chatService.sendMessage.mockResolvedValue({
      id: 1,
      content: 'Xin chao',
      timestamp: new Date('2026-04-24T08:00:00.000Z'),
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
