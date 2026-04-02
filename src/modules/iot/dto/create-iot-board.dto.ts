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
import { Type } from 'class-transformer';
import { CreateIoTDeviceDto } from './create-iot-device.dto';
import { MQTT_CONTROL_TYPES } from '../iot-mqtt.types';

export class CreateIoTBoardDeviceDto extends OmitType(CreateIoTDeviceDto, [
  'apartmentId',
  'mqttEspId',
  'mqttBoardName',
] as const) {
  @ApiProperty({
    enum: MQTT_CONTROL_TYPES,
    example: 'door',
    description: 'MQTT control topic for this child device',
  })
  @IsIn(MQTT_CONTROL_TYPES)
  mqttControlType: (typeof MQTT_CONTROL_TYPES)[number];

  @ApiProperty({
    example: 1,
    description: 'MQTT relay/channel index for this child device',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  mqttChannelId: number;
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
