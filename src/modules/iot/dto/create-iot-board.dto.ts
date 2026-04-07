import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { MQTT_DEVICE_TOPICS } from '../iot-mqtt.types';

const readObjectValue = (obj: unknown, key: string) =>
  obj && typeof obj === 'object'
    ? (obj as Record<string, unknown>)[key]
    : undefined;

const toTrimmedString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : value;

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

export class CreateIoTBoardDeviceDto {
  @ApiPropertyOptional({
    example: '22222222-2222-4222-8222-222222222222',
    description: 'Optional existing device UUID from the client payload',
  })
  @Transform(({ value }) => toTrimmedString(value))
  @IsUUID()
  @IsOptional()
  id?: string;

  @ApiProperty({ example: 'Front Door Lock' })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  deviceName: string;

  @ApiProperty({
    example: 1,
    description:
      "Logical device id used in MQTT payloads. Legacy fields 'mqttDeviceId' and 'mqttChannelId' are also accepted.",
  })
  @Transform(({ value, obj }) =>
    toOptionalNumber(
      value ??
        readObjectValue(obj, 'mqttDeviceId') ??
        readObjectValue(obj, 'mqttChannelId'),
    ),
  )
  @IsInt()
  @Min(1)
  deviceId: number;

  @ApiPropertyOptional({
    example: 'door-lock',
    description: 'UI icon key used by the client application',
  })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiProperty({
    enum: MQTT_DEVICE_TOPICS,
    example: 'door',
    description:
      "MQTT topic configured on the ESP board for this child device. Legacy fields 'topic', 'mqttTopic', and 'mqttControlType' are accepted.",
  })
  @Transform(({ value, obj }) => {
    const rawValue: unknown =
      value ??
      readObjectValue(obj, 'mqttTopic') ??
      readObjectValue(obj, 'mqttControlType');

    return typeof rawValue === 'string'
      ? rawValue.trim().toLowerCase()
      : rawValue;
  })
  @IsIn(MQTT_DEVICE_TOPICS)
  topic: (typeof MQTT_DEVICE_TOPICS)[number];

  @ApiPropertyOptional({
    example: 'CLOSED',
    description: 'Latest known device state reported by the board',
  })
  @Transform(({ value, obj }) =>
    toTrimmedString(value ?? readObjectValue(obj, 'mqttState')),
  )
  @IsString()
  @IsOptional()
  state?: string;
}

export class CreateIoTBoardDto {
  @ApiProperty({
    example: 'ESP_A101',
    description: 'Physical board identifier used by MQTT topics',
  })
  @Transform(({ value, obj }) => toTrimmedString(value ?? readObjectValue(obj, 'boardId')))
  @IsString()
  id: string;

  @ApiPropertyOptional({
    description: 'Apartment that currently owns this board',
  })
  @IsUUID()
  @IsOptional()
  apartmentId?: string;

  @ApiProperty({
    type: [CreateIoTBoardDeviceDto],
    description: 'Devices connected to this board',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateIoTBoardDeviceDto)
  devices: CreateIoTBoardDeviceDto[];
}
