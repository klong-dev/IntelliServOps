import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsNumber,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MaintenanceStatus, Urgency } from '@prisma/client';

export class UpdateMaintenanceDto {
  @ApiPropertyOptional({ enum: MaintenanceStatus })
  @IsEnum(MaintenanceStatus)
  @IsOptional()
  status?: MaintenanceStatus;

  @ApiPropertyOptional({ enum: Urgency })
  @IsEnum(Urgency)
  @IsOptional()
  priority?: Urgency;

  @ApiPropertyOptional({ description: 'Scheduled date for maintenance' })
  @IsDateString()
  @IsOptional()
  scheduledDate?: string;

  @ApiPropertyOptional({ description: 'Completion date' })
  @IsDateString()
  @IsOptional()
  completedAt?: string;

  @ApiPropertyOptional({ description: 'Resolution notes' })
  @IsString()
  @IsOptional()
  resolutionNotes?: string;

  @ApiPropertyOptional({ description: 'Maintenance cost' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  cost?: number;
}
