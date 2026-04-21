import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CancelContractDto {
  @ApiProperty({
    example: 'Không có nhu cầu thuê nữa',
    description: 'Reason provided by user when cancelling contract',
  })
  @IsString()
  @MinLength(5)
  reason: string;
}
