import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CooperationCommissionPhaseInputDto {
  @ApiProperty({
    example: 'Q2-2026',
    description: 'Phase name for admin tracking',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  phaseName: string;

  @ApiProperty({
    example: '2026-04-01T00:00:00.000Z',
    description: 'Phase effective start date/time',
  })
  @IsDateString()
  effectiveFrom: string;

  @ApiPropertyOptional({
    example: '2026-06-30T23:59:59.999Z',
    description:
      'Phase effective end date/time. Null means open-ended until next update.',
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiProperty({
    example: 10,
    description: 'Commission rate percentage applied to cooperation contracts',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commissionRate: number;
}

export class SetGlobalCooperationCommissionPhasesDto {
  @ApiProperty({
    type: [CooperationCommissionPhaseInputDto],
    description:
      'Full active phase list. Existing active list will be replaced.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CooperationCommissionPhaseInputDto)
  phases: CooperationCommissionPhaseInputDto[];
}

export class CooperationCommissionPhaseDto {
  @ApiProperty({ example: '8dd54d08-b7c2-49f5-8678-e8ba3d987f41' })
  id: string;

  @ApiProperty({ example: 'Q2-2026' })
  phaseName: string;

  @ApiProperty({ format: 'date-time' })
  effectiveFrom: Date;

  @ApiPropertyOptional({ type: Date, nullable: true, format: 'date-time' })
  effectiveTo: Date | null;

  @ApiProperty({ example: 10 })
  commissionRate: number;
}

export class SetGlobalCooperationCommissionPhasesResultDto {
  @ApiProperty({ type: [CooperationCommissionPhaseDto] })
  phases: CooperationCommissionPhaseDto[];

  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;
}
