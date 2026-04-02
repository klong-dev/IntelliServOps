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
import { IoTDeviceType } from '@prisma/client';
import { Type } from 'class-transformer';
import { MQTT_CONTROL_TYPES } from '../iot-mqtt.types';

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
    description: 'MQTT target device identifier used as topic prefix',
  })
  @IsString()
  @IsOptional()
  mqttEspId?: string;

  @ApiPropertyOptional({
    example: 'A101 Main Board',
    description: 'Human-readable board name for the MQTT target device',
  })
  @IsString()
  @IsOptional()
  mqttBoardName?: string;

  @ApiPropertyOptional({
    enum: MQTT_CONTROL_TYPES,
    example: 'door',
    description:
      'MQTT control topic for this device. When omitted, generic control falls back from deviceType where possible.',
  })
  @IsIn(MQTT_CONTROL_TYPES)
  @IsOptional()
  mqttControlType?: (typeof MQTT_CONTROL_TYPES)[number];

  @ApiPropertyOptional({
    example: 1,
    description: 'MQTT relay/channel index appended to the payload',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  mqttChannelId?: number;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Optional door-password channel. Defaults to mqttChannelId when omitted.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  mqttDoorPasswordChannelId?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
