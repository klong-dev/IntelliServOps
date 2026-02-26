import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Notification Response DTO ──────────────────────────────────────

export class NotificationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'user' })
  recipientType: string;

  @ApiProperty()
  recipientId: string;

  @ApiProperty({ example: 'info' })
  notificationType: string;

  @ApiProperty({ example: 'in_app' })
  channel: string;

  @ApiProperty({ example: 'Payment Reminder' })
  title: string;

  @ApiProperty({ example: 'Your rent payment is due in 3 days.' })
  message: string;

  @ApiPropertyOptional({ nullable: true })
  actionUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  actionLabel: string | null;

  @ApiProperty({ example: 'medium' })
  priority: string;

  @ApiPropertyOptional({ nullable: true })
  relatedEntityType: string | null;

  @ApiPropertyOptional({ nullable: true })
  relatedEntityId: string | null;

  @ApiProperty({ example: false })
  isRead: boolean;

  @ApiPropertyOptional({ nullable: true })
  readAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  sentAt: Date | null;

  @ApiProperty({ example: 'delivered' })
  deliveryStatus: string;

  @ApiPropertyOptional({ nullable: true })
  failureReason: string | null;

  @ApiProperty({ example: 0 })
  retryCount: number;

  @ApiPropertyOptional({ nullable: true })
  metadata: any;

  @ApiPropertyOptional({ nullable: true })
  expiresAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ─── Unread Count Response DTO ──────────────────────────────────────

export class UnreadCountResponseDto {
  @ApiProperty({ example: 5 })
  count: number;
}
