import {
  IsString,
  IsOptional,
  IsDateString,
  MinLength,
  MaxLength,
  IsEmail,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for Staff to submit guest information after rental agreement
 * This creates a pending registration that the guest can complete via mobile app
 */
export class SubmitGuestInfoDto {
  @ApiProperty({
    example: '0901234567',
    description: 'Phone number of the guest (used for OTP verification)',
  })
  @IsString()
  @Matches(/^[0-9]{10,11}$/, {
    message: 'Phone number must be 10-11 digits',
  })
  phone!: string;

  @ApiPropertyOptional({
    example: 'guest@example.com',
    description: 'Email address of the guest',
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    example: 'Nguyen Van A',
    description: 'Full name of the guest',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  fullName!: string;

  @ApiPropertyOptional({
    example: '1990-05-15',
    description: 'Date of birth (ISO format)',
  })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiPropertyOptional({
    example: '012345678901',
    description: 'National ID number (CCCD)',
  })
  @IsString()
  @IsOptional()
  nationalId?: string;

  @ApiPropertyOptional({
    example: 'A12345678',
    description: 'Passport number',
  })
  @IsString()
  @IsOptional()
  passportNumber?: string;

  @ApiPropertyOptional({
    example: 'Nguyen Thi B',
    description: 'Emergency contact name',
  })
  @IsString()
  @IsOptional()
  emergencyContactName?: string;

  @ApiPropertyOptional({
    example: '0909876543',
    description: 'Emergency contact phone',
  })
  @IsString()
  @IsOptional()
  emergencyContactPhone?: string;

  @ApiPropertyOptional({
    example: 'Tenant for apartment 101, building A',
    description: 'Additional notes from staff',
  })
  @IsString()
  @IsOptional()
  notes?: string;
}
