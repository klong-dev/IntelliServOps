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
  IsUUID,
  MaxLength,
  Allow,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { FurnishingStatus } from '@prisma/client';

const toStringArray = (
  { value }: { value: unknown },
  options?: { splitCommaSeparated?: boolean },
) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : undefined;
      } catch {
        return undefined;
      }
    }

    if (options?.splitCommaSeparated) {
      return trimmed
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }

    return [trimmed];
  }

  return undefined;
};

export class CreateApartmentDto {
  @ApiPropertyOptional({ example: 'Vinhomes Central Park' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  buildingName?: string;

  @ApiProperty({ example: 'A-1501' })
  @IsString()
  @IsOptional()
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
    description: 'Mã phường/xã (v2)',
  })
  @IsInt()
  @IsOptional()
  wardCode?: number;

  @ApiPropertyOptional({
    example: '12 Nguyễn Huệ, Phường Bến Nghé',
    description: 'Địa chỉ cụ thể (số nhà, ngõ, hẻm, đường...)',
  })
  @IsString()
  @IsOptional()
  streetAddress?: string;

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
    example: [
      '11111111-2222-3333-4444-555555555555',
      '66666666-7777-8888-9999-000000000000',
    ],
    description: 'List of amenity IDs',
  })
  @Transform((params) => toStringArray(params, { splitCommaSeparated: true }))
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  amenityIds?: string[];

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
  @Transform(toStringArray)
  @IsArray()
  @IsOptional()
  images?: string[];

  @ApiPropertyOptional({ example: 'https://youtube.com/watch?v=...' })
  @IsUrl({ require_tld: false })
  @IsOptional()
  videoTourUrl?: string;

  @ApiPropertyOptional({ example: 2020 })
  @IsInt()
  @IsOptional()
  @Min(1900)
  @Max(2100)
  yearBuilt?: number;

  @ApiPropertyOptional({
    description: 'Owner user ID if listed by a specific owner',
  })
  @IsString()
  @IsOptional()
  ownerId?: string;
}

export class CreateApartmentRequestDto extends OmitType(CreateApartmentDto, [
  'images',
  'videoTourUrl',
] as const) {
  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'Apartment images (JPEG, PNG, WebP), max 10 files',
  })
  @Allow()
  images?: any[];

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Apartment video (MP4, MOV, WEBM), max 1 file',
  })
  @Allow()
  video?: any;
}
