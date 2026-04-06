import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import {
  Allow,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class AcceptMaintenanceDto {
  @ApiPropertyOptional({
    description: 'Staff acceptance note',
    example: 'I will handle this request this afternoon.',
  })
  @IsString()
  @IsOptional()
  note?: string;
}

export class RejectMaintenanceDto {
  @ApiProperty({
    description: 'Reason for rejection',
    example: 'Issue is outside apartment responsibility.',
  })
  @IsString()
  reason!: string;

  @ApiPropertyOptional({
    description: 'Optional stored rejection evidence image URLs',
    type: [String],
  })
  @IsArray()
  @IsOptional()
  images?: string[];
}

export class RejectMaintenanceRequestDto extends OmitType(
  RejectMaintenanceDto,
  ['images'] as const,
) {
  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'Optional rejection evidence images (JPEG, PNG, WebP)',
  })
  @Allow()
  images?: any[];
}

export class CompleteMaintenanceDto {
  @ApiProperty({
    description: 'Resolution details after completion',
    example: 'Replaced leaking pipe and tested water flow.',
  })
  @IsString()
  resolutionNotes!: string;

  @ApiPropertyOptional({
    description: 'Actual maintenance cost',
    example: 250000,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  cost?: number;

  @ApiPropertyOptional({
    description: 'Optional stored completion image URLs',
    type: [String],
  })
  @IsArray()
  @IsOptional()
  completionImages?: string[];
}

export class CompleteMaintenanceRequestDto extends OmitType(
  CompleteMaintenanceDto,
  ['completionImages'] as const,
) {
  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'Optional completion proof images (JPEG, PNG, WebP)',
  })
  @Allow()
  completionImages?: any[];
}

export class RateMaintenanceDto {
  @ApiProperty({ description: 'Rating from 1 to 5', example: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({
    description: 'User feedback for staff support',
    example: 'Staff solved quickly and politely.',
  })
  @IsString()
  @IsOptional()
  feedback?: string;
}
