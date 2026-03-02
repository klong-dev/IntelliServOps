import {
  IsString,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRoomStatus } from '@prisma/client';

export class UpdateUserRoomDto {
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
    enum: UserRoomStatus,
    description: 'Room assignment status',
  })
  @IsEnum(UserRoomStatus)
  @IsOptional()
  status?: UserRoomStatus;

  @ApiPropertyOptional({
    example: 'Updated notes',
    description: 'Additional notes',
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
}
