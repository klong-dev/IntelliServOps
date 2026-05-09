import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Server, Socket } from 'socket.io';
import { MessageType, SenderType } from '@prisma/client';
import { ChatService } from './chat.service';
import { ChatAiService } from './chat-ai.service';
import { SendMessageDto, CreateConversationDto } from './dto';

interface AuthenticatedSocket extends Socket {
  data: {
    actorType: SenderType;
    actorId?: string;
    email?: string;
    fullName?: string;
    guestSessionId?: string;
  };
}

// Redis key TTL for online status (seconds)
const ONLINE_TTL = 60;
const HEARTBEAT_INTERVAL = 30_000; // 30s
const DIRECT_STAFF_HANDOFF_COOLDOWN_MS = 15_000;
const AI_MODE_PHRASES = [
  'chat voi ai',
  'chat với ai',
  'noi voi ai',
  'nói với ai',
  'tro lai ai',
  'trở lại ai',
  'quay lai ai',
  'quay lại ai',
  'hoi ai',
  'hỏi ai',
];

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly directStaffRoutingTimestamps = new Map<string, number>();

  constructor(
    private readonly chatService: ChatService,
    private readonly chatAiService: ChatAiService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  afterInit() {
    this.logger.log('💬 Chat WebSocket Gateway initialized');
  }

  // ============================================================================
  // Connection Lifecycle
  // ============================================================================

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      const guestSessionId = client.handshake.auth?.guestSessionId as
        | string
        | undefined;
      const guestName = client.handshake.auth?.guestName as string | undefined;

      if (token) {
        // Authenticate staff / user via JWT
        const payload = this.jwtService.verify(token, {
          secret: this.configService.get('jwt.secret'),
        });

        const actorType = this.mapActorType(payload.actorType);
        client.data = {
          actorType,
          actorId: payload.sub,
          email: payload.email,
          fullName: payload.fullName || payload.email,
        };

        // Staff/operator/admin auto-join the shared inbox room
        if (this.isStaffType(actorType)) {
          await client.join('staff:inbox');
          this.logger.log(
            `Staff connected: ${payload.email} (${actorType}) [${client.id}]`,
          );
        } else {
          this.logger.log(`User connected: ${payload.email} [${client.id}]`);
        }

        // Set online status in Redis
        await this.setOnlineStatus(actorType, payload.sub, true);

        // Broadcast online status to staff
        this.server.to('staff:inbox').emit('chat:online_status', {
          actorType,
          actorId: payload.sub,
          isOnline: true,
        });
      } else {
        // Guest connection
        const sessionId = guestSessionId || this.generateGuestSessionId();
        client.data = {
          actorType: SenderType.guest,
          guestSessionId: sessionId,
          fullName: guestName || 'Khách',
        };

        // Emit the session ID back so the client can persist it
        client.emit('chat:session', { guestSessionId: sessionId });

        this.logger.log(`Guest connected: ${sessionId} [${client.id}]`);
      }
    } catch (error) {
      this.logger.error(`Connection rejected: ${error.message}`);
      client.emit('chat:error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    const { actorType, actorId, guestSessionId } = client.data || {};

    if (actorId) {
      // Remove online status
      await this.setOnlineStatus(actorType, actorId, false);

      // Broadcast offline status to staff
      this.server.to('staff:inbox').emit('chat:online_status', {
        actorType,
        actorId,
        isOnline: false,
      });

      this.logger.log(`${actorType} disconnected: ${actorId} [${client.id}]`);
    } else if (guestSessionId) {
      this.logger.log(`Guest disconnected: ${guestSessionId} [${client.id}]`);
    }
  }

  // ============================================================================
  // Socket Events
  // ============================================================================

  /**
   * Create or resume a conversation
   * Emitted by users or guests to start chatting
   */
  @SubscribeMessage('chat:create_conversation')
  async handleCreateConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: CreateConversationDto,
  ) {
    try {
      const { actorType, actorId, guestSessionId, fullName } = client.data;

      // Prepare DTO
      const dto: CreateConversationDto = {
        title: data.title,
        guestSessionId: guestSessionId,
        guestName: data.guestName || fullName || 'Khách',
        guestEmail: data.guestEmail,
        metadata: data.metadata,
      };

      const result = await this.chatService.createOrReuseConversation(
        dto,
        actorType !== SenderType.guest ? actorId : undefined,
        fullName,
      );
      const { conversation, action } = result;

      // Join the conversation room
      const roomId = `conversation:${conversation.id}`;
      await client.join(roomId);

      // Emit to the client
      client.emit('chat:conversation_created', conversation);

      if (action === 'created') {
        // Broadcast to all staff that a new conversation started
        this.server.to('staff:inbox').emit('chat:new_conversation', conversation);
      } else {
        this.server.to('staff:inbox').emit('chat:conversation_updated', {
          conversationId: conversation.id,
          status: conversation.status,
          lastMessageAt: conversation.lastMessageAt,
          lastMessageText: conversation.lastMessageText,
          senderName: fullName,
          senderType: actorType,
        });
      }

      return conversation;
    } catch (error) {
      this.logger.error(`Create conversation error: ${error.message}`);
      client.emit('chat:error', { message: error.message });
    }
  }

  /**
   * Staff joins a conversation to observe/participate
   */
  @SubscribeMessage('chat:join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    try {
      const { actorType, fullName } = client.data;
      const roomId = `conversation:${data.conversationId}`;

      await client.join(roomId);

      // Notify others in the conversation
      if (this.isStaffType(actorType)) {
        this.server.to(roomId).emit('chat:staff_joined', {
          conversationId: data.conversationId,
          staffName: fullName,
          actorType,
        });

        this.server.to(roomId).emit('chat:handoff_status', {
          conversationId: data.conversationId,
          status: 'connected',
          staffName: fullName,
          actorType,
        });
      }

      // Return conversation details + recent messages
      const conversation = await this.chatService.getConversation(
        data.conversationId,
      );
      const messages = await this.chatService.getMessages(data.conversationId, {
        page: 1,
        limit: 50,
      });

      client.emit('chat:conversation_data', { conversation, messages });
    } catch (error) {
      this.logger.error(`Join conversation error: ${error.message}`);
      client.emit('chat:error', { message: error.message });
    }
  }

  /**
   * Leave a conversation room
   */
  @SubscribeMessage('chat:leave_conversation')
  async handleLeaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    const roomId = `conversation:${data.conversationId}`;
    await client.leave(roomId);
  }

  /**
   * Send a message
   */
  @SubscribeMessage('chat:send_message')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: SendMessageDto,
  ) {
    try {
      const { actorType, actorId, fullName } = client.data;

      const message = await this.chatService.sendMessage(
        data,
        actorType,
        actorId,
        fullName,
      );

      const roomId = `conversation:${data.conversationId}`;

      // Ensure sender is in the room
      await client.join(roomId);

      // Broadcast message to everyone in the conversation room
      this.server.to(roomId).emit('chat:new_message', message);

      // Also notify staff inbox (for conversations list update)
      this.emitConversationUpdated({
        conversationId: data.conversationId,
        lastMessageAt: message.timestamp,
        lastMessageText:
          message.content.length > 100
            ? message.content.substring(0, 100) + '...'
            : message.content,
        senderName: fullName,
        senderType: actorType,
      });

      await this.handleAiResponse(actorType, data, roomId, fullName);

      return message;
    } catch (error) {
      this.logger.error(`Send message error: ${error.message}`);
      client.emit('chat:error', { message: error.message });
    }
  }

  /**
   * Typing indicator
   */
  @SubscribeMessage('chat:typing')
  async handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    const roomId = `conversation:${data.conversationId}`;
    client.to(roomId).emit('chat:user_typing', {
      conversationId: data.conversationId,
      actorType: client.data.actorType,
      actorId: client.data.actorId,
      fullName: client.data.fullName,
    });
  }

  /**
   * Stop typing indicator
   */
  @SubscribeMessage('chat:stop_typing')
  async handleStopTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    const roomId = `conversation:${data.conversationId}`;
    client.to(roomId).emit('chat:user_stop_typing', {
      conversationId: data.conversationId,
      actorType: client.data.actorType,
      actorId: client.data.actorId,
    });
  }

  /**
   * Mark messages as read
   */
  @SubscribeMessage('chat:mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    try {
      const result = await this.chatService.markMessagesRead(
        data.conversationId,
        client.data.actorType,
      );

      // Notify others in the conversation that messages were read
      const roomId = `conversation:${data.conversationId}`;
      client.to(roomId).emit('chat:messages_read', {
        conversationId: data.conversationId,
        readerType: client.data.actorType,
        readerName: client.data.fullName,
        markedCount: result.markedCount,
      });

      return result;
    } catch (error) {
      this.logger.error(`Mark read error: ${error.message}`);
      client.emit('chat:error', { message: error.message });
    }
  }

  /**
   * Heartbeat to maintain online status
   */
  @SubscribeMessage('chat:heartbeat')
  async handleHeartbeat(@ConnectedSocket() client: AuthenticatedSocket) {
    const { actorType, actorId } = client.data;
    if (actorId) {
      await this.setOnlineStatus(actorType, actorId, true);
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private isStaffType(type: SenderType): boolean {
    return (
      type === SenderType.staff ||
      type === SenderType.operator ||
      type === SenderType.admin
    );
  }

  private mapActorType(actorType: string): SenderType {
    const map: Record<string, SenderType> = {
      user: SenderType.user,
      guest: SenderType.guest,
      staff: SenderType.staff,
      operator: SenderType.operator,
      admin: SenderType.admin,
    };
    return map[actorType] || SenderType.guest;
  }

  private generateGuestSessionId(): string {
    return `guest_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }

  private shouldRouteDirectlyToStaff(
    actorType: SenderType,
    dto: SendMessageDto,
  ): boolean {
    const eligibleActors: SenderType[] = [SenderType.user, SenderType.guest];

    return (
      eligibleActors.includes(actorType) &&
      (dto.messageType === undefined || dto.messageType === MessageType.text) &&
      dto.content.trim().length > 0
    );
  }

  private isAiModeRequest(content: string): boolean {
    const normalized = content
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return AI_MODE_PHRASES.some((phrase) => normalized.includes(phrase));
  }

  private async handleAiResponse(
    actorType: SenderType,
    dto: SendMessageDto,
    roomId: string,
    senderName?: string,
  ) {
    if (!this.shouldRouteDirectlyToStaff(actorType, dto)) {
      return;
    }

    if (this.isAiModeRequest(dto.content)) {
      await this.chatService.clearHumanHandoff(dto.conversationId);
      this.server.to(roomId).emit('chat:handoff_status', {
        conversationId: dto.conversationId,
        status: 'connected',
        source: 'ai',
        actorType,
        senderName: 'HomeIQ Assistant',
      });
      return;
    }

    if (await this.chatService.hasHumanHandoff(dto.conversationId)) {
      return;
    }

    const aiResponse = await this.chatAiService.generateReply({
      conversationId: dto.conversationId,
      actorType,
      message: dto.content,
      apartmentId: dto.apartmentId,
    });

    if (!aiResponse) {
      return;
    }

    if (aiResponse.shouldHandoff) {
      await this.emitHandoffRequest({
        actorType,
        dto,
        roomId,
        senderName,
        handoffReason: aiResponse.handoffReason || 'human_support_requested',
        source: 'ai',
      });
      return;
    }

    const aiMessage = await this.chatService.sendSystemMessage({
      conversationId: dto.conversationId,
      content: aiResponse.answer,
      attachments: {
        ai: {
          model: aiResponse.model,
          intent: aiResponse.intent,
          confidence: aiResponse.confidence,
          citations: aiResponse.citations ?? [],
        },
        blocks: aiResponse.blocks ?? [],
      } as any,
    });

    this.server.to(roomId).emit('chat:new_message', aiMessage);
    this.emitConversationUpdated({
      conversationId: dto.conversationId,
      lastMessageAt: aiMessage.timestamp,
      lastMessageText:
        aiMessage.content.length > 100
          ? `${aiMessage.content.substring(0, 100)}...`
          : aiMessage.content,
      senderName: 'HomeIQ Assistant',
      senderType: SenderType.system,
    });
  }

  private async emitHandoffRequest(params: {
    actorType: SenderType;
    dto: SendMessageDto;
    roomId: string;
    senderName?: string;
    handoffReason: string;
    source: string;
  }) {
    const { actorType, dto, roomId, senderName, handoffReason, source } = params;

    if (this.isDirectStaffRoutingSuppressed(dto.conversationId)) {
      return;
    }

    this.directStaffRoutingTimestamps.set(dto.conversationId, Date.now());
    await this.chatService.markHumanHandoff({
      conversationId: dto.conversationId,
      handoffReason,
      source,
    });

    const handoffPayload = {
      conversationId: dto.conversationId,
      handoffReason,
      status: 'connecting',
      source,
      actorType,
      senderName: senderName ?? null,
      preview:
        dto.content.length > 100
          ? `${dto.content.substring(0, 100)}...`
          : dto.content,
      apartmentId: dto.apartmentId ?? null,
    };

    this.server.to(roomId).emit('chat:handoff_status', handoffPayload);
    this.server.to('staff:inbox').emit('chat:handoff_requested', handoffPayload);
  }

  private isDirectStaffRoutingSuppressed(conversationId: string): boolean {
    const lastRoutedAt =
      this.directStaffRoutingTimestamps.get(conversationId) ?? null;

    if (!lastRoutedAt) {
      return false;
    }

    if (Date.now() - lastRoutedAt >= DIRECT_STAFF_HANDOFF_COOLDOWN_MS) {
      this.directStaffRoutingTimestamps.delete(conversationId);
      return false;
    }

    return true;
  }

  private emitConversationUpdated(payload: Record<string, unknown>) {
    this.server.to('staff:inbox').emit('chat:conversation_updated', payload);
  }

  private async setOnlineStatus(
    actorType: SenderType,
    actorId: string,
    isOnline: boolean,
  ): Promise<void> {
    const key = `chat:online:${actorType}:${actorId}`;
    try {
      if (isOnline) {
        await this.cacheManager.set(key, '1', ONLINE_TTL * 1000);
      } else {
        await this.cacheManager.del(key);
      }
    } catch (error) {
      this.logger.warn(`Redis online status error: ${error.message}`);
    }
  }
}
