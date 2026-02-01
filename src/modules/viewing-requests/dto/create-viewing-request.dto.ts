import {
  IsString,
  IsOptional,
  IsEmail,
  IsUUID,
  IsDateString,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateViewingRequestDto {
  @ApiProperty({ description: 'Apartment ID to view' })
  @IsUUID()
  apartmentId: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  @IsString()
  @MaxLength(100)
  fullName: string;

  @ApiProperty({ example: 'guest@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '0901234567' })
  @IsString()
  @MaxLength(20)
  phone: string;

  @ApiPropertyOptional({ example: '2026-02-15', description: 'Preferred move-in date' })
  @IsDateString()
  @IsOptional()
  preferredMoveInDate?: string;

  @ApiPropertyOptional({ example: 'Looking for 2BR apartment near downtown' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  message?: string;

  @ApiPropertyOptional({ example: 2, description: 'Number of people who will live' })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(10)
  numberOfOccupants?: number;

  @ApiPropertyOptional({ example: 'morning', description: 'Best time to contact' })
  @IsString()
  @IsOptional()
  preferredContactTime?: string;
}
