import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  MeterType,
  UtilityRatePlanStatus,
  UtilityRateScope,
} from '@prisma/client';

export class UtilityRateTierDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  tier: number;

  @ApiProperty({ example: 0 })
  @IsNumber()
  @Min(0)
  from: number;

  @ApiPropertyOptional({ example: 50, nullable: true })
  @IsNumber()
  @Min(0)
  @IsOptional()
  to?: number | null;

  @ApiProperty({ example: 1806 })
  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class UtilityRateTiersDto {
  @ApiProperty({ example: 'progressive' })
  @IsString()
  calculationMode: 'progressive';

  @ApiProperty({ example: 'kWh' })
  @IsString()
  unit: string;

  @ApiProperty({ type: [UtilityRateTierDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UtilityRateTierDto)
  tiers: UtilityRateTierDto[];
}

export class CreateUtilityRatePlanDto {
  @ApiProperty({ example: 'Electricity progressive rate 2026' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ enum: MeterType, example: MeterType.electricity })
  @IsEnum(MeterType)
  meterType: MeterType;

  @ApiPropertyOptional({ enum: UtilityRateScope, default: UtilityRateScope.global })
  @IsEnum(UtilityRateScope)
  @IsOptional()
  scopeType?: UtilityRateScope;

  @ApiPropertyOptional({ description: 'Apartment, meter, or contract ID based on scopeType' })
  @IsUUID()
  @IsOptional()
  scopeId?: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  @IsDateString()
  effectiveFrom: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.999Z', nullable: true })
  @IsDateString()
  @IsOptional()
  effectiveTo?: string | null;

  @ApiPropertyOptional({ enum: UtilityRatePlanStatus, default: UtilityRatePlanStatus.active })
  @IsEnum(UtilityRatePlanStatus)
  @IsOptional()
  status?: UtilityRatePlanStatus;

  @ApiPropertyOptional({ example: 'VND', default: 'VND' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ type: UtilityRateTiersDto })
  @ValidateNested()
  @Type(() => UtilityRateTiersDto)
  tiers: UtilityRateTiersDto;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateUtilityRatePlanDto extends PartialType(CreateUtilityRatePlanDto) {}

export class UtilityRatePlanQueryDto {
  @ApiPropertyOptional({ enum: MeterType })
  @IsEnum(MeterType)
  @IsOptional()
  meterType?: MeterType;

  @ApiPropertyOptional({ enum: UtilityRateScope })
  @IsEnum(UtilityRateScope)
  @IsOptional()
  scopeType?: UtilityRateScope;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  scopeId?: string;

  @ApiPropertyOptional({ enum: UtilityRatePlanStatus })
  @IsEnum(UtilityRatePlanStatus)
  @IsOptional()
  status?: UtilityRatePlanStatus;
}

export class EffectiveUtilityRatePlanQueryDto {
  @ApiPropertyOptional({ description: 'Contract ID for contract-scoped override lookup' })
  @IsUUID()
  @IsOptional()
  contractId?: string;

  @ApiPropertyOptional({ example: '2026-04-30T00:00:00.000Z' })
  @IsDateString()
  @IsOptional()
  at?: string;
}

export class UtilityReadingListQueryDto {
  @ApiPropertyOptional({ type: Number, example: 12, default: 12 })
  @Transform(({ value }) =>
    value === undefined ? undefined : Number.parseInt(String(value), 10),
  )
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}
