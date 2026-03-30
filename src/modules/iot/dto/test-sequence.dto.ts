import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class TestSequenceDto {
  @ApiPropertyOptional({
    example: 2000,
    description: 'Delay in milliseconds between each MQTT command',
    default: 2000,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60000)
  @IsOptional()
  holdMs?: number;
}
