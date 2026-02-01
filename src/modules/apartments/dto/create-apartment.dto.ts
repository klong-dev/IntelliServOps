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
  IsDecimal,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { FurnishingStatus, ApartmentStatus } from '@prisma/client';

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

  @ApiProperty({ example: '208 Nguyen Huu Canh, Binh Thanh' })
  @IsString()
  @MaxLength(500)
  address: string;

  @ApiProperty({ example: 'Ho Chi Minh' })
  @IsString()
  @MaxLength(100)
  city: string;

  @ApiProperty({ example: 'Binh Thanh' })
  @IsString()
  @MaxLength(100)
  district: string;

  @ApiPropertyOptional({ example: 'Ward 22' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  ward?: string;

  @ApiPropertyOptional({ example: 10.8012 })
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ example: 106.7200 })
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

  @ApiPropertyOptional({ description: 'Partner ID if listed by partner' })
  @IsString()
  @IsOptional()
  partnerId?: string;
}
