import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelViewingRequestDto {
  @ApiPropertyOptional({
    description: 'Optional cancellation note/reason',
    example: 'Nguoi dung ban viec dot xuat, xin doi lich tuan sau.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
