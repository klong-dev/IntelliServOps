import { IsString, MinLength, Matches, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for Guest to verify OTP and complete registration
 * After successful verification, Guest becomes User
 */
export class VerifyOtpDto {
  @ApiProperty({
    example: '0901234567',
    description: 'Phone number used to request OTP',
  })
  @IsString()
  @Matches(/^[0-9]{10,11}$/, {
    message: 'Phone number must be 10-11 digits',
  })
  phone!: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit OTP code received via SMS',
  })
  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  @Matches(/^[0-9]{6}$/, { message: 'OTP must contain only digits' })
  otpCode!: string;

  @ApiProperty({
    example: 'P@ssword123',
    description: 'Password for the new account (minimum 8 characters)',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password!: string;
}
