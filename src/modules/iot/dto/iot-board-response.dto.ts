import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IoTStatus } from '@prisma/client';

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

  @ApiPropertyOptional({ type: String, nullable: true, example: 'door' })
  mqttControlType: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 1 })
  mqttChannelId: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 1 })
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

  @ApiProperty({ type: IoTBoardApartmentSummaryDto })
  apartment: IoTBoardApartmentSummaryDto;

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
