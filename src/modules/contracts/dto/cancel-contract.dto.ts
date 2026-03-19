import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CancelContractDto {
  @ApiProperty({
    example: 'Khong co nhu cau thue nua',
    description: 'Reason provided by user when cancelling contract',
  })
  @IsString()
  @MinLength(5)
  reason: string;
}
