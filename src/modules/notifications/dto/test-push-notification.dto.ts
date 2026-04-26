import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class TestPushNotificationDto {
  @ApiProperty({ example: 'IntelliRentOps test push' })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({ example: 'This is a test push notification from backend.' })
  @IsString()
  @MaxLength(2000)
  message: string;

  @ApiPropertyOptional({
    description: 'Optional string key/value payload sent through FCM data.',
    example: { type: 'test_push', source: 'admin' },
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, string>;
}
