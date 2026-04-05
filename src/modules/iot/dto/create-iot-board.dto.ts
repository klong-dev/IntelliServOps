import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, OmitType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { CreateIoTDeviceDto } from './create-iot-device.dto';
import { MQTT_DEVICE_TOPICS } from '../iot-mqtt.types';

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

export class CreateIoTBoardDeviceDto extends OmitType(CreateIoTDeviceDto, [
  'apartmentId',
  'mqttEspId',
  'mqttBoardName',
] as const) {
  @ApiProperty({
    enum: MQTT_DEVICE_TOPICS,
    example: 'door',
    description:
      "MQTT topic configured on the ESP board for this child device. Legacy field 'mqttControlType' is also accepted.",
  })
  @Transform(({ value, obj }) => {
    const rawValue: unknown = value ?? readObjectValue(obj, 'mqttControlType');

    return typeof rawValue === 'string'
      ? rawValue.trim().toLowerCase()
      : rawValue;
  })
  @IsIn(MQTT_DEVICE_TOPICS)
  mqttTopic: (typeof MQTT_DEVICE_TOPICS)[number];

  @ApiProperty({
    example: 1,
    description:
      "Logical device id used in MQTT payloads. Legacy field 'mqttChannelId' is also accepted.",
  })
  @Transform(({ value, obj }) =>
    toOptionalNumber(value ?? readObjectValue(obj, 'mqttChannelId')),
  )
  @IsInt()
  @Min(1)
  mqttDeviceId: number;
}

export class CreateIoTBoardDto {
  @ApiProperty({
    example: 'ESP_A101',
    description: 'Physical board identifier used by MQTT topics',
  })
  @IsString()
  boardId: string;

  @ApiProperty({
    example: 'A101 Main Board',
    description: 'Human-readable board name',
  })
  @IsString()
  boardName: string;

  @ApiProperty({
    description: 'Apartment owning this board and its child devices',
  })
  @IsUUID()
  apartmentId: string;

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
