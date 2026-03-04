import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsString,
  IsInt,
  Min,
} from 'class-validator';

export class CreateReservationDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Apartment ID to reserve',
  })
  @IsUUID()
  @IsNotEmpty()
  apartmentId: string;

  @ApiProperty({
    example: '2026-04-01',
    description: 'Desired move-in / start date (ISO format)',
  })
  @IsDateString()
  @IsNotEmpty()
  desiredStartDate: string;

  @ApiProperty({
    example: '2027-04-01',
    description: 'Desired end date (ISO format)',
  })
  @IsDateString()
  @IsNotEmpty()
  desiredEndDate: string;

  @ApiPropertyOptional({
    example: 2,
    description: 'Number of occupants',
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  numberOfOccupants?: number;

  @ApiPropertyOptional({
    example: 'Need parking spot',
    description: 'Any special requests',
  })
  @IsString()
  @IsOptional()
  specialRequests?: string;
}
