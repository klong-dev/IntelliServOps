import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ControlDeviceDto {
  @ApiProperty({
    example: 'unlock',
    description: 'Command to send to device (e.g., lock, unlock, on, off)',
  })
  @IsString()
  @MaxLength(100)
  command: string;
}
