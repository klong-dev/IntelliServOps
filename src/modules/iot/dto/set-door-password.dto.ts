import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class SetDoorPasswordDto {
  @ApiProperty({
    example: '290304',
    description: 'Door password payload sent directly to the device',
  })
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  password: string;
}
