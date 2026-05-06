import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsBoolean,
  IsDateString,
  IsNumber,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MeterType } from '@prisma/client';

export class CreateUtilityMeterDto {
  @ApiProperty({ example: 'EL-2026-001' })
  @IsString()
  @MaxLength(100)
  meterNumber: string;

  @ApiProperty({ enum: MeterType })
  @IsEnum(MeterType)
  meterType: MeterType;

  @ApiPropertyOptional({ example: 'Schneider' })
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiPropertyOptional({ example: 'iEM3155' })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiProperty({ description: 'Apartment ID' })
  @IsUUID()
  apartmentId: string;

  @ApiProperty({ example: '2026-01-15' })
  @IsDateString()
  installationDate: string;

  @ApiPropertyOptional({ example: 'kWh' })
  @IsString()
  @IsOptional()
  unitOfMeasurement?: string;

  @ApiPropertyOptional({
    example: 3500,
    description:
      'Optional per-meter override. When omitted, the global default utility rate is used for electricity/water meters.',
  })
  @IsNumber()
  @IsOptional()
  @Min(1)
  ratePerUnit?: number;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isDigital?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
