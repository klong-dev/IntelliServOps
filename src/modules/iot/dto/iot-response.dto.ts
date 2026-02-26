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

export class IoTDeviceListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Smart Lock A101' })
  deviceName: string;

  @ApiProperty({ example: 'smart_lock' })
  deviceType: string;

  @ApiPropertyOptional({ nullable: true })
  brand: string | null;

  @ApiPropertyOptional({ nullable: true })
  model: string | null;

  @ApiPropertyOptional({ nullable: true })
  serialNumber: string | null;

  @ApiProperty({ example: 'active' })
  status: string;

  @ApiProperty()
  isControllableByTenant: boolean;

  @ApiPropertyOptional({ nullable: true })
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

  @ApiPropertyOptional({ nullable: true })
  brand: string | null;

  @ApiPropertyOptional({ nullable: true })
  model: string | null;

  @ApiPropertyOptional({ nullable: true })
  serialNumber: string | null;

  @ApiPropertyOptional({ nullable: true })
  macAddress: string | null;

  @ApiPropertyOptional({ nullable: true })
  locationDescription: string | null;

  @ApiPropertyOptional({ nullable: true })
  firmwareVersion: string | null;

  @ApiProperty({ example: 'active' })
  status: string;

  @ApiProperty()
  isControllableByTenant: boolean;

  @ApiPropertyOptional({ nullable: true })
  lastOnlineAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  lastMaintenanceDate: Date | null;

  @ApiPropertyOptional({ nullable: true })
  nextMaintenanceDate: Date | null;

  @ApiPropertyOptional({ nullable: true })
  installationDate: Date | null;

  @ApiPropertyOptional({ nullable: true })
  warrantyExpiryDate: Date | null;

  @ApiPropertyOptional({ nullable: true })
  configuration: any;

  @ApiProperty()
  accessLogsEnabled: boolean;

  @ApiPropertyOptional({ nullable: true })
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
}

// ─── Utility Meter List Item DTO ────────────────────────────────────

export class UtilityMeterListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'MTR-001' })
  meterNumber: string;

  @ApiProperty({ example: 'electricity' })
  meterType: string;

  @ApiPropertyOptional({ nullable: true })
  brand: string | null;

  @ApiPropertyOptional({ nullable: true })
  model: string | null;

  @ApiPropertyOptional({ example: '1234.56', nullable: true })
  currentReading: string | null;

  @ApiPropertyOptional({ example: '1200.00', nullable: true })
  previousReading: string | null;

  @ApiPropertyOptional({ nullable: true })
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

  @ApiPropertyOptional({ nullable: true })
  brand: string | null;

  @ApiPropertyOptional({ nullable: true })
  model: string | null;

  @ApiProperty()
  installationDate: Date;

  @ApiPropertyOptional({ nullable: true })
  lastInspectionDate: Date | null;

  @ApiPropertyOptional({ nullable: true })
  nextInspectionDate: Date | null;

  @ApiPropertyOptional({ nullable: true })
  unitOfMeasurement: string | null;

  @ApiPropertyOptional({ example: '3500.00', nullable: true })
  ratePerUnit: string | null;

  @ApiPropertyOptional({ example: '1234.56', nullable: true })
  currentReading: string | null;

  @ApiPropertyOptional({ example: '1200.00', nullable: true })
  previousReading: string | null;

  @ApiPropertyOptional({ nullable: true })
  readingDate: Date | null;

  @ApiProperty({ example: 'active' })
  status: string;

  @ApiProperty()
  isDigital: boolean;

  @ApiPropertyOptional({ nullable: true })
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

  @ApiPropertyOptional({ nullable: true })
  verifiedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  notes: string | null;

  @ApiPropertyOptional({ nullable: true })
  images: any;

  @ApiProperty()
  createdAt: Date;
}
