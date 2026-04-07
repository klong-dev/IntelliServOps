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

  @ApiProperty({ example: 1 })
  deviceId: number | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'door-lock' })
  icon: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'door' })
  topic: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'CLOSED' })
  state: string | null;

  @ApiProperty({ example: 'smart_lock' })
  deviceType: string;

  @ApiProperty({ enum: IoTStatus, example: IoTStatus.active })
  status: IoTStatus;

  @ApiProperty()
  isControllableByTenant: boolean;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 1, deprecated: true })
  mqttDeviceId: number | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'door', deprecated: true })
  mqttTopic: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'CLOSED', deprecated: true })
  mqttState: string | null;

  @ApiPropertyOptional({ type: IoTBoardRoomSummaryDto, nullable: true })
  room: IoTBoardRoomSummaryDto | null;
}

export class IoTBoardListItemDto {
  @ApiProperty({ example: 'ESP_A101' })
  id: string;

  @ApiProperty({ example: 'ESP_A101' })
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

  @ApiProperty({ example: 'ESP_A101' })
  name: string;

  @ApiProperty({ example: 3 })
  affectedDevices: number;

  @ApiProperty({ enum: IoTStatus, example: IoTStatus.inactive })
  status: IoTStatus;
}
