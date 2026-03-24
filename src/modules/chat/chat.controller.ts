import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Req,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { ChatService } from './chat.service';
import { SupabaseStorageService } from '../../shared/services/supabase-storage.service';
import {
  CreateConversationDto,
  QueryConversationsDto,
  QueryMessagesDto,
  UploadImagesResponseDto,
  ConversationResponseDto,
  PaginatedConversationsResponseDto,
  PaginatedMessagesResponseDto,
} from './dto';

@ApiTags('Chat')
@ApiBearerAuth('JWT-auth')
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly storageService: SupabaseStorageService,
  ) {}

  // ============================================================================
  // Image Upload
  // ============================================================================

  @Post('upload-images')
  @ApiOperation({
    summary: 'Upload chat images (max 5)',
    description:
      'Upload image files to Supabase Storage. Returns array of public URLs to include when sending a message.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Image files (JPEG, PNG, WebP) — max 5',
        },
      },
      required: ['images'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Images uploaded successfully',
    type: UploadImagesResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid image format or no files provided',
  })
  @UseInterceptors(FilesInterceptor('images', 5))
  async uploadImages(@UploadedFiles() files: any[], @Req() req: any) {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one image is required');
    }

    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    for (const file of files) {
      if (!validMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          `Invalid image format: ${file.originalname}. Allowed: JPEG, PNG, WebP`,
        );
      }
    }

    const userId = req.user?.sub || req.user?.id || 'anonymous';
    const timestamp = Date.now();
    const urls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const ext =
        files[i].mimetype.split('/')[1] === 'jpeg'
          ? 'jpg'
          : files[i].mimetype.split('/')[1];
      const path = `${userId}/${timestamp}-${i}.${ext}`;
      const url = await this.storageService.uploadFile(
        'chat-images',
        path,
        files[i],
      );
      urls.push(url);
    }

    return { images: urls };
  }

  // ============================================================================
  // Conversations
  // ============================================================================

  @Get('conversations')
  @ApiOperation({
    summary: 'Get conversations list',
    description:
      'Staff/operator/admin: sees all conversations. User: sees own conversations only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of conversations',
    type: PaginatedConversationsResponseDto,
  })
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

  @Post('conversations')
  @ApiOperation({
    summary: 'Create a new chat conversation',
    description: 'REST alternative to socket event chat:create_conversation.',
  })
  @ApiResponse({
    status: 201,
    description: 'Conversation created',
    type: ConversationResponseDto,
  })
  async createConversation(
    @Req() req: any,
    @Body() dto: CreateConversationDto,
  ) {
    const user = req.user;
    return this.chatService.createConversation(dto, user.id, user.fullName);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get conversation detail' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiResponse({
    status: 200,
    description: 'Conversation details',
    type: ConversationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async getConversation(@Param('id') id: string) {
    return this.chatService.getConversation(id);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({
    summary: 'Get paginated messages',
    description:
      'Returns messages in format: { id, content, images?, apartmentId?, sender: "user"|"support", timestamp }',
  })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiResponse({
    status: 200,
    description: 'Paginated messages list',
    type: PaginatedMessagesResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async getMessages(@Param('id') id: string, @Query() query: QueryMessagesDto) {
    return this.chatService.getMessages(id, query);
  }

  // ============================================================================
  // Conversation Actions (Staff only)
  // ============================================================================

  @Patch('conversations/:id/close')
  @Roles(Role.STAFF, Role.OPERATOR, Role.ADMIN)
  @ApiOperation({ summary: 'Close a conversation (staff only)' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiResponse({
    status: 200,
    description: 'Conversation closed',
    type: ConversationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async closeConversation(@Req() req: any, @Param('id') id: string) {
    const user = req.user;
    return this.chatService.closeConversation(id, user.fullName || user.email);
  }

  @Patch('conversations/:id/archive')
  @Roles(Role.STAFF, Role.OPERATOR, Role.ADMIN)
  @ApiOperation({ summary: 'Archive a conversation (staff only)' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiResponse({
    status: 200,
    description: 'Conversation archived',
    type: ConversationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async archiveConversation(@Param('id') id: string) {
    return this.chatService.archiveConversation(id);
  }

  @Patch('conversations/:id/reopen')
  @Roles(Role.STAFF, Role.OPERATOR, Role.ADMIN)
  @ApiOperation({ summary: 'Reopen a closed conversation (staff only)' })
  @ApiParam({ name: 'id', description: 'Conversation UUID' })
  @ApiResponse({
    status: 200,
    description: 'Conversation reopened',
    type: ConversationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async reopenConversation(@Req() req: any, @Param('id') id: string) {
    const user = req.user;
    return this.chatService.reopenConversation(id, user.fullName || user.email);
  }
}
