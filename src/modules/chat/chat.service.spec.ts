import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import {
  ConversationStatus,
  MessageType,
  SenderType,
} from '@prisma/client';
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-guest-session-id'),
}));
import { ChatService } from './chat.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock, MockPrisma } from '../../test-utils';

describe('ChatService', () => {
  let service: ChatService;
  let prisma: MockPrisma;

  const mockConversation = (overrides = {}) => ({
    id: 'conv-123',
    title: 'Chat voi user',
    userId: 'user-123',
    guestSessionId: null,
    guestName: null,
    guestEmail: null,
    status: ConversationStatus.active,
    lastMessageAt: null,
    lastMessageText: null,
    metadata: null,
    createdAt: new Date('2026-03-27T09:00:00.000Z'),
    updatedAt: new Date('2026-03-27T09:00:00.000Z'),
    user: {
      id: 'user-123',
      fullName: 'Nguyen Van A',
      email: 'user@example.com',
      profileImageUrl: null,
    },
    _count: { messages: 0 },
    ...overrides,
  });

  const mockMessage = (overrides = {}) => ({
    id: 1,
    conversationId: 'conv-123',
    senderType: SenderType.user,
    senderId: 'user-123',
    senderName: 'Nguyen Van A',
    messageType: MessageType.text,
    content: 'Xin chao',
    images: [],
    apartmentId: null,
    attachments: null,
    isRead: false,
    readAt: null,
    createdAt: new Date('2026-03-27T09:05:00.000Z'),
    updatedAt: new Date('2026-03-27T09:05:00.000Z'),
    ...overrides,
  });

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrReuseConversation', () => {
    it('should create a new conversation when no reusable thread exists', async () => {
      prisma.chatConversation.findFirst.mockResolvedValue(null);
      prisma.chatConversation.create.mockResolvedValue({ id: 'conv-new' } as any);
      prisma.chatConversation.findUnique.mockResolvedValue(
        mockConversation({ id: 'conv-new' }) as any,
      );

      const result = await service.createOrReuseConversation(
        {
          title: 'Hoi can ho A1',
          metadata: { apartmentId: 'apt-123' },
        },
        'user-123',
        'Nguyen Van A',
      );

      expect(result.action).toBe('created');
      expect(result.conversation.id).toBe('conv-new');
      expect(prisma.chatConversation.create).toHaveBeenCalled();
    });

    it('should reuse the latest existing conversation for a logged-in user', async () => {
      prisma.chatConversation.findFirst.mockResolvedValue({
        id: 'conv-existing',
        status: ConversationStatus.active,
      } as any);
      prisma.chatConversation.findUnique.mockResolvedValue(
        mockConversation({ id: 'conv-existing' }) as any,
      );

      const result = await service.createOrReuseConversation(
        {},
        'user-123',
        'Nguyen Van A',
      );

      expect(result.action).toBe('reused');
      expect(result.conversation.id).toBe('conv-existing');
      expect(prisma.chatConversation.create).not.toHaveBeenCalled();
    });

    it('should reactivate an old closed conversation instead of creating a new one', async () => {
      prisma.chatConversation.findFirst.mockResolvedValue({
        id: 'conv-closed',
        status: ConversationStatus.closed,
      } as any);
      prisma.chatConversation.update.mockResolvedValue({} as any);
      prisma.chatConversation.findUnique.mockResolvedValue(
        mockConversation({
          id: 'conv-closed',
          status: ConversationStatus.active,
        }) as any,
      );

      const result = await service.createOrReuseConversation(
        {},
        'user-123',
        'Nguyen Van A',
      );

      expect(result.action).toBe('reused');
      expect(prisma.chatConversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-closed' },
        data: { status: ConversationStatus.active },
      });
      expect(prisma.chatConversation.create).not.toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    it('should allow continuing a previously closed conversation', async () => {
      prisma.chatConversation.findUnique.mockResolvedValueOnce({
        id: 'conv-123',
        status: ConversationStatus.closed,
      } as any);
      prisma.chatMessage.create.mockResolvedValue(mockMessage() as any);
      prisma.chatConversation.update.mockResolvedValue(
        mockConversation({
          id: 'conv-123',
          status: ConversationStatus.active,
          lastMessageText: 'Xin chao',
        }) as any,
      );
      prisma.$transaction.mockResolvedValue([
        mockMessage(),
        mockConversation({ id: 'conv-123', status: ConversationStatus.active }),
      ] as any);

      const result = await service.sendMessage(
        {
          conversationId: 'conv-123',
          content: 'Xin chao',
        },
        SenderType.user,
        'user-123',
        'Nguyen Van A',
      );

      expect(result).toMatchObject({
        id: 1,
        content: 'Xin chao',
        sender: 'user',
      });
      expect(prisma.chatConversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'conv-123' },
          data: expect.objectContaining({
            status: ConversationStatus.active,
            lastMessageText: 'Xin chao',
          }),
        }),
      );
    });

    it('should reject messages sent to an archived conversation', async () => {
      prisma.chatConversation.findUnique.mockResolvedValueOnce({
        id: 'conv-archived',
        status: ConversationStatus.archived,
      } as any);

      await expect(
        service.sendMessage(
          {
            conversationId: 'conv-archived',
            content: 'Xin chao',
          },
          SenderType.user,
          'user-123',
          'Nguyen Van A',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
