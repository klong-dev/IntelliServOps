import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { MQTT_DEVICE_TOPICS } from '../iot-mqtt.types';

export const IOT_DEVICE_CONTROL_ACTIONS = [
  'ON',
  'OFF',
  'OPEN',
  'CLOSE',
  'LOCK',
  'UNLOCK',
] as const;

export const IOT_DIRECT_MQTT_ACTIONS = ['ON', 'OFF'] as const;

const normalizeAction = (value: unknown) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

const readObjectValue = (obj: unknown, key: string) =>
  obj && typeof obj === 'object'
    ? (obj as Record<string, unknown>)[key]
    : undefined;

export class ControlDeviceDto {
  @ApiProperty({
    enum: IOT_DEVICE_CONTROL_ACTIONS,
    example: 'ON',
    description:
      "Action to send to a registered IoT device. Legacy body field 'command' is still accepted.",
  })
  @Transform(({ value, obj }) => {
    const rawValue: unknown = value ?? readObjectValue(obj, 'command');
    return normalizeAction(rawValue);
  })
  @IsIn(IOT_DEVICE_CONTROL_ACTIONS)
  action: (typeof IOT_DEVICE_CONTROL_ACTIONS)[number];
}

export class DirectMqttControlDto {
  @ApiProperty({
    enum: MQTT_DEVICE_TOPICS,
    example: 'light',
    description:
      'MQTT topic segment configured on the ESP board for this device',
  })
  @Transform(({ value }) => {
    const rawValue: unknown = value;
    return typeof rawValue === 'string'
      ? rawValue.trim().toLowerCase()
      : rawValue;
  })
  @IsIn(MQTT_DEVICE_TOPICS)
  topic: (typeof MQTT_DEVICE_TOPICS)[number];

  @ApiProperty({
    enum: IOT_DIRECT_MQTT_ACTIONS,
    example: 'ON',
    description: 'Only ON/OFF are accepted by the current IoT backend',
  })
  @Transform(({ value }) => {
    const rawValue: unknown = value;
    return normalizeAction(rawValue);
  })
  @IsIn(IOT_DIRECT_MQTT_ACTIONS)
  action: (typeof IOT_DIRECT_MQTT_ACTIONS)[number];
}


export class FakeFireAlertDto {
  @ApiProperty({
    example: 'ESP_A101',
    description: 'ESP board id to fake a FIRE status event for',
  })
  @IsString()
  espId: string;

  @ApiProperty({
    required: false,
    example: 3,
    description:
      'Optional alarm device channel id. If omitted, backend uses the alarm device configured for the board.',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  })
  @IsInt()
  @Min(1)
  deviceId?: number;
}
