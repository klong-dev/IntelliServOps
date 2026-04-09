import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IoTStatus } from '@prisma/client';
import { BOARD_DEVICE_STATES, type BoardDeviceState } from './create-iot-board.dto';

class IoTBoardApartmentSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'A101' })
  apartmentNumber: string;

  @ApiProperty({ example: '123 Nguyen Hue, Q1' })
  address: string;
}

class IoTBoardRoomSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'R01' })
  roomNumber: string;

  @ApiProperty({ example: 'bedroom' })
  roomType: string;
}

export class IoTBoardDeviceItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Front Door Lock' })
  deviceName: string;

  @ApiProperty({ example: 'smart_lock' })
  deviceType: string;

  @ApiProperty({ enum: IoTStatus, example: IoTStatus.active })
  status: IoTStatus;

  @ApiProperty()
  isControllableByTenant: boolean;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'door-lock' })
  icon: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'door' })
  mqttTopic: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 1 })
  mqttDeviceId: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 1 })
  mqttDoorPasswordDeviceId: number | null;

  @ApiPropertyOptional({
    enum: BOARD_DEVICE_STATES,
    nullable: true,
    example: 'OFF',
  })
  mqttState: BoardDeviceState | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'door',
    deprecated: true,
  })
  mqttControlType: string | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 1,
    deprecated: true,
  })
  mqttChannelId: number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 1,
    deprecated: true,
  })
  mqttDoorPasswordChannelId: number | null;

  @ApiPropertyOptional({ type: IoTBoardRoomSummaryDto, nullable: true })
  room: IoTBoardRoomSummaryDto | null;
}

export class IoTBoardListItemDto {
  @ApiProperty({ example: 'ESP_A101' })
  id: string;

  @ApiProperty({ example: 'A101 Main Board' })
  name: string;

  @ApiProperty({ enum: IoTStatus, example: IoTStatus.active })
  status: IoTStatus;

  @ApiProperty({ example: 3 })
  deviceCount: number;

  @ApiPropertyOptional({ type: IoTBoardApartmentSummaryDto, nullable: true })
  apartment: IoTBoardApartmentSummaryDto | null;

  @ApiProperty({ type: [IoTBoardDeviceItemDto] })
  devices: IoTBoardDeviceItemDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class IoTBoardDetailDto extends IoTBoardListItemDto {
  @ApiPropertyOptional({ type: Date, nullable: true })
  lastOnlineAt: Date | null;
}

export class IoTBoardDeleteResultDto {
  @ApiProperty({ example: 'ESP_A101' })
  id: string;

  @ApiProperty({ example: 'A101 Main Board' })
  name: string;

  @ApiProperty({ example: 3 })
  affectedDevices: number;

  @ApiProperty({ enum: IoTStatus, example: IoTStatus.inactive })
  status: IoTStatus;
}

export class IoTBoardUnlinkResultDto {
  @ApiProperty({ example: 'ESP_A101' })
  boardId: string;

  @ApiProperty({ example: 'A101 Main Board' })
  boardName: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  previousApartmentId: string | null;

  @ApiProperty({ example: 3 })
  affectedDevices: number;
}

export class IoTApartmentBoardsUnlinkResultDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  apartmentId: string;

  @ApiProperty({ example: 2 })
  affectedBoards: number;

  @ApiProperty({ example: 5 })
  affectedDevices: number;
}
