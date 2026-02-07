import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsNumber,
  IsArray,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PropertyType } from '@prisma/client';

export class CreatePartnerRequestDto {
  @ApiPropertyOptional({ enum: PropertyType, default: 'apartment' })
  @IsEnum(PropertyType)
  @IsOptional()
  propertyType?: PropertyType;

  @ApiProperty({ example: '123 Nguyễn Xiển, Long Thạnh Mỹ' })
  @IsString()
  @MaxLength(500)
  address: string;

  @ApiProperty({ example: 'TP. Hồ Chí Minh' })
  @IsString()
  city: string;

  @ApiProperty({ example: 'Quận 9' })
  @IsString()
  district: string;

  @ApiPropertyOptional({ example: 75.5, description: 'Total area in m²' })
  @IsNumber()
  @IsOptional()
  totalArea?: number;

  @ApiPropertyOptional({ example: 1, description: 'Number of units' })
  @IsInt()
  @IsOptional()
  @Min(1)
  numberOfUnits?: number;

  @ApiPropertyOptional({
    example: 15000000,
    description: 'Expected monthly rent in VND',
  })
  @IsNumber()
  @IsOptional()
  expectedRentPrice?: number;

  @ApiPropertyOptional({ example: 'Căn hộ mới, full nội thất...' })
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({
    example: ['parking', 'gym', 'pool'],
    type: [String],
  })
  @IsArray()
  @IsOptional()
  amenities?: any;
}
