import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IoTStatus } from '@prisma/client';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import {
  CreateIoTBoardDeviceDto,
  CreateIoTBoardDto,
} from './create-iot-board.dto';

export const UPDATABLE_BOARD_STATUSES = [
  IoTStatus.active,
  IoTStatus.inactive,
] as const;

export class UpdateIoTBoardDto extends PartialType(
  OmitType(CreateIoTBoardDto, ['devices'] as const),
) {
  @ApiPropertyOptional({
    enum: UPDATABLE_BOARD_STATUSES,
    description:
      'Optional board status. When updated, the same status is propagated to all child devices.',
  })
  @IsIn(UPDATABLE_BOARD_STATUSES)
  @IsOptional()
  status?: (typeof UPDATABLE_BOARD_STATUSES)[number];

  @ApiPropertyOptional({
    description:
      'Optional apartment owning this board and its child devices. Re-link is only allowed after unlink.',
  })
  @IsUUID()
  @IsOptional()
  apartmentId?: string;
}

export class UpdateIoTBoardDeviceDto extends PartialType(
  CreateIoTBoardDeviceDto,
) {}
