import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class DoorHistoryQueryDto {
  @ApiPropertyOptional({ example: 'ESP_A101' })
  @IsOptional()
  boardId?: string;

  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @IsOptional()
  @IsUUID()
  apartmentId?: string;

  @ApiPropertyOptional({
    example: '2026-04-01T00:00:00.000Z',
    description: 'Start time filter',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-04-30T23:59:59.999Z',
    description: 'End time filter',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    example: 50,
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class DoorHistoryItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'IOT_DOOR_OPENED' })
  action: string;

  @ApiProperty({ example: 'ESP_A101' })
  boardId: string;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 1 })
  deviceId: number | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  apartmentId: string | null;

  @ApiProperty({ example: 'system' })
  actorType: string;

  @ApiProperty({ example: 'ESP_A101' })
  actorId: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Door 1 on board ESP_A101 opened',
  })
  description: string | null;

  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ type: Date })
  createdAt: Date;
}

export class DoorHistoryListDto {
  @ApiProperty({ type: [DoorHistoryItemDto] })
  items: DoorHistoryItemDto[];

  @ApiProperty({ example: 12 })
  total: number;

  @ApiProperty({ example: 50 })
  limit: number;
}
