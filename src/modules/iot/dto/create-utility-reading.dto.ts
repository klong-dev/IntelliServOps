import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsDateString,
  IsNumber,
  IsArray,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReadingType } from '@prisma/client';

export class CreateUtilityReadingDto {
  @ApiProperty({ description: 'Utility meter ID' })
  @IsUUID()
  utilityMeterId: string;

  @ApiPropertyOptional({ description: 'Rental contract ID' })
  @IsUUID()
  @IsOptional()
  rentalContractId?: string;

  @ApiProperty({ example: '2026-02-01' })
  @IsDateString()
  readingDate: string;

  @ApiProperty({ example: 1250.5, description: 'Current reading value' })
  @IsNumber()
  @Min(0)
  readingValue: number;

  @ApiPropertyOptional({ enum: ReadingType, default: 'manual' })
  @IsEnum(ReadingType)
  @IsOptional()
  readingType?: ReadingType;

  @ApiPropertyOptional({ description: 'Photo evidence of meter reading' })
  @IsArray()
  @IsOptional()
  images?: string[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
