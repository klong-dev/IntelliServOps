import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { IoTStatus } from '@prisma/client';
import {
  CreateIoTBoardDeviceDto,
  CreateIoTBoardDto,
} from './create-iot-board.dto';

export class UpdateIoTBoardDto extends PartialType(
  OmitType(CreateIoTBoardDto, ['devices'] as const),
) {
  @ApiPropertyOptional({
    description: 'Optional apartment owning this board and its child devices',
  })
  @IsUUID()
  @IsOptional()
  apartmentId?: string;

  @ApiPropertyOptional({
    enum: IoTStatus,
    description:
      'Optional status toggle for this board. Allowed values: active, inactive. Child devices inherit this value.',
    example: IoTStatus.active,
  })
  @IsEnum(IoTStatus)
  @IsOptional()
  status?: IoTStatus;
}

export class UpdateIoTBoardDeviceDto extends PartialType(
  CreateIoTBoardDeviceDto,
) {}
