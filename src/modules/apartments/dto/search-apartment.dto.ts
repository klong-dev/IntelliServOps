import {
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ApartmentStatus, FurnishingStatus } from '@prisma/client';

export class SearchApartmentDto {
  @ApiPropertyOptional({
    example: 79,
    description: 'Province code filter.',
  })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  provinceCode?: number;

  @ApiPropertyOptional({
    example: 26728,
    description: 'Ward code filter.',
  })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  wardCode?: number;

  @ApiPropertyOptional({ example: 'Vinhomes' })
  @IsString()
  @IsOptional()
  keyword?: string;

  @ApiPropertyOptional({ example: 1, description: 'Minimum bedrooms' })
  @IsInt()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  minBedrooms?: number;

  @ApiPropertyOptional({ example: 3, description: 'Maximum bedrooms' })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  maxBedrooms?: number;

  @ApiPropertyOptional({ example: 5000000, description: 'Minimum rent' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  minPrice?: number;

  @ApiPropertyOptional({ example: 20000000, description: 'Maximum rent' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  maxPrice?: number;

  @ApiPropertyOptional({ example: 50, description: 'Minimum area m²' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  minArea?: number;

  @ApiPropertyOptional({ example: 100, description: 'Maximum area m²' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  maxArea?: number;

  @ApiPropertyOptional({ enum: FurnishingStatus })
  @IsEnum(FurnishingStatus)
  @IsOptional()
  furnishingStatus?: FurnishingStatus;

  @ApiPropertyOptional({
    enum: ApartmentStatus,
    description:
      'Apartment status filter. If omitted, returns apartments of all statuses.',
  })
  @IsEnum(ApartmentStatus)
  @IsOptional()
  status?: ApartmentStatus;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({
    example: 'baseRentPrice',
    enum: ['baseRentPrice', 'totalArea', 'createdAt', 'numberOfBedrooms'],
  })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({ example: 'asc', enum: ['asc', 'desc'] })
  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc';
}
