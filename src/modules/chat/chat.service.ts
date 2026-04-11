import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ConversationStatus,
  MessageType,
  Prisma,
  SenderType,
} from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import {
  CreateConversationDto,
  SendMessageDto,
  QueryConversationsDto,
  QueryMessagesDto,
} from './dto';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private readonly prisma: PrismaService) {}

  private readonly conversationInclude = {
    user: {
      select: {
        id: true,
        fullName: true,
        email: true,
        profileImageUrl: true,
      },
    },
    _count: { select: { messages: true } },
  } as const;

  // ============================================================================
  // Conversation Management
  // ============================================================================

  /**
   * Create a new conversation.
   * - For logged-in users: userId is provided
   * - For guests: guestSessionId is provided (or auto-generated)
   */
  async createConversation(
    dto: CreateConversationDto,
    userId?: string,
    senderName?: string,
  ) {
    const result = await this.createOrReuseConversation(dto, userId, senderName);
    return result.conversation;
  }

  async createOrReuseConversation(
    dto: CreateConversationDto,
    userId?: string,
    senderName?: string,
  ) {
    const guestSessionId = !userId ? dto.guestSessionId || uuidv4() : undefined;
    const sanitizedMetadata = this.toJsonValue(dto.metadata);
    const existingConversation = await this.findReusableConversation({
      userId,
      guestSessionId,
    });

    if (existingConversation) {
      if (existingConversation.status === ConversationStatus.closed) {
        await this.prisma.chatConversation.update({
          where: { id: existingConversation.id },
          data: { status: ConversationStatus.active },
        });
      }

      this.logger.log(
        `Conversation reused: ${existingConversation.id} (${userId ? 'user' : 'guest'})`,
      );

      return {
        conversation: await this.getConversation(existingConversation.id),
        action: 'reused' as const,
      };
    }

    const conversation = await this.prisma.chatConversation.create({
      data: {
        title:
          dto.title ||
          (userId
            ? `Chat với ${senderName || 'User'}`
            : `Chat với ${dto.guestName || 'Khách'}`),
        userId: userId || null,
        guestSessionId: guestSessionId || null,
        guestName: dto.guestName || null,
        guestEmail: dto.guestEmail || null,
        status: ConversationStatus.active,
        metadata: sanitizedMetadata,
      },
      select: { id: true },
    });

    this.logger.log(
      `Conversation created: ${conversation.id} (${userId ? 'user' : 'guest'})`,
    );

    return {
      conversation: await this.getConversation(conversation.id),
      action: 'created' as const,
    };
  }

  private toJsonValue(
    value: unknown,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return Prisma.JsonNull;
    }

    try {
      return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
    } catch (error) {
      this.logger.warn(
        `Ignoring invalid chat metadata payload: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return undefined;
    }
  }

  /**
   * Get conversations list with pagination.
   * - Staff: sees all active conversations
   * - User: sees own conversations
   * - Guest: sees conversations matching guestSessionId
   */
  async getConversations(
    query: QueryConversationsDto,
    options?: {
      userId?: string;
      guestSessionId?: string;
      isStaff?: boolean;
    },
  ) {
    const { status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) {
      where.status = status;
    } else {
      // Default: don't show archived
      where.status = { not: ConversationStatus.archived };
    }

    // Filter by role
    if (options?.isStaff) {
      // Staff sees all conversations — no additional filter
    } else if (options?.userId) {
      where.userId = options.userId;
    } else if (options?.guestSessionId) {
      where.guestSessionId = options.guestSessionId;
    }

    const [conversations, total] = await Promise.all([
      this.prisma.chatConversation.findMany({
        where,
        orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        skip,
        take: limit,
        include: this.conversationInclude,
      }),
      this.prisma.chatConversation.count({ where }),
    ]);

    return {
      data: conversations,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single conversation by ID
   */
  async getConversation(conversationId: string) {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: this.conversationInclude,
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  // ============================================================================
  // Message Management
  // ============================================================================

  /**
   * Send a message in a conversation.
   * Updates conversation's lastMessageAt and lastMessageText.
   */
  async sendMessage(
    dto: SendMessageDto,
    senderType: SenderType,
    senderId?: string,
    senderName?: string,
  ) {
    // Verify conversation exists and is active
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: dto.conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.status === ConversationStatus.archived) {
      throw new ForbiddenException(
        'Cannot send message to an archived conversation',
      );
    }

    // Create message and update conversation in a transaction
    const [message] = await this.prisma.$transaction([
      this.prisma.chatMessage.create({
        data: {
          conversationId: dto.conversationId,
          senderType,
          senderId: senderId || null,
          senderName: senderName || null,
          messageType: dto.messageType || MessageType.text,
          content: dto.content,
          images: dto.images || [],
          apartmentId: dto.apartmentId || null,
          attachments: dto.attachments ? (dto.attachments as any) : null,
        },
      }),
      this.prisma.chatConversation.update({
        where: { id: dto.conversationId },
        data: {
          status: ConversationStatus.active,
          lastMessageAt: new Date(),
          lastMessageText:
            dto.content.length > 100
              ? dto.content.substring(0, 100) + '...'
              : dto.content,
        },
      }),
    ]);

    return this.mapToFrontendMessage(message);
  }

  private async findReusableConversation(options: {
    userId?: string;
    guestSessionId?: string;
  }) {
    const { userId, guestSessionId } = options;

    if (!userId && !guestSessionId) {
      return null;
    }

    return this.prisma.chatConversation.findFirst({
      where: {
        status: { not: ConversationStatus.archived },
        ...(userId ? { userId } : { guestSessionId }),
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        status: true,
      },
    });
  }

  /**
   * Maps a Prisma ChatMessage to the specific frontend Message interface.
   */
  private mapToFrontendMessage(msg: any) {
    return {
      id: msg.id,
      content: msg.content,
      images: msg.images && msg.images.length > 0 ? msg.images : undefined,
      apartmentId: msg.apartmentId || undefined,
      sender: ['user', 'guest'].includes(msg.senderType) ? 'user' : 'support',
      timestamp: msg.createdAt,
    };
  }

  /**
   * Get paginated messages for a conversation
   */
  async getMessages(conversationId: string, query: QueryMessagesDto) {
    const { page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;

    // Verify conversation exists
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
      select: { id: true },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const [messages, total] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.chatMessage.count({ where: { conversationId } }),
    ]);

    return {
      data: messages.reverse().map((m) => this.mapToFrontendMessage(m)), // Return mapped in chronological order
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Mark messages as read
   */
  async markMessagesRead(conversationId: string, readerType: SenderType) {
    const now = new Date();

    // Mark all unread messages NOT from the reader's type as read
    const result = await this.prisma.chatMessage.updateMany({
      where: {
        conversationId,
        isRead: false,
        senderType: { not: readerType },
      },
      data: {
        isRead: true,
        readAt: now,
      },
    });

    return { markedCount: result.count };
  }

  /**
   * Get unread message count for a conversation
   */
  async getUnreadCount(conversationId: string, readerType: SenderType) {
    const count = await this.prisma.chatMessage.count({
      where: {
        conversationId,
        isRead: false,
        senderType: { not: readerType },
      },
    });

    return { unreadCount: count };
  }

  // ============================================================================
  // Conversation Status
  // ============================================================================

  /**
   * Archive a conversation
   */
  async archiveConversation(conversationId: string) {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: { status: ConversationStatus.archived },
    });
  }

}
