import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for Guest to request OTP via mobile app
 * Phone must match a pending registration submitted by Staff
 */
export class RequestOtpDto {
  @ApiProperty({
    example: '0901234567',
    description:
      'Phone number to receive OTP (must match pending registration)',
  })
  @IsString()
  @Matches(/^[0-9]{10,11}$/, {
    message: 'Phone number must be 10-11 digits',
  })
  phone!: string;
}
