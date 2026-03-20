import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { ChatService } from './chat.service';
import {
  CreateConversationDto,
  QueryConversationsDto,
  QueryMessagesDto,
} from './dto';

@ApiTags('Chat')
@ApiBearerAuth('JWT-auth')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // ============================================================================
  // Conversations
  // ============================================================================

  /**
   * Get conversations list.
   * Staff/operator/admin: sees all conversations.
   * User: sees own conversations only.
   */
  @Get('conversations')
  @ApiOperation({ summary: 'Get conversations list (staff: all, user: own)' })
  async getConversations(
    @Req() req: any,
    @Query() query: QueryConversationsDto,
  ) {
    const user = req.user;
    const isStaff = ['staff', 'operator', 'admin'].includes(user.actorType);

    return this.chatService.getConversations(query, {
      userId: isStaff ? undefined : user.id,
      isStaff,
    });
  }

  /**
   * Create a new conversation (REST alternative to socket event)
   */
  @Post('conversations')
  @ApiOperation({ summary: 'Create a new chat conversation' })
  async createConversation(
    @Req() req: any,
    @Body() dto: CreateConversationDto,
  ) {
    const user = req.user;
    return this.chatService.createConversation(dto, user.id, user.fullName);
  }

  /**
   * Get a single conversation detail
   */
  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get conversation detail' })
  async getConversation(@Param('id') id: string) {
    return this.chatService.getConversation(id);
  }

  /**
   * Get messages for a conversation
   */
  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Get paginated messages for a conversation' })
  async getMessages(
    @Param('id') id: string,
    @Query() query: QueryMessagesDto,
  ) {
    return this.chatService.getMessages(id, query);
  }

  // ============================================================================
  // Conversation Actions (Staff only)
  // ============================================================================

  /**
   * Close a conversation
   */
  @Patch('conversations/:id/close')
  @Roles(Role.STAFF, Role.OPERATOR, Role.ADMIN)
  @ApiOperation({ summary: 'Close a conversation (staff only)' })
  async closeConversation(@Req() req: any, @Param('id') id: string) {
    const user = req.user;
    return this.chatService.closeConversation(id, user.fullName || user.email);
  }

  /**
   * Archive a conversation
   */
  @Patch('conversations/:id/archive')
  @Roles(Role.STAFF, Role.OPERATOR, Role.ADMIN)
  @ApiOperation({ summary: 'Archive a conversation (staff only)' })
  async archiveConversation(@Param('id') id: string) {
    return this.chatService.archiveConversation(id);
  }

  /**
   * Reopen a closed conversation
   */
  @Patch('conversations/:id/reopen')
  @Roles(Role.STAFF, Role.OPERATOR, Role.ADMIN)
  @ApiOperation({ summary: 'Reopen a closed conversation (staff only)' })
  async reopenConversation(@Req() req: any, @Param('id') id: string) {
    const user = req.user;
    return this.chatService.reopenConversation(id, user.fullName || user.email);
  }
}
