import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class UtilityReadingListQueryDto {
  @ApiPropertyOptional({ type: Number, example: 12, default: 12 })
  @Transform(({ value }) =>
    value === undefined ? undefined : Number.parseInt(String(value), 10),
  )
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}
