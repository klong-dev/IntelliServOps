import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  MaxLength,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MaintenanceCategory, Urgency } from '@prisma/client';

export class CreateMaintenanceDto {
  @ApiProperty({ description: 'Apartment ID' })
  @IsUUID()
  apartmentId: string;

  @ApiPropertyOptional({ description: 'Room ID if specific to a room' })
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

  @ApiPropertyOptional({ description: 'Image URLs of the issue' })
  @IsArray()
  @IsOptional()
  images?: string[];
}
