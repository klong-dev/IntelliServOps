import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import {
  CreateIoTBoardDeviceDto,
  CreateIoTBoardDto,
} from './create-iot-board.dto';

export class UpdateIoTBoardDto extends PartialType(CreateIoTBoardDto) {
  @ApiPropertyOptional({
    example: 'A101 Main Board v2',
    description: 'Updated board name propagated to child device metadata',
  })
  @IsString()
  @IsOptional()
  boardName?: string;

  @ApiPropertyOptional({
    description: 'Move all board devices to another apartment',
  })
  @IsUUID()
  @IsOptional()
  apartmentId?: string;
}

export class UpdateIoTBoardDeviceDto extends PartialType(
  CreateIoTBoardDeviceDto,
) {}
