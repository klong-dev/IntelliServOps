import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

const VIEWING_APPOINTMENT_STATUS_VALUES = [
  'scheduled',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
] as const;

export class MyViewingRequestsQueryDto {
  @ApiPropertyOptional({
    enum: VIEWING_APPOINTMENT_STATUS_VALUES,
    example: 'scheduled',
    description: 'Filter appointments by status',
  })
  @IsOptional()
  @IsIn(VIEWING_APPOINTMENT_STATUS_VALUES)
  status?: (typeof VIEWING_APPOINTMENT_STATUS_VALUES)[number];

  @ApiPropertyOptional({
    example: 1,
    default: 1,
    description: 'Page number',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({
    example: 10,
    default: 10,
    description: 'Items per page (max 100)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}
