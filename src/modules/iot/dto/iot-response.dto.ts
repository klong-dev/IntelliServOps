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

export class IoTMqttPublishDetailsDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  brokerUrl: string | null;

  @ApiProperty({ example: 'ESP_A101/light' })
  topic: string;

  @ApiProperty({ example: 'ON_1' })
  payload: string;

  @ApiProperty({ example: 'ESP_A101' })
  espId: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'light' })
  deviceTopic: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 1 })
  deviceId: number | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'ON' })
  action: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'light',
    deprecated: true,
  })
  controlType: string | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 1,
    deprecated: true,
  })
  channelId: number | null;

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

  @ApiProperty({ example: 'HOMEIQ/+/telemetry' })
  telemetryTopic: string;
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

  @ApiPropertyOptional({ type: String, nullable: true, example: 'ESP_A101' })
  mqttEspId: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'light' })
  mqttTopic: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 1 })
  mqttDeviceId: number | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'ON' })
  mqttState: string | null;

  @ApiPropertyOptional({ example: true, nullable: true })
  isUtilityMeter?: boolean | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  utilityMeterId?: string | null;

  @ApiPropertyOptional({ example: true, nullable: true })
  utilityMeterShared?: boolean | null;

  @ApiPropertyOptional({ example: 'apartment', nullable: true })
  utilityMeterScope?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '5f17591f-4a37-4ee6-a4eb-e5b5af2857cc',
  })
  utilityMeterSharedApartmentId?: string | null;

  @ApiPropertyOptional({ example: 'electricity', nullable: true })
  utilityMeterType?: string | null;

  @ApiPropertyOptional({ example: 'UTILITY-ESP_A101-electric-5', nullable: true })
  utilityMeterNumber?: string | null;

  @ApiPropertyOptional({ example: '1250.00', nullable: true })
  currentReading?: string | null;

  @ApiPropertyOptional({ example: '1100.00', nullable: true })
  previousReading?: string | null;

  @ApiPropertyOptional({ example: '3500.00', nullable: true })
  ratePerUnit?: string | null;

  @ApiPropertyOptional({ example: 'kWh', nullable: true })
  unitOfMeasurement?: string | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  readingDate?: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: DeviceApartmentSummaryDto })
  apartment: DeviceApartmentSummaryDto;
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
  mqttTopic: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 1 })
  mqttDeviceId: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 1 })
  mqttDoorPasswordDeviceId: number | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'CLOSED' })
  mqttState: string | null;

  @ApiPropertyOptional({ example: true, nullable: true })
  isUtilityMeter?: boolean | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  utilityMeterId?: string | null;

  @ApiPropertyOptional({ example: true, nullable: true })
  utilityMeterShared?: boolean | null;

  @ApiPropertyOptional({ example: 'apartment', nullable: true })
  utilityMeterScope?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '5f17591f-4a37-4ee6-a4eb-e5b5af2857cc',
  })
  utilityMeterSharedApartmentId?: string | null;

  @ApiPropertyOptional({ example: 'electricity', nullable: true })
  utilityMeterType?: string | null;

  @ApiPropertyOptional({ example: 'UTILITY-ESP_A101-electric-5', nullable: true })
  utilityMeterNumber?: string | null;

  @ApiPropertyOptional({ example: '1250.00', nullable: true })
  currentReading?: string | null;

  @ApiPropertyOptional({ example: '1100.00', nullable: true })
  previousReading?: string | null;

  @ApiPropertyOptional({ example: '3500.00', nullable: true })
  ratePerUnit?: string | null;

  @ApiPropertyOptional({ example: 'kWh', nullable: true })
  unitOfMeasurement?: string | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  readingDate?: Date | null;

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
}

// ─── Control Device Response DTO ────────────────────────────────────

export class ControlDeviceResponseDto {
  @ApiProperty({ example: 'Command executed successfully' })
  status: string;

  @ApiProperty()
  deviceId: string;

  @ApiProperty({ example: 'ON' })
  action: string;

  @ApiProperty()
  executedAt: Date;

  @ApiProperty({ example: 'ESP_A101' })
  mqttEspId: string;

  @ApiProperty({ example: 'door' })
  mqttTopic: string;

  @ApiProperty({ example: 1 })
  mqttDeviceId: number;

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

  @ApiProperty({ example: 'ESP_A101/door' })
  mqttPublishTopic: string;

  @ApiProperty({ example: 'ON_1' })
  mqttPayload: string;
}

export class IoTMqttCommandResultDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'light 1 has been ON' })
  message: string;

  @ApiProperty({ type: IoTMqttPublishDetailsDto })
  details: IoTMqttPublishDetailsDto;
}

export class IoTMqttSignalResultDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Health check signal sent' })
  message: string;

  @ApiProperty({ type: IoTMqttPublishDetailsDto })
  details: IoTMqttPublishDetailsDto;
}

export class IoTHealthCheckResultDto {
  @ApiProperty({ example: 'ESP_A101' })
  espId: string;

  @ApiProperty({ example: true })
  online: boolean;

  @ApiPropertyOptional({ type: Date, nullable: true })
  lastSeenAt: Date | null;
}

export class IoTBoardDeviceControlResultDto {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Door PIN updated successfully.',
  })
  message?: string;
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
