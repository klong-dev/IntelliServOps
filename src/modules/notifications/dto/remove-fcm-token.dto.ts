import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RemoveFcmTokenDto {
  @ApiProperty({
    description: 'FCM device token to remove',
    example: 'dK4xR9gS...:APA91bH...',
  })
  @IsString()
  token: string;
}
