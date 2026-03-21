import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterFcmTokenDto {
  @ApiProperty({
    description: 'FCM device token from Firebase SDK',
    example: 'dK4xR9gS...:APA91bH...',
  })
  @IsString()
  token: string;

  @ApiPropertyOptional({
    description: 'Device name / identifier (e.g. "iPhone 15", "Chrome Windows")',
    example: 'iPhone 15 Pro',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  device?: string;
}
