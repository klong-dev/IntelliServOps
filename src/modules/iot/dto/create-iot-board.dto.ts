import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
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
  @ApiProperty({
    example: 'device-door-1',
    description: 'Stable device identifier managed by the backend',
  })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @MaxLength(255)
  id: string;

  @ApiProperty({
    example: 'Front Door Lock',
    description: 'Editable display name for this board device',
  })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @MaxLength(255)
  deviceName: string;

  @ApiProperty({
    example: 1,
    description:
      "Logical device id used in MQTT payloads. Legacy field 'mqttDeviceId' is also accepted.",
  })
  @Transform(({ value, obj }) =>
    toOptionalNumber(value ?? readObjectValue(obj, 'mqttDeviceId')),
  )
  @IsInt()
  @Min(1)
  deviceId: number;

  @ApiPropertyOptional({
    example: 'door-lock',
    description: 'Optional icon key used by the client UI',
  })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsOptional()
  @MaxLength(255)
  icon?: string;

  @ApiProperty({
    enum: MQTT_DEVICE_TOPICS,
    example: 'door',
    description:
      "MQTT topic configured on the ESP board for this child device. Legacy field 'mqttTopic' is also accepted.",
  })
  @Transform(({ value, obj }) => {
    const rawValue: unknown = value ?? readObjectValue(obj, 'mqttTopic');

    return typeof rawValue === 'string'
      ? rawValue.trim().toLowerCase()
      : rawValue;
  })
  @IsIn(MQTT_DEVICE_TOPICS)
  topic: (typeof MQTT_DEVICE_TOPICS)[number];

  @ApiPropertyOptional({
    example: 'CLOSED',
    description:
      "Latest known device state reported back from the IoT board. Legacy field 'mqttState' is also accepted.",
  })
  @Transform(({ value, obj }) =>
    toTrimmedString(value ?? readObjectValue(obj, 'mqttState')),
  )
  @IsString()
  @IsOptional()
  @MaxLength(255)
  state?: string;
}

export class CreateIoTBoardDto {
  @ApiProperty({
    example: 'ESP_A101',
    description: "Physical board identifier used by MQTT topics. Legacy field 'boardId' is also accepted.",
  })
  @Transform(({ value, obj }) => toTrimmedString(value ?? readObjectValue(obj, 'boardId')))
  @IsString()
  @MaxLength(255)
  id: string;

  @ApiPropertyOptional({
    description: 'Optional apartment owning this board and its child devices',
  })
  @IsUUID()
  @IsOptional()
  apartmentId?: string;

  @ApiProperty({
    type: [CreateIoTBoardDeviceDto],
    description: 'Child devices connected to this board',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateIoTBoardDeviceDto)
  devices: CreateIoTBoardDeviceDto[];
}
