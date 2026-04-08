import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
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
}

export class UpdateIoTBoardDeviceDto extends PartialType(
  CreateIoTBoardDeviceDto,
) {}
