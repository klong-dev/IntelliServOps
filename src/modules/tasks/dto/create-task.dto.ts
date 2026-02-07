import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsDateString,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskType, Priority, RelatedEntityType } from '@prisma/client';

export class CreateTaskDto {
  @ApiProperty({ example: 'Inspect apartment A-1501 AC' })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ example: 'Check AC unit reported by tenant' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: TaskType })
  @IsEnum(TaskType)
  taskType: TaskType;

  @ApiPropertyOptional({ enum: Priority, default: 'medium' })
  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @ApiPropertyOptional({ description: 'Staff ID to assign' })
  @IsUUID()
  @IsOptional()
  assignedToStaffId?: string;

  @ApiPropertyOptional({ description: 'Apartment ID' })
  @IsUUID()
  @IsOptional()
  apartmentId?: string;

  @ApiPropertyOptional({ enum: RelatedEntityType })
  @IsEnum(RelatedEntityType)
  @IsOptional()
  relatedEntityType?: RelatedEntityType;

  @ApiPropertyOptional({ description: 'Related entity UUID' })
  @IsUUID()
  @IsOptional()
  relatedEntityId?: string;

  @ApiPropertyOptional({ example: '2026-02-15' })
  @IsDateString()
  @IsOptional()
  scheduledDate?: string;

  @ApiPropertyOptional({
    example: '14:00',
    description: 'Scheduled time (HH:mm)',
  })
  @IsString()
  @IsOptional()
  scheduledTime?: string;

  @ApiPropertyOptional({
    example: 60,
    description: 'Estimated duration in minutes',
  })
  @IsInt()
  @IsOptional()
  @Min(5)
  estimatedDurationMins?: number;
}
