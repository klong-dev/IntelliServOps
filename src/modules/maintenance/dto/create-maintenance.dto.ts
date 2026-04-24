import {
  Allow,
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  MaxLength,
  IsArray,
} from 'class-validator';
import {
  ApiHideProperty,
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
} from '@nestjs/swagger';
import { MaintenanceCategory, Urgency } from '@prisma/client';

export class CreateMaintenanceDto {
  @ApiProperty({ description: 'Apartment ID' })
  @IsUUID()
  apartmentId: string;

  // Deprecated: room scope has been removed from maintenance APIs.
  @ApiHideProperty()
  @IsUUID()
  @IsOptional()
  roomId?: string;

  @ApiProperty({ example: 'Broken air conditioner' })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({ example: 'AC unit in bedroom not cooling properly' })
  @IsString()
  @MaxLength(2000)
  description: string;

  @ApiProperty({ enum: MaintenanceCategory, default: 'appliances' })
  @IsEnum(MaintenanceCategory)
  category: MaintenanceCategory;

  @ApiPropertyOptional({
    enum: Urgency,
    default: 'medium',
    description: 'Urgency level',
  })
  @IsEnum(Urgency)
  @IsOptional()
  priority?: Urgency;

  @ApiPropertyOptional({
    description: 'Stored image URLs of the issue (generated after upload)',
  })
  @IsArray()
  @IsOptional()
  images?: string[];
}

export class CreateMaintenanceRequestDto extends OmitType(
  CreateMaintenanceDto,
  ['images'] as const,
) {
  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'Issue images (JPEG, PNG, WebP), max 10 files',
  })
  @Allow()
  images?: any[];
}
