import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import {
  CreateIoTBoardDeviceDto,
  CreateIoTBoardDto,
} from './create-iot-board.dto';

export class UpdateIoTBoardDto extends PartialType(CreateIoTBoardDto) {
  @ApiPropertyOptional({
    description: 'Assign or move the board to another apartment',
  })
  @IsUUID()
  @IsOptional()
  apartmentId?: string;
}

export class UpdateIoTBoardDeviceDto extends PartialType(
  CreateIoTBoardDeviceDto,
) {}
