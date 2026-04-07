import { PartialType } from '@nestjs/swagger';
import {
  CreateIoTBoardDeviceDto,
  CreateIoTBoardDto,
} from './create-iot-board.dto';

export class UpdateIoTBoardDto extends PartialType(CreateIoTBoardDto) {}

export class UpdateIoTBoardDeviceDto extends PartialType(
  CreateIoTBoardDeviceDto,
) {}
