import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address',
  })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    example: '0901234567',
    description: 'Phone number starting with 0 or +84 (optional)',
  })
  @Matches(/^(0|\+84)\d{9,10}$/, {
    message: 'Phone number must start with 0 or +84 followed by 9-10 digits',
  })
  @IsOptional()
  phone?: string;

  @ApiProperty({
    example: 'Nguyen Van A',
    description: 'Full name',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  @ApiProperty({
    example: 'password123',
    description: 'Password (minimum 8 characters)',
  })
  @IsString()
  @MinLength(8)
  password: string;
}
