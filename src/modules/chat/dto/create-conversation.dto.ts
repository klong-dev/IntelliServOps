import { IsOptional, IsString, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for creating a new chat conversation.
 * - Logged-in users: userId is extracted from JWT, no need to provide.
 * - Guests: provide guestSessionId (or leave empty to auto-generate), guestName, guestEmail.
 */
export class CreateConversationDto {
  @ApiPropertyOptional({
    description: 'Custom title for the conversation',
    example: 'Hỏi về căn hộ A1-2001',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Guest session ID (auto-generated if empty). Only for guest users.',
    example: 'guest_1710000000_abc123',
  })
  @IsOptional()
  @IsString()
  guestSessionId?: string;

  @ApiPropertyOptional({
    description: 'Guest display name',
    example: 'Nguyễn Văn A',
  })
  @IsOptional()
  @IsString()
  guestName?: string;

  @ApiPropertyOptional({
    description: 'Guest email address',
    example: 'guest@example.com',
  })
  @IsOptional()
  @IsEmail()
  guestEmail?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata (page URL, apartment of interest, etc.)',
    example: { pageUrl: '/apartments/123', apartmentId: 'apt-001' },
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
