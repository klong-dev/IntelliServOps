import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateAmenityDto {
  @ApiProperty({
    example: 'wifi',
    description:
      'Unique amenity code (lowercase, numbers, underscore). Used as stable key for frontend.',
  })
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-z0-9_]+$/)
  code: string;

  @ApiProperty({
    example: 'Wi-Fi',
    description: 'Amenity display name',
  })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    example: 'Internet wireless tốc độ cao',
    description: 'Amenity description',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    example: 'wifi-icon',
    description: 'Icon key used by frontend',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  icon?: string;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description: 'Active status',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
