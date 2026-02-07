import { PartialType } from '@nestjs/swagger';
import { CreateUtilityMeterDto } from './create-utility-meter.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MeterStatus } from '@prisma/client';

export class UpdateUtilityMeterDto extends PartialType(CreateUtilityMeterDto) {
  @ApiPropertyOptional({ enum: MeterStatus })
  @IsEnum(MeterStatus)
  @IsOptional()
  status?: MeterStatus;
}
