import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── IoT Device List Item DTO ───────────────────────────────────────

class DeviceApartmentSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'A101' })
  apartmentNumber: string;

  @ApiProperty({ example: '123 Nguyen Hue, Q1' })
  address: string;
}

class DeviceRoomSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'R01' })
  roomNumber: string;

  @ApiProperty({ example: 'bedroom' })
  roomType: string;
}

export class IoTMqttPublishDetailsDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  brokerUrl: string | null;

  @ApiProperty({ example: 'ESP_A101/light' })
  topic: string;

  @ApiProperty({ example: 'on_1' })
  payload: string;

  @ApiProperty({ example: 'ESP_A101' })
  espId: string;

  @ApiProperty({ example: 'light' })
  controlType: string;

  @ApiProperty({ example: 1 })
  channelId: number;

  @ApiProperty()
  publishedAt: Date;
}

export class IoTGatewayStatusDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: true })
  mqttConnected: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  brokerUrl: string | null;

  @ApiProperty({ example: 'HOMEIQ/+/status' })
  statusTopic: string;
}

export class IoTDeviceListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Smart Lock A101' })
  deviceName: string;

  @ApiProperty({ example: 'smart_lock' })
  deviceType: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  brand: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  model: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  serialNumber: string | null;

  @ApiProperty({ example: 'active' })
  status: string;

  @ApiProperty()
  isControllableByTenant: boolean;

  @ApiPropertyOptional({ type: Date, nullable: true })
  lastOnlineAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: DeviceApartmentSummaryDto })
  apartment: DeviceApartmentSummaryDto;

  @ApiPropertyOptional({ type: DeviceRoomSummaryDto, nullable: true })
  room: DeviceRoomSummaryDto | null;
}

// ─── IoT Device Detail DTO ──────────────────────────────────────────

export class IoTDeviceDetailDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Smart Lock A101' })
  deviceName: string;

  @ApiProperty({ example: 'smart_lock' })
  deviceType: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  brand: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  model: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  serialNumber: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  macAddress: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  locationDescription: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  firmwareVersion: string | null;

  @ApiProperty({ example: 'active' })
  status: string;

  @ApiProperty()
  isControllableByTenant: boolean;

  @ApiPropertyOptional({ type: Date, nullable: true })
  lastOnlineAt: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  lastMaintenanceDate: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  nextMaintenanceDate: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  installationDate: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  warrantyExpiryDate: Date | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  configuration: any;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'ESP_A101' })
  mqttEspId: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'A101 Main Board',
  })
  mqttBoardName: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'door' })
  mqttControlType: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 1 })
  mqttChannelId: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 1 })
  mqttDoorPasswordChannelId: number | null;

  @ApiProperty()
  accessLogsEnabled: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  notes: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: DeviceApartmentSummaryDto })
  apartment: DeviceApartmentSummaryDto;

  @ApiPropertyOptional({ type: DeviceRoomSummaryDto, nullable: true })
  room: DeviceRoomSummaryDto | null;
}

// ─── Control Device Response DTO ────────────────────────────────────

export class ControlDeviceResponseDto {
  @ApiProperty({ example: 'Command executed successfully' })
  status: string;

  @ApiProperty()
  deviceId: string;

  @ApiProperty({ example: 'unlock' })
  command: string;

  @ApiProperty()
  executedAt: Date;

  @ApiProperty({ example: 'ESP_A101' })
  mqttEspId: string;

  @ApiProperty({ example: 'door' })
  mqttControlType: string;

  @ApiProperty({ example: 1 })
  mqttChannelId: number;

  @ApiProperty({ example: 'ESP_A101/door' })
  mqttTopic: string;

  @ApiProperty({ example: 'open_1' })
  mqttPayload: string;
}

export class IoTMqttCommandResultDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'The lights have been turned on' })
  message: string;

  @ApiProperty({ type: IoTMqttPublishDetailsDto })
  details: IoTMqttPublishDetailsDto;
}

export class IoTTestSequenceStepDto {
  @ApiProperty({ example: 1 })
  order: number;

  @ApiProperty({ example: 'LIGHT_1_ON' })
  action: string;

  @ApiProperty({ type: IoTMqttPublishDetailsDto })
  details: IoTMqttPublishDetailsDto;
}

export class IoTTestSequenceResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Test sequence completed' })
  message: string;

  @ApiProperty({ example: 2000 })
  holdMs: number;

  @ApiProperty({ example: 10 })
  totalSteps: number;

  @ApiProperty({ type: [IoTTestSequenceStepDto] })
  steps: IoTTestSequenceStepDto[];
}

// ─── Utility Meter List Item DTO ────────────────────────────────────

export class UtilityMeterListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'MTR-001' })
  meterNumber: string;

  @ApiProperty({ example: 'electricity' })
  meterType: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  brand: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  model: string | null;

  @ApiPropertyOptional({ example: '1234.56', nullable: true })
  currentReading: string | null;

  @ApiPropertyOptional({ example: '1200.00', nullable: true })
  previousReading: string | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  readingDate: Date | null;

  @ApiProperty({ example: 'active' })
  status: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: DeviceApartmentSummaryDto })
  apartment: DeviceApartmentSummaryDto;
}

// ─── Utility Meter Detail DTO ───────────────────────────────────────

export class UtilityMeterDetailDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'MTR-001' })
  meterNumber: string;

  @ApiProperty({ example: 'electricity' })
  meterType: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  brand: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  model: string | null;

  @ApiProperty()
  installationDate: Date;

  @ApiPropertyOptional({ type: Date, nullable: true })
  lastInspectionDate: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  nextInspectionDate: Date | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  unitOfMeasurement: string | null;

  @ApiPropertyOptional({ example: '3500.00', nullable: true })
  ratePerUnit: string | null;

  @ApiPropertyOptional({ example: '1234.56', nullable: true })
  currentReading: string | null;

  @ApiPropertyOptional({ example: '1200.00', nullable: true })
  previousReading: string | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  readingDate: Date | null;

  @ApiProperty({ example: 'active' })
  status: string;

  @ApiProperty()
  isDigital: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  notes: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: DeviceApartmentSummaryDto })
  apartment: DeviceApartmentSummaryDto;
}

// ─── Utility Reading DTO ────────────────────────────────────────────

export class UtilityReadingDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: '1234.56' })
  readingValue: string;

  @ApiPropertyOptional({ example: '1200.00', nullable: true })
  previousReadingValue: string | null;

  @ApiPropertyOptional({ example: '34.56', nullable: true })
  consumption: string | null;

  @ApiProperty()
  readingDate: Date;

  @ApiProperty({ example: 'manual' })
  readingType: string;

  @ApiProperty()
  isVerified: boolean;

  @ApiPropertyOptional({ type: Date, nullable: true })
  verifiedAt: Date | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  notes: string | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  images: any;

  @ApiProperty()
  createdAt: Date;
}
