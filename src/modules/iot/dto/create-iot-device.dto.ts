import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsBoolean,
  IsDateString,
  MaxLength,
  IsIn,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IoTDeviceType } from '@prisma/client';
import { MQTT_DEVICE_TOPICS } from '../iot-mqtt.types';

const toTrimmedString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : value;

const readObjectValue = (obj: unknown, key: string) =>
  obj && typeof obj === 'object'
    ? (obj as Record<string, unknown>)[key]
    : undefined;

const toOptionalNumber = (value: unknown) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'number' && typeof value !== 'string') {
    return value;
  }

  const parsed = typeof value === 'number' ? value : Number(value.trim());
  return Number.isFinite(parsed) ? parsed : value;
};

export class CreateIoTDeviceDto {
  @ApiProperty({ example: 'Smart Lock - Front Door' })
  @IsString()
  @MaxLength(255)
  deviceName: string;

  @ApiProperty({ enum: IoTDeviceType })
  @IsEnum(IoTDeviceType)
  deviceType: IoTDeviceType;

  @ApiPropertyOptional({ example: 'Tuya' })
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiPropertyOptional({ example: 'ZM-100' })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiPropertyOptional({ example: 'SN-123456' })
  @IsString()
  @IsOptional()
  serialNumber?: string;

  @ApiPropertyOptional({ example: 'AA:BB:CC:DD:EE:FF' })
  @IsString()
  @IsOptional()
  macAddress?: string;

  @ApiProperty({ description: 'Apartment ID' })
  @IsUUID()
  apartmentId: string;

  @ApiPropertyOptional({ description: 'Room ID' })
  @IsUUID()
  @IsOptional()
  roomId?: string;

  @ApiPropertyOptional({ example: 'Installed at main entrance' })
  @IsString()
  @IsOptional()
  locationDescription?: string;

  @ApiPropertyOptional({ example: '1.2.3' })
  @IsString()
  @IsOptional()
  firmwareVersion?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isControllableByTenant?: boolean;

  @ApiPropertyOptional({ example: '2026-01-15' })
  @IsDateString()
  @IsOptional()
  installationDate?: string;

  @ApiPropertyOptional({ example: '2028-01-15' })
  @IsDateString()
  @IsOptional()
  warrantyExpiryDate?: string;

  @ApiPropertyOptional({ description: 'Device configuration JSON' })
  @IsOptional()
  configuration?: Record<string, any>;

  @ApiPropertyOptional({
    example: 'ESP_A101',
    description: 'MQTT target board identifier used as the topic prefix',
  })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsOptional()
  mqttEspId?: string;

  @ApiPropertyOptional({
    example: 'A101 Main Board',
    description: 'Human-readable board name',
  })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsOptional()
  mqttBoardName?: string;

  @ApiPropertyOptional({
    enum: MQTT_DEVICE_TOPICS,
    example: 'door',
    description:
      "MQTT topic configured in the ESP firmware for this device. Legacy field 'mqttControlType' is also accepted.",
  })
  @Transform(({ value, obj }) =>
    toTrimmedString(value ?? readObjectValue(obj, 'mqttControlType')),
  )
  @IsIn(MQTT_DEVICE_TOPICS)
  @IsOptional()
  mqttTopic?: (typeof MQTT_DEVICE_TOPICS)[number];

  @ApiPropertyOptional({
    example: 1,
    description:
      "Logical device id appended to the MQTT payload as ACTION_id. Legacy field 'mqttChannelId' is also accepted.",
  })
  @Transform(({ value, obj }) =>
    toOptionalNumber(value ?? readObjectValue(obj, 'mqttChannelId')),
  )
  @IsInt()
  @Min(1)
  @IsOptional()
  mqttDeviceId?: number;

  @ApiPropertyOptional({
    example: 1,
    description:
      "Optional device id used for door-password responses. Defaults to 'mqttDeviceId' when omitted. Legacy field 'mqttDoorPasswordChannelId' is also accepted.",
  })
  @Transform(({ value, obj }) =>
    toOptionalNumber(
      value ?? readObjectValue(obj, 'mqttDoorPasswordChannelId'),
    ),
  )
  @IsInt()
  @Min(1)
  @IsOptional()
  mqttDoorPasswordDeviceId?: number;

  @ApiPropertyOptional({
    example: 'CLOSED',
    description: 'Latest known state reported back from the IoT board',
  })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsOptional()
  mqttState?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
