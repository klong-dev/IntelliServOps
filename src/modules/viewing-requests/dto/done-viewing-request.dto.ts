import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DoneViewingRequestDto {
  @ApiPropertyOptional({
    description: 'Optional note when staff marks viewing as completed',
    example: 'Khach da xem nha, se phan hoi trong 2 ngay toi.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
