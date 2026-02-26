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

  @ApiPropertyOptional({ type: String, nullable: true })
  actionUrl: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  actionLabel: string | null;

  @ApiProperty({ example: 'medium' })
  priority: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  relatedEntityType: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  relatedEntityId: string | null;

  @ApiProperty({ example: false })
  isRead: boolean;

  @ApiPropertyOptional({ type: Date, nullable: true })
  readAt: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  sentAt: Date | null;

  @ApiProperty({ example: 'delivered' })
  deliveryStatus: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  failureReason: string | null;

  @ApiProperty({ example: 0 })
  retryCount: number;

  @ApiPropertyOptional({ type: Object, nullable: true })
  metadata: any;

  @ApiPropertyOptional({ type: Date, nullable: true })
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
