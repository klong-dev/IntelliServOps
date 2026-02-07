import { PartialType } from '@nestjs/swagger';
import { CreateIoTDeviceDto } from './create-iot-device.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IoTStatus } from '@prisma/client';

export class UpdateIoTDeviceDto extends PartialType(CreateIoTDeviceDto) {
  @ApiPropertyOptional({ enum: IoTStatus })
  @IsEnum(IoTStatus)
  @IsOptional()
  status?: IoTStatus;
}
