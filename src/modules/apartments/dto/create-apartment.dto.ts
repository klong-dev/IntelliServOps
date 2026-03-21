import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsUrl,
  IsInt,
  Min,
  Max,
  IsArray,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { FurnishingStatus } from '@prisma/client';

export class CreateApartmentDto {
  @ApiPropertyOptional({ example: 'Vinhomes Central Park' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  buildingName?: string;

  @ApiProperty({ example: 'A-1501' })
  @IsString()
  @MaxLength(50)
  apartmentNumber: string;

  @ApiPropertyOptional({ example: 15 })
  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(200)
  floorNumber?: number;

  @ApiPropertyOptional({
    example: 26728,
    description: 'Mã phường/xã sau sáp nhập (v2)',
  })
  @IsInt()
  @IsOptional()
  newWardCode?: number;

  @ApiPropertyOptional({
    example: 26731,
    description: 'Mã phường/xã trước sáp nhập (v1)',
  })
  @IsInt()
  @IsOptional()
  oldWardCode?: number;

  @ApiPropertyOptional({ example: 10.8012 })
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ example: 106.72 })
  @IsNumber()
  @IsOptional()
  longitude?: number;

  @ApiProperty({ example: 75.5, description: 'Total area in m²' })
  @IsNumber()
  @Min(1)
  totalArea: number;

  @ApiPropertyOptional({ example: 70.0, description: 'Usable area in m²' })
  @IsNumber()
  @IsOptional()
  usableArea?: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(0)
  @Max(20)
  numberOfBedrooms: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(0)
  @Max(10)
  numberOfBathrooms: number;

  @ApiPropertyOptional({ enum: FurnishingStatus, default: 'unfurnished' })
  @IsEnum(FurnishingStatus)
  @IsOptional()
  furnishingStatus?: FurnishingStatus;

  @ApiPropertyOptional({
    example: ['air_conditioning', 'wifi', 'parking', 'gym'],
    description: 'List of amenities',
  })
  @IsArray()
  @IsOptional()
  amenities?: string[];

  @ApiProperty({ example: 15000000, description: 'Monthly rent in VND' })
  @IsNumber()
  @Min(0)
  baseRentPrice: number;

  @ApiPropertyOptional({ example: 30000000, description: 'Deposit in VND' })
  @IsNumber()
  @IsOptional()
  depositAmount?: number;

  @ApiPropertyOptional({ example: 'Modern apartment with city view' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    example: ['https://example.com/img1.jpg'],
    description: 'Array of image URLs',
  })
  @IsArray()
  @IsOptional()
  images?: string[];

  @ApiPropertyOptional({ example: 'https://youtube.com/watch?v=...' })
  @IsUrl()
  @IsOptional()
  videoTourUrl?: string;

  @ApiPropertyOptional({ example: 2020 })
  @IsInt()
  @IsOptional()
  @Min(1900)
  @Max(2100)
  yearBuilt?: number;

  @ApiPropertyOptional({ description: 'Owner user ID if listed by a specific owner' })
  @IsString()
  @IsOptional()
  ownerId?: string;
}
