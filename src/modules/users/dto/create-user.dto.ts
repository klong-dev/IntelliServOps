import {
  IsEmail,
  IsString,
  IsOptional,
  IsDateString,
  MinLength,
  MaxLength,
  IsPhoneNumber,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address (must be unique)',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '0901234567',
    description: 'Phone number',
  })
  @IsString()
  phone: string;

  @ApiProperty({
    example: 'Nguyen Van A',
    description: 'Full name of the user',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  fullName: string;

  @ApiProperty({
    example: 'P@ssword123',
    description: 'Password (minimum 8 characters)',
  })
  @IsString()
  @MinLength(8)
  password: string;

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
    example: 'https://example.com/avatar.jpg',
    description: 'Profile image URL',
  })
  @IsUrl({ require_tld: false })
  @IsOptional()
  profileImageUrl?: string;

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
}
