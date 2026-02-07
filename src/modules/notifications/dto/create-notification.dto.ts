import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ActorType,
  NotificationType,
  NotificationChannel,
  Priority,
} from '@prisma/client';

export class CreateNotificationDto {
  @ApiProperty({ enum: ActorType })
  @IsEnum(ActorType)
  recipientType: ActorType;

  @ApiProperty({ description: 'Recipient UUID' })
  @IsUUID()
  recipientId: string;

  @ApiPropertyOptional({ enum: NotificationType, default: 'info' })
  @IsEnum(NotificationType)
  @IsOptional()
  notificationType?: NotificationType;

  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiProperty({ example: 'Hóa đơn tháng 2 đã sẵn sàng' })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({ example: 'Hóa đơn tháng 2/2026 đã được tạo...' })
  @IsString()
  @MaxLength(2000)
  message: string;

  @ApiPropertyOptional({ example: '/invoices/abc-123' })
  @IsString()
  @IsOptional()
  actionUrl?: string;

  @ApiPropertyOptional({ example: 'Xem hóa đơn' })
  @IsString()
  @IsOptional()
  actionLabel?: string;

  @ApiPropertyOptional({ enum: Priority, default: 'medium' })
  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @ApiPropertyOptional({ example: 'Invoice' })
  @IsString()
  @IsOptional()
  relatedEntityType?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  relatedEntityId?: string;
}
