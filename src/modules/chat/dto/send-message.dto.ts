import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageType } from '@prisma/client';

export class SendMessageDto {
  @ApiProperty({
    description: 'ID of the conversation to send the message to',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty()
  @IsString()
  conversationId: string;

  @ApiProperty({
    description: 'Message content text',
    example: 'Xin chào, tôi muốn hỏi về căn hộ này',
  })
  @IsNotEmpty()
  @IsString()
  content: string;

  @ApiPropertyOptional({
    description: 'Type of message',
    enum: MessageType,
    default: MessageType.text,
    example: 'text',
  })
  @IsOptional()
  @IsEnum(MessageType)
  messageType?: MessageType;

  @ApiPropertyOptional({
    description: 'File attachments array',
    example: [{ url: 'https://storage.example.com/file.pdf', filename: 'contract.pdf', mimeType: 'application/pdf', size: 1024 }],
  })
  @IsOptional()
  attachments?: Array<{
    url: string;
    filename: string;
    mimeType?: string;
    size?: number;
  }>;
}
