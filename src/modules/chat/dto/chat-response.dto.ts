import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Message Response (matches frontend interface) ─────────────

export class MessageResponseDto {
  @ApiProperty({ description: 'Message ID', example: 1 })
  id: number;

  @ApiProperty({ description: 'Message content', example: 'Xin chào!' })
  content: string;

  @ApiPropertyOptional({
    description: 'Array of image URLs',
    type: [String],
    example: ['https://storage.example.com/chat-images/user-id/123-0.jpg'],
  })
  images?: string[];

  @ApiPropertyOptional({
    description: 'Related apartment ID',
    example: 'apt-123',
  })
  apartmentId?: string;

  @ApiProperty({
    description:
      'Sender type: user/guest = "user", staff/operator/admin = "support"',
    enum: ['user', 'support'],
    example: 'user',
  })
  sender: 'user' | 'support';

  @ApiProperty({
    description: 'Message timestamp',
    example: '2026-03-23T10:30:00.000Z',
  })
  timestamp: Date;
}

// ─── Conversation Responses ────────────────────────────────────

export class ConversationUserDto {
  @ApiProperty({ example: 'uuid-123' })
  id: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  fullName: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  profileImageUrl?: string;
}

export class ConversationResponseDto {
  @ApiProperty({ description: 'Conversation ID' })
  id: string;

  @ApiPropertyOptional({ description: 'Conversation title' })
  title?: string;

  @ApiPropertyOptional({ description: 'User ID (null if guest)' })
  userId?: string;

  @ApiPropertyOptional({ description: 'Guest session ID' })
  guestSessionId?: string;

  @ApiPropertyOptional({ description: 'Guest display name' })
  guestName?: string;

  @ApiPropertyOptional({ description: 'Guest email' })
  guestEmail?: string;

  @ApiProperty({
    enum: ['active', 'closed', 'archived'],
    example: 'active',
    description:
      '`closed` chi ton tai voi du lieu cu; luong hien tai su dung `active` va `archived`.',
  })
  status: string;

  @ApiPropertyOptional({ description: 'Last message timestamp (ISO)' })
  lastMessageAt?: string;

  @ApiPropertyOptional({ description: 'Last message preview text' })
  lastMessageText?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  metadata?: Record<string, any>;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;

  @ApiPropertyOptional({ type: ConversationUserDto })
  user?: ConversationUserDto;
}

// ─── Paginated Responses ───────────────────────────────────────

export class PaginationMetaDto {
  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 5 })
  totalPages: number;
}

export class PaginatedConversationsResponseDto {
  @ApiProperty({ type: [ConversationResponseDto] })
  data: ConversationResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

export class PaginatedMessagesResponseDto {
  @ApiProperty({ type: [MessageResponseDto] })
  data: MessageResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

// ─── Upload Response ───────────────────────────────────────────

export class UploadImagesResponseDto {
  @ApiProperty({
    description: 'Array of uploaded image URLs',
    type: [String],
    example: ['https://storage.example.com/chat-images/user-id/123-0.jpg'],
  })
  images: string[];
}
