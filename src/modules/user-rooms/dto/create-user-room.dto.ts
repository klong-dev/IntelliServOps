import {
  IsString,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserRoomDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'User ID',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    description: 'Room ID',
  })
  @IsUUID()
  roomId: string;

  @ApiProperty({
    example: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    description: 'Rental Contract ID',
  })
  @IsUUID()
  rentalContractId: string;

  @ApiPropertyOptional({ example: '2026-03-01', description: 'Move-in date' })
  @IsDateString()
  @IsOptional()
  moveInDate?: string;

  @ApiPropertyOptional({ example: '2027-03-01', description: 'Move-out date' })
  @IsDateString()
  @IsOptional()
  moveOutDate?: string;

  @ApiPropertyOptional({
    default: true,
    description: 'Is this the primary room for the user',
  })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;

  @ApiPropertyOptional({
    example: 'Tenant preferred this room for its window view',
    description: 'Additional notes',
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
}
